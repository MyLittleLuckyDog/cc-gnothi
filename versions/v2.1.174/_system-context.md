---
type: system-context
command: _system-context
cc_version: "2.1.174"
updated: "2026-06-12"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.174 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.174 System Context

> Analysis basis: CC v2.1.174 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.174 system context layer is assembled from multiple cooperating functions embedded in the bundle, each contributing a distinct behavioral domain: peer-session authority boundaries, tool-denial handling, autonomous loop governance, side-question routing, and subagent delegation guidance. Together these form a layered policy stack that sits beneath user instructions and CLAUDE.md, establishing floors and ceilings that persist regardless of conversational direction. The system context is not a single monolithic prompt but rather a composable set of sections injected at runtime, some of which are conditional on session mode (interactive, autonomous, subagent, side-question). CLAUDE.md and user instructions operate on top of this layer and can tune defaults within it, but cannot override the hard authority and safety boundaries the layer enforces.

---

## Hardcoded Constraints

- **Inter-session authority isolation**: Messages arriving from other Claude sessions are categorically treated as carrying zero user authority. Regardless of content or apparent legitimacy, actions requested by peer sessions are evaluated against the current session's permission set and the current user's established task scope — not the peer's claimed context. This restriction is absolute and cannot be overridden by any instruction.

- **Permission laundering prevention**: If a peer session requests an action that was denied to it, or explicitly states it cannot perform an action itself, the receiving session is hardcoded to refuse and escalate to the human user rather than relay the action. The system treats cross-session delegation of denied capabilities as a security violation, not a workflow convenience. There are no authorization-based exceptions.

- **Tool-denial bypass prohibition**: When a specific tool invocation is denied, CC is hardcoded to consider only reasonable, intent-preserving alternatives — not to circumvent the intent of the denial through creative re-routing. Specifically, the capability granted by tests or other indirect execution paths cannot be repurposed to execute non-test actions when a direct action was denied. This is an absolute constraint on the manner of workaround, not on whether any workaround is permitted.

- **Peer consent boundary**: A message originating from a peer Claude session is explicitly classified as never constituting user consent or approval for any action. The user's live session instructions and permission settings unconditionally take precedence over any peer-originated directive. This cannot be relaxed by operator or user instruction.

- **Autonomous scope conservatism**: During timer-driven autonomous operation, CC is hardcoded to treat absence of clear transcript evidence as a signal to refrain, not to proceed. Inventing new work items or executing irreversible changes without explicit prior authorization from the conversation record is blocked by policy, even when the agent could plausibly argue the action is beneficial.

- **Side-question instance isolation**: When spawned as a lightweight side-question agent, CC is hardcoded to refrain from any tool use, file reads, command execution, or promises of future action. It may only draw on context already present in the conversation. This constraint is structural to the spawn mode, not a user-configurable preference.

---

## Default Behaviors

- **Autonomous loop task selection**: By default, CC in autonomous mode prioritizes continuing work already established in the conversation transcript — active pull requests, failing CI, unresolved review threads — over initiating new work. Users can influence scope by explicitly authorizing broader initiative in the conversation prior to autonomous invocation, but the conservative default requires positive evidence of user intent.

- **Autonomous loop termination reporting**: When nothing actionable is found during an autonomous sweep, the default behavior is to emit a single brief status sentence and stop. Repeating this outcome multiple consecutive times triggers a further default: CC scales back to a minimal CI check rather than continuing full sweeps. Users cannot suppress the single-sentence report, but the threshold for scope reduction could theoretically be influenced by loop configuration.

- **Subagent prompt construction**: When delegating to a subagent, the default expectation is that the spawning agent writes a fully self-contained prompt — including file paths, line numbers, relevant background, and specific assessment criteria — rather than a vague directive. This is a behavioral default that shapes output quality; users can supply partial prompts, but doing so degrades subagent output quality in predictable ways.

- **Subagent context isolation**: By default, a subagent spawned with a `subagent_type` specification starts with no inherited conversation context. The delegating agent is expected to brief it completely. Users can influence what context is passed by controlling prompt content, but cannot grant the subagent implicit access to the parent conversation.

- **Background agent fork vs. inline handling**: CC defaults to forking survey-style or long-running questions to background agents rather than resolving them inline, keeping the primary context clean. Users can request inline resolution, but this trades context economy for immediacy.

- **Autonomous loop delay selection**: The default heartbeat delay in autonomous mode is selected dynamically based on observed branch activity — longer for quiet branches, shorter for active ones. A persistent monitor being armed shifts the delay toward a longer safety-net interval. Users can influence this via explicit delay guidance in the loop configuration, but the dynamic default is applied when no explicit guidance is present.

- **Documentation fetch behavior**: When bundled references and the live build configuration do not cover a topic, CC defaults to fetching from the live documentation source index rather than fabricating an answer or refusing. Users can suppress fetching by instruction, but the default is to seek authoritative current data.

- **Tool confirmation mode**: Whether CC prompts before executing tool actions versus auto-proceeding depends on the session's permission configuration. The default in interactive mode leans toward confirmation for consequential actions; autonomous mode shifts toward auto-proceed for actions within established scope. Users can tune this via permission rules and allow-lists.

---

## CLAUDE.md Redundancy Warning

- **Autonomous conservatism reminders**: The system context already establishes that CC should lean toward caution when scope is ambiguous during autonomous operation. Adding instructions in CLAUDE.md to "be careful" or "ask before doing new things" is largely redundant. Conflicting instructions that push toward more aggressive autonomous initiative may partially override the conservative default, with unpredictable results depending on instruction specificity.

- **Subagent briefing standards**: The system context already instructs CC on how to construct subagent prompts — self-contained, context-rich, with specific rather than vague directives. Duplicating general "be specific when delegating" guidance in CLAUDE.md is neutral at best. However, CLAUDE.md entries that specify project-specific context to always include in subagent prompts (file paths, architectural conventions) are additive and non-redundant.

- **Peer message handling**: The inter-session authority boundary is hardcoded at the system level. Any CLAUDE.md instruction attempting to grant peer sessions elevated authority or to treat peer requests as user-authorized will conflict with the hardcoded policy. The hardcoded constraint wins; the CLAUDE.md instruction will appear to be silently ignored for this purpose.

- **Tool-denial workaround policy**: The system context already defines the acceptable envelope for working around tool denials. CLAUDE.md instructions like "always find a way to complete tasks" may create instruction tension with the hardcoded bypass prohibition, producing hesitation or unpredictable behavior when a denial is encountered.

- **Autonomous loop scope**: The system context already configures PR maintenance, CI diagnosis, and review thread resolution as the canonical autonomous work queue. Restating these in CLAUDE.md is redundant. Project-specific additions (e.g., a particular health check script to run, or a specific branch naming convention to enforce) are genuinely additive and appropriate for CLAUDE.md.

- **Side-question response style**: The system context already instructs the side-question instance to answer directly without preamble, hedging, or offers to investigate further. Adding similar brevity instructions to CLAUDE.md is redundant for side-question spawns, though it may have effect on regular interactive turns.

---

## User Actionable Insights

1. **Peer session authority cannot be elevated.** No CLAUDE.md entry, user instruction, or runtime message can grant a peer Claude session the authority of the human user in the current session. Multi-agent workflows that depend on one Claude instance authorizing another to take consequential actions will be blocked at the system level. Design multi-agent pipelines so that consequential permissions are held by the coordinating human session, not delegated laterally between agents.

2. **Tool denial intent is enforced, not just the denial itself.** When a tool is denied, CC will not use indirect execution paths to achieve the same effect if doing so circumvents the intent of the denial. Users who want CC to use an alternative approach for a denied action should explicitly authorize the specific alternative — implicit workarounds through test runners or other side channels are blocked.

3. **Autonomous mode is transcript-driven, not goal-driven.** The autonomous loop reads the conversation transcript as its primary work queue. If you want CC to act on something autonomously, it must appear as an established commitment or in-progress item in the conversation before autonomous mode is invoked. Vague goals set before invocation produce conservative, minimal behavior; specific in-progress items produce active continuation.

4. **Subagent prompts require full context injection by design.** Because subagents start with no inherited conversation context, the quality of subagent output is entirely determined by how well the spawning agent briefs them. Users who observe shallow or off-target subagent results should inspect the prompt being sent — the system instructs CC to write rich briefings, but project-specific context that isn't in the conversation cannot be included automatically.

5. **The side-question spawn is tool-free by construction.** Questions routed to a side-question instance will never trigger file reads, command execution, or any external action. If a question requires live data or file inspection to answer accurately, it must be routed through the main agent, not a side-question spawn.

6. **Autonomous loops have a built-in idle scale-back.** After several consecutive sweeps that find nothing to do, CC automatically reduces sweep scope. Users running autonomous loops on genuinely quiet repositories should be aware that this scale-back is a feature, not a bug — it prevents wasteful polling. To reset scope, provide new work items in the conversation.

7. **Live documentation fetch is the fallback for unknown topics.** When CC's bundled knowledge does not cover a configuration topic, it will attempt to fetch from the live documentation index. Users in air-gapped or network-restricted environments should be aware that some "I don't know" responses may actually be failed fetches rather than genuine knowledge gaps, and may want to pre-populate CLAUDE.md with local documentation references.

8. **CLAUDE.md entries that specify project-specific autonomous work items are the highest-value additions.** Because the system context already handles general autonomous behavior, the most impactful CLAUDE.md entries for autonomous workflows are project-specific: which health scripts to run, which branch patterns to monitor, which CI jobs are known-flaky. These are genuinely additive to what the system context provides.

9. **Version-specific (v2.1.174): A usage-credit mode is available for a specific feature tier.** The bundle contains a notice indicating that a named feature tier now draws from usage credits rather than plan limits, and that updating to the latest version is required to access associated information. Users on older versions may observe unexplained credit consumption without this context.

---

## Tool & Permission Layer

**Auto-allow vs. prompt-to-allow modes**: The permission system distinguishes between actions within an established allow-list (which proceed without interruption) and actions outside it (which trigger a confirmation prompt). In autonomous mode, the operating assumption shifts toward auto-proceeding for actions that fall within the scope of the current task as established by the conversation transcript. Actions that fall outside that scope revert to prompt-to-allow behavior even in autonomous mode.

**Hook event handling**: The system context is aware of hook events as first-class signals in the autonomous loop. Specifically, a persistent monitor being armed for an awaited external event (CI completion, PR comment, log line) causes that event to become the primary wake signal for the loop, with the timer interval degrading to a safety-net fallback. The system instructs CC to arm monitors once and check for existing monitors before re-arming, preventing duplicate monitor accumulation.

**MCP server configuration**: The system context includes a structured reference for MCP server discovery and connection, including a registry search capability and a connector suggestion UI. MCP configuration is stored in `.mcp.json` at the plugin root or in a path specified by `plugin.json`'s `mcpServers` field. The system distinguishes between servers with static endpoint URLs and those with admin-provided dynamic endpoints, handling the latter by name-matching rather than URL-matching.

**System-reminder tag handling**: The side-question spawn mechanism uses a `<system-reminder>` tag to inject behavioral constraints into the lightweight instance's context. This tag signals to the instance that it is operating in a constrained, one-shot mode with no tool access and no follow-up turns. The main agent is explicitly told it is not interrupted — the fork is transparent to the primary conversation flow.

**Context compression notice**: The autonomous loop prompt design accounts for the possibility that the conversation has been compacted — the sentinel value passed to the scheduling tool expands differently on first fire, first fire post-compaction, and subsequent fires, allowing the loop to adapt its instructions to whether full context or a compressed summary is available.

**Task notification handling**: When the autonomous loop is woken by a task notification rather than a timer expiry, the system instructs CC to handle the triggering event, then reschedule with the standard heartbeat interval, preserving the persistent monitor as the primary wake signal. This prevents notification-driven wakes from disrupting the monitor/heartbeat architecture.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.174 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `k` | UI utility functions + background worker memory management / pinned-worker retirement logic |
| `f` | PostgreSQL keyword list (syntax highlighting) + side-question system-reminder injection |
| `$` | PostgreSQL data type list + subagent delegation example set (coordinator fork pattern) |
| `O` | Job block property constants + subagent delegation example set (simple delegate pattern) |
| `E` | Autonomous loop scheduling instructions (monitor arming, delay selection, sentinel prompt) |
| `M` | Subagent prompt-writing guidance (briefing standards, context injection policy) |
| `y` | Usage-credit mode notification string (feature tier credit consumption notice) |
| `b` | Subtask block property constants + scheduled task missed telemetry |
| `T` | Pseudo-reference code constants (access types, component lists, system settings) |
| `R` | Auto-numeration and record validation rule ID constants |
| `X` | Dataset event name constants (dse* / re* event identifiers) |
| `w` | Daemon configuration reload telemetry handler |
| `D` | Background worker dispatch telemetry (SIGKILL escalation, low-memory, spare worker lifecycle) |
| `Zw6` | Assembler call site (no large strings; role indeterminate from content alone) |
| `L` | Assembler call site (no large strings; role indeterminate from content alone) |
| `P` | Assembler call site (no large strings; role indeterminate from content alone) |
| `j` | Assembler call site (no large strings; role indeterminate from content alone) |
| `z` | Assembler call site (no large strings; role indeterminate from content alone) |
| `J` | Assembler call site (no large strings; role indeterminate from content alone) |
| `S` | Assembler call site (no large strings; role indeterminate from content alone) |
| `I` | Assembler call site (no large strings; role indeterminate from content alone) |
| `V` | Analytics dashboard CSS + UI rendering logic (hour histogram, CLAUDE.md action panel) |
| `Y` | PostgreSQL SQLSTATE / error code enumeration |
| `XN6` | Peer-session authority warning injector (dual-copy, both injection points identical) |
| `T4A` | Tool-denial workaround policy injector (intent-preserving alternative guidance) |
| `rd_` | Peer-session authority warning injector (single-copy variant) |
| `Yb_` | Autonomous loop behavioral policy (steward framing, work queue prioritization, idle handling) |
| `BpK` | Live documentation source index (Mintlify URL table with extraction prompts) |
| `wmK` | Files API Python reference (upload, message attachment, management operations) |
| `wxK` | MCP discovery and connection reference (registry search, connector suggestion, config format) |