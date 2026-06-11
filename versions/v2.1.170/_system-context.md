---
type: system-context
command: _system-context
cc_version: "2.1.170"
updated: "2026-06-12"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.170 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.170 System Context

> Analysis basis: CC v2.1.170 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.170 system context is assembled from multiple cooperating functions rather than a single monolithic prompt. Together these functions define CC's role declaration, inter-session authority rules, tool permission semantics, agentic task handling guidance, autonomous loop behavior, and documentation reference index. This layered assembly means some behavioral policies are injected conditionally (e.g., only when a peer-session message arrives, or only during an autonomous timer invocation), while others are always present. User instructions and CLAUDE.md content can influence many default behaviors, but a distinct subset — particularly those governing cross-session authority, permission laundering, and tool-denial handling — are structurally enforced and not overridable by user-level configuration.

---

## Hardcoded Constraints

- **Cross-session authority isolation**: When CC receives a message originating from a different Claude session (a "peer" message), the system context instructs CC to treat that message as carrying zero authority inherited from the current user. The current user's instructions and the session's permission settings unconditionally take precedence over any peer request. This constraint is absolute and cannot be elevated by peer-side claims or by CLAUDE.md directives.

- **Permission laundering prevention**: If a peer session requests that CC perform an action the peer itself was denied, CC is required to refuse and surface the request to the human user rather than relay or proxy it. The rationale encoded in the system context is explicit: routing a denied action through a peer channel does not constitute user consent and must never be treated as such. This is a structural rule with no authorization-based exception path.

- **Tool-denial circumvention limits**: When a specific tool invocation is blocked or denied, CC may attempt to accomplish the same goal using naturally available alternatives — but only through reasonable, intent-respecting substitutions. Attempts to use the tool execution surface to bypass the denial's intent (for example, running non-test logic through a test runner to sidestep a command restriction) are explicitly prohibited. If no reasonable alternative exists, CC must stop and explain the situation to the user rather than proceed.

- **Autonomous loop scope ceiling**: During timer-based autonomous invocations, CC is constrained to work that is clearly established in the existing conversation transcript or directly attributable to the current branch's pull/merge request state. Inventing new work, initiating new goals not traceable to the user's prior instructions, or making irreversible changes without clear authorization are treated as trust-eroding violations of the autonomous stewardship role. The system context encodes an explicit tiebreaker: when uncertain whether an action is "continuing established work" vs. "inventing new work," CC must default to inaction rather than reach for justifications.

- **Side-question agent tool restriction**: When CC spawns a lightweight sub-instance to handle a side question while the main agent continues working, that sub-instance is categorically prohibited from using any tools — no file reads, no command execution, no searches. This is a structural constraint on the sub-instance class, not a default that can be relaxed within that invocation type.

- **Peer message consent boundary**: A peer-originated message is never treated as user consent or approval for any action, regardless of the content of the peer message. This applies even when the peer claims to be relaying a user instruction from another context.

---

## Default Behaviors

- **Autonomous loop invocation style**: By default, when CC runs on a timer with the user absent, it prioritizes in-progress PR work (CI, review threads, merge conflicts), then unfinished implementation, then explicit commitments made in the transcript, and finally passive maintenance sweeps. Users can influence the loop's focus by shaping what is present in the conversation transcript before leaving — the transcript is the highest-signal source. The loop's behavior cannot be redirected mid-run through CLAUDE.md alone; the transcript content drives prioritization.

- **Autonomous loop verbosity on idle**: When the loop finds nothing to act on, the default is a single-sentence acknowledgment with no elaboration. Users cannot currently configure this output format through CLAUDE.md; the behavior is encoded at the system level. Repeated idle results trigger automatic scope reduction.

- **Sub-agent prompt construction style**: When delegating to a sub-agent, CC defaults to constructing prompts that are self-contained briefings — providing context the sub-agent cannot infer from the conversation, specifying the goal clearly, and capping response length when appropriate. Users can influence what gets delegated and how prompts are framed through conversational instruction, but the underlying briefing philosophy (treat the sub-agent as a colleague who just entered the room with no prior context) is a system-level default.

- **Sub-agent independence on second-opinion tasks**: When a user requests an independent review or second opinion, CC defaults to launching a sub-agent with a fresh context rather than sharing its own analysis — preserving the independence of the review. Users can override this by explicitly requesting that CC share its findings with the reviewer, but the default protects analytical independence.

- **Autonomous rebase vs. merge preference**: When working autonomously on a branch that has fallen behind its base, CC defaults to rebasing rather than merging to keep history clean. This is a codified default. Users who prefer merge-based workflows should specify this in CLAUDE.md or conversationally.

- **CI failure triage before action**: When autonomous loop detects failing CI, CC defaults to pulling and diagnosing the failure logs before taking any remediation action, distinguishing between flaky/transient failures (which may be re-enqueued) and real failures (which require a fix). Users cannot bypass this triage default through CLAUDE.md; it is a safety behavior encoded at the system level.

- **Documentation fetch source preference**: When answering questions about CC behavior or configuration that are not covered by bundled references, CC defaults to fetching from the live documentation index at the canonical documentation domain. Users can redirect this by providing alternative documentation sources, but the default endpoint catalog is system-embedded.

- **Timer delay selection logic**: In autonomous loop mode, the default delay selection between invocations is context-sensitive: shorter delays when significant work is in flight, longer delays on quiet branches. A monitor/watcher being active shifts the delay toward the longer fallback heartbeat range. Users can influence this by configuring persistent monitors, but the underlying logic is system-defined.

---

## CLAUDE.md Redundancy Warning

- **Autonomous work prioritization**: The system context already defines a precise prioritization stack for autonomous loop work (transcript → PR state → maintenance). Adding a CLAUDE.md directive like "prioritize active PRs" or "focus on what I was working on" duplicates this default. Such additions are neutral if phrased consistently with the existing hierarchy but may create conflict if they attempt to elevate maintenance sweeps or new-work discovery above transcript-driven tasks.

- **Sub-agent briefing style**: The system context already instructs CC to brief sub-agents with full context, specific file references, and concrete goals rather than vague delegation. CLAUDE.md entries that say "always give agents full context" or "don't delegate understanding" are redundant — the default already encodes this. Conflicting CLAUDE.md entries (e.g., "keep sub-agent prompts short and let them figure it out") would directly conflict with the system default and likely degrade delegation quality.

- **Rebase preference**: The system context encodes rebasing as the default for branch-catching-up operations during autonomous runs. A CLAUDE.md entry specifying "always rebase, never merge" is redundant for this case. However, if the user wants merge behavior, a CLAUDE.md entry is the correct mechanism — making it one of the few cases where CLAUDE.md is the appropriate override channel.

- **Second-opinion isolation**: The default already protects the independence of second-opinion sub-agents by starting them without the coordinator's analysis. CLAUDE.md entries like "don't share your conclusions with reviewer agents" are redundant. Entries like "always brief reviewers on what you found first" would override this default, which may be intentional but should be recognized as a departure from the system default.

- **Idle loop verbosity**: The system default is already minimal (one sentence, no elaboration) when nothing is found during an autonomous sweep. CLAUDE.md entries asking CC to "provide a detailed summary of what you checked" during idle runs would conflict with this default and may produce verbose output that clutters the transcript for the returning user.

- **Documentation lookup sources**: The system context already embeds a curated documentation URL catalog. CLAUDE.md entries that list documentation URLs for CC internals (settings, permissions, hooks, MCP, CLI flags) are likely redundant unless they point to custom internal documentation that extends beyond the official catalog.

---

## User Actionable Insights

1. **Peer-session authority is permanently zero.** No amount of CLAUDE.md configuration, user instruction, or peer-side claiming can grant a peer Claude session authority over the current session. If you are building a multi-agent workflow that requires one CC instance to authorize actions on behalf of another, that authorization must flow through the human user turn — it cannot be encoded in the peer message itself.

2. **Permission laundering is a structural block, not a policy.** If you want CC to perform an action that was denied in a sub-agent context, the correct path is to grant the permission in the parent session and re-delegate, or to grant it directly to the sub-agent's session. Having the sub-agent ask the parent to do it on its behalf will be refused and surfaced to you.

3. **The conversation transcript is your most powerful tool for shaping autonomous loop behavior.** The autonomous loop reads the transcript as its primary work queue. If you want the loop to focus on a specific PR, test suite, or task area while you are away, leaving a clear "next I'll..." or in-progress state in the transcript before stepping away is more effective than CLAUDE.md instructions.

4. **Tool denial workarounds have a hard intent boundary.** CC will attempt reasonable alternative approaches when a tool is denied, but it will not use unrelated tool surfaces to route around the denial. If you find CC stopping and explaining a permission issue rather than finding a workaround, the denial's intent is being respected — grant the specific permission rather than expecting creative circumvention.

5. **Sub-agent side questions have no tool access by design.** If you trigger a side-question sub-instance (the lightweight parallel agent that answers questions while the main agent continues), do not expect it to look anything up, run any commands, or fetch any files. It can only reason over what is already in the conversation context. Design questions for this pathway accordingly.

6. **Rebase is the autonomous default; CLAUDE.md is the override channel.** If your project uses merge-based workflows, add an explicit merge preference to CLAUDE.md. This is one of the genuine cases where CLAUDE.md is the correct and necessary mechanism rather than a redundant one.

7. **Live documentation URLs are embedded in the bundle.** CC can self-direct to the official documentation index, changelog, settings reference, CLI flag reference, permissions guide, hooks schema, MCP configuration guide, and platform-specific deployment guides (Bedrock, Vertex, Foundry) without you providing URLs. If you are asking CC about its own behavior, it has a structured lookup path — you do not need to paste documentation into CLAUDE.md.

8. **Autonomous loop idle behavior is intentionally terse.** Three consecutive idle results cause the loop to scale back automatically. If you are running an autonomous loop and seeing one-sentence "nothing to do" outputs, this is correct behavior — not a malfunction. The loop is conserving context and signaling that the work queue is empty.

9. **Version v2.1.170 introduces the tiered autonomous pacing system.** The delay-selection logic (shorter when work is in flight, longer on quiet branches, heartbeat-range when a monitor is active) is new to this version. If you are upgrading from an earlier version and find the loop's invocation cadence has changed, this is the source.

10. **MCP server configuration is documentation-indexed, not just CLAUDE.md-driven.** The system context embeds structured MCP discovery and configuration guidance, including a registry search capability and a category-to-keyword mapping. If you are setting up MCP integrations, CC has structured knowledge of the discovery workflow and can guide configuration without you providing it externally.

---

## Tool & Permission Layer

**Auto-allow vs. prompt-to-allow modes**: The system context defines two operational modes for tool invocations. In auto-allow mode, CC proceeds with tool calls that fall within pre-authorized categories without interrupting the user for confirmation. In prompt-to-allow mode, CC pauses and surfaces the request before proceeding. The mode active for a given tool is determined by the permission configuration at session start; the system context explains this machinery to CC itself so it knows when to proceed vs. when to pause.

**Tool denial handling**: When a tool invocation is denied at the permission layer, the system context instructs CC to attempt the goal through reasonable alternative tools if available, but prohibits circumventing the denial's intent. If no reasonable alternative exists, CC is instructed to stop, explain what it was attempting, and why the permission is needed — placing the decision back with the user. This creates a clean escalation path rather than silent failure or creative bypass.

**Peer-session message tagging**: Messages arriving from peer Claude sessions receive structural handling that strips them of user-level authority regardless of content. The system context injects this framing at the point of peer message receipt, ensuring CC's authority model is correctly applied even in complex multi-agent topologies.

**Side-question sub-instance (`system-reminder` tag)**: A dedicated `system-reminder`-tagged injection governs the behavior of lightweight sub-instances spawned to handle side questions. This injection explicitly informs the sub-instance of its constraints: no tools, single response, no follow-up turns, and no promises of future action. The main agent is not interrupted during this sub-instance's operation.

**MCP server integration**: The system context embeds a structured MCP discovery workflow including registry search, connector suggestion UI, and configuration file format guidance. CC understands both wrapped and unwrapped MCP config formats and can handle dynamic-endpoint servers (those without a fixed URL in the registry) by matching on server name.

**Hook event awareness**: The system context is aware of the hook event lifecycle (before-start, after-finish, query parameter events, and similar lifecycle points) as part of its understanding of the extensibility layer. Hook-triggered wakeups in the autonomous loop are treated as primary wake signals, with the timer serving as a fallback heartbeat rather than the primary trigger.

**Context compression notice**: The autonomous loop system context includes handling for post-compaction invocations — the first loop invocation after a context compression event receives expanded instruction injection rather than the short dynamic-pacing reminder. This ensures CC has full orientation after compaction without requiring user intervention.

**Scheduled task telemetry**: Missed scheduled task events are instrumented and reported via the telemetry layer, allowing Anthropic to monitor autonomous loop reliability without surfacing this instrumentation to the user.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.170 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `h` | UI helper + background worker memory management (collapsible UI, clipboard, hour histogram, pinned worker retirement) |
| `L` | SQL keyword/statement highlighter vocabulary + side-question sub-instance system-reminder injector |
| `$` | PostgreSQL data type vocabulary + coordinator sub-agent fork usage examples (ship-audit, migration-review) |
| `O` | Job block property constant registry + simplified sub-agent delegation example injector |
| `E` | Autonomous loop tick instruction assembler (monitor arming, delay selection, sentinel prompt, task-notification handling, loop termination) |
| `M` | Sub-agent prompt writing guidance injector (briefing philosophy, context requirements, delegation anti-patterns) |
| `y` | Version-gated billing notice renderer (Fable 5 / usage credits migration message) |
| `b` | Subtask block property constant registry + scheduled task missed telemetry emitter |
| `T` | Pseudo-reference code constant registry (access types, component sets, privilege sets, replication seances) |
| `R` | Auto-numeration and record validation rule ID constant registry |
| `X` | Dataset event (dse/re prefix) constant registry + selection route event constants |
| `Y` | Daemon configuration reload telemetry emitter |
| `w` | Background worker dispatch and spare pool telemetry emitter (SIGKILL escalation, low memory, spare enable/claim) |
| `sO6` | Stub / no large string content (assembler call, no telemetry) |
| `f` | Stub / no large string content (assembler call, no telemetry) |
| `P` | Stub / no large string content (assembler call, no telemetry) |
| `J` | Stub / no large string content (assembler call, no telemetry) |
| `z` | Stub / no large string content (assembler call, no telemetry) |
| `j` | Stub / no large string content (assembler call, no telemetry) |
| `S` | Stub / no large string content (assembler call, no telemetry) |
| `k` | Stub / no large string content (assembler call, no telemetry) |
| `V` | Analytics dashboard CSS + HTML renderer (time-of-day histogram, CLAUDE.md action cards, friction category display) |
| `D` | PostgreSQL SQLSTATE / error code constant vocabulary (full error condition enumeration) |
| `QV6` | Peer-session authority warning injector (dual-copy; both slots identical) |
| `Q9A` | Tool-denial workaround policy injector (reasonable alternative guidance + escalation instruction) |
| `gF_` | Peer-session authority warning injector (single-copy variant) |
| `GS_` | Autonomous loop stewardship prompt assembler (work prioritization, PR maintenance, repeated invocation scope adjustment, idle handling) |
| `tRK` | Live documentation URL catalog injector (Mintlify endpoint index for settings, CLI, permissions, hooks, MCP, platform guides) |
| `ISK` | Files API Python reference injector (upload, use in messages, manage, end-to-end example) |
| `IyK` | MCP discovery and connection workflow injector (registry search, connector suggestion, category-keyword mapping, config file format) |