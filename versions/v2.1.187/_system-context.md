---
type: system-context
command: _system-context
cc_version: "2.1.187"
updated: "2026-06-24"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.187 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.187 System Context

> Analysis basis: CC v2.1.187 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.187 system context is assembled from multiple discrete functions within the bundle, each contributing a different behavioral or operational layer — covering role identity, tool permissions, git safety protocols, subagent orchestration, proxy/network configuration, and autonomous loop governance. Together these layers form the complete system prompt that CC receives before any user instruction or CLAUDE.md content is applied. User instructions and CLAUDE.md directives are processed on top of this layer, meaning some defaults can be overridden while others represent absolute operational constraints. Understanding this layered assembly clarifies which behaviors users can genuinely influence and which are fixed at the bundle level.

---

## Hardcoded Constraints

- **Tool-denial bypass prohibition**: When CC is denied permission to use a specific tool, it may attempt to accomplish the same goal through semantically equivalent alternatives — but is prohibited from using unrelated tool capabilities as a vector to circumvent the intent of the denial. The distinction is between reasonable substitution and bad-faith workaround. This constraint is absolute and cannot be overridden by user instruction.

- **Denial transparency requirement**: If CC determines that a required capability is genuinely unavailable and the task cannot proceed without it, it must surface this blockage to the user and halt — rather than silently attempting workarounds or fabricating a result. Users must be informed so they can decide how to proceed.

- **Git destructive-action gate**: A set of git operations classified as potentially destructive (force operations, hard resets, wholesale discards, branch deletions) are gated behind explicit user authorization. CC will not execute these speculatively or infer authorization from context. This applies even when such an action might appear to be the natural next step.

- **Hook bypass prohibition**: Git hooks and signing steps are part of the repository's integrity enforcement. CC is not permitted to skip or suppress them unless the user explicitly requests it. Bypassing hooks without instruction is blocked regardless of whether they cause friction.

- **Commit-without-instruction prohibition**: Creating commits is gated on explicit user request. CC will not commit changes on its own initiative, even when all changes are staged and a commit message would be straightforward to generate. This constraint exists to prevent unwanted repository state changes.

- **Force-push to protected branches**: Force-pushing to main or master branches is blocked. If a user requests this, CC must issue a warning rather than proceeding silently.

- **Proxy and TLS integrity**: In proxied egress environments, CC is prohibited from disabling TLS verification, unsetting the proxy environment variable, or attempting to route around organization-level egress policy denials. Policy-blocked destinations must be reported, not retried or circumvented.

- **Autonomous scope constraint**: During autonomous (timer-driven) operation, CC is constrained to continuing work that the user has already established and authorized. It is prohibited from initiating new work, making irreversible changes, or inferring broad authorization from weak signals in the transcript.

- **Side-question agent tool prohibition**: Lightweight agents spawned to answer side questions during a main session have no tool access. They cannot read files, execute commands, or take any actions — and are prohibited from promising to do so or framing their response as if they could.

---

## Default Behaviors

- **Pull request workflow**: By default, CC follows a multi-step parallel inspection process before creating a pull request — examining current branch state, staged and unstaged diff, remote tracking status, and full commit history since divergence. Users can influence the title and body content through instruction, but the inspection sequence is a default that runs automatically.

- **Commit message style**: Defaults to concise, "why"-focused commit messages passed via heredoc for formatting safety. Users can influence the message content and style through instruction, but the heredoc delivery mechanism and the prohibition on committing sensitive files are fixed.

- **Staging selectivity**: Defaults to staging specific named files rather than bulk-adding everything. Users can request broader staging, but CC will warn if the request risks including credential or environment files.

- **Subagent prompt quality**: When delegating to subagents, CC defaults to constructing self-contained prompts that brief the agent as if it has no prior context — including what has been tried, what was ruled out, and what form the response should take. Users can influence what gets delegated but not the expectation that prompts must be self-sufficient.

- **Autonomous loop pacing**: In autonomous mode, the default heartbeat interval is tuned based on observed branch activity — quieter branches get longer waits, active branches get shorter ones. Users can influence loop behavior through loop configuration but the pacing heuristic is a built-in default.

- **PR maintenance during autonomous operation**: When no active conversation work remains, CC defaults to checking the current branch's pull or merge request for CI status, unresolved review threads, and base-branch lag. This is the fallback behavior when the transcript is exhausted. Users can override loop scope through explicit instruction.

- **Documentation lookup fallback**: When bundled references do not cover a topic, CC defaults to fetching live documentation from the official documentation host. Users can disable or redirect this through configuration.

- **Side-question handling**: When a side question arrives during an active main session, CC defaults to spawning a lightweight read-only agent to answer it without interrupting the primary session. The main agent continues working independently. Users cannot currently suppress this routing mechanism through CLAUDE.md alone.

---

## CLAUDE.md Redundancy Warning

- **Commit discipline**: The system context already establishes that commits require explicit user requests, that sensitive files must be excluded, and that messages should be concise and purpose-focused. Adding commit guidance to CLAUDE.md is largely redundant. Conflicting instructions — such as "always commit after each change" — may create genuine instruction conflict and result in unpredictable behavior.

- **Git safety rules**: Protections around destructive git operations, hook skipping, and force-push warnings are already embedded at the system level. CLAUDE.md entries that attempt to relax these rules (e.g., "feel free to force push when needed") will conflict with the hardcoded constraint layer. Entries that reinforce them are redundant but harmless.

- **PR creation workflow**: The multi-step inspection sequence before PR creation is already the default. CLAUDE.md instructions like "always check branch state before opening a PR" duplicate existing behavior. Instructions that attempt to abbreviate this process may or may not override the default, depending on instruction conflict resolution.

- **Subagent delegation quality**: The expectation that delegated prompts be self-contained and include full context is already part of the system layer. CLAUDE.md guidance on "how to write agent prompts" is redundant. Conflicting guidance that encourages terse or context-free delegation may degrade subagent output quality.

- **Autonomous loop scope**: The constraint that autonomous operation must not invent new work is already hardcoded. CLAUDE.md entries that attempt to expand autonomous scope (e.g., "feel free to refactor unrelated code during downtime") may conflict with the built-in stewardship constraint, producing either a conflict warning or inconsistent behavior.

- **Documentation fetching**: The live documentation fallback is already configured in the system layer, including the full URL table. Adding documentation URL hints to CLAUDE.md is redundant. Conflicting documentation sources could cause confusion about which reference takes precedence.

---

## User Actionable Insights

1. **Certain git operations require explicit instruction every time.** CC will not infer authorization for destructive git operations from context or prior conversation. If your workflow routinely involves force operations or resets, you must provide explicit instruction at each occurrence — there is no CLAUDE.md setting that pre-authorizes these.

2. **The commit gate is intentional and cannot be bypassed implicitly.** If you want CC to commit as part of a larger workflow, your task instruction must include an explicit commit request. Implicit permission (e.g., "finish the feature") does not trigger commits.

3. **Subagent prompts must be self-contained — this is enforced by default behavior.** When CC delegates to a subagent, it will brief the agent from scratch. If you want a subagent to know something specific, instruct CC to include that context. Do not assume shared conversation state carries over.

4. **Autonomous mode is a steward, not an initiator.** If you activate autonomous/timer-driven operation, CC will advance existing work and maintain open PRs — but it will not start new tasks or make new architectural decisions. Set it loose only when there is already established work in the conversation for it to continue.

5. **Tool denial has a transparency obligation attached.** If CC cannot complete your request because a tool is denied, it will tell you rather than silently failing or working around the denial in unexpected ways. This is the intended behavior — use it as a signal to adjust permissions or approach.

6. **The proxy and TLS layer is non-negotiable in managed environments.** If you are running CC inside a proxied corporate or cloud environment, TLS verification will be enforced and egress policy denials will not be retried. Debugging tool-specific certificate failures requires pointing the failing tool at the managed CA bundle — not disabling verification.

7. **Side questions during active sessions are handled by a separate, tool-free agent.** If you ask a question mid-task, the response comes from a lightweight instance with no ability to look things up or take action. If the answer requires file access or command execution, wait for the main session to complete or ask in a fresh session.

8. **CLAUDE.md is most valuable for project-specific context, not behavioral overrides.** A large portion of behavioral policy is already set at the system level. CLAUDE.md additions that attempt to re-specify what CC already does are at best redundant and at worst create instruction conflicts. Focus CLAUDE.md on: project-specific conventions, codebase context, preferred toolchain, and domain knowledge that CC cannot infer from the repository alone.

9. **Live documentation lookup is a built-in fallback, not a user-configured feature.** If CC fetches external documentation during a session, this is the system-level documentation fallback activating — not a misconfiguration. The documentation source table is fixed in this version (v2.1.187) and resolves to the official documentation host.

10. **Version-specific note:** The autonomous loop pacing parameters in v2.1.187 include explicit fallback heartbeat ranges for timer-driven sessions. If you are operating CC autonomously and observing pacing behavior, this is governed by built-in heuristics in this version, not by any user-configurable setting exposed in CLAUDE.md or CLI flags at this time.

---

## Tool & Permission Layer

**Tool denial and graceful degradation**: The system context embeds a policy governing what CC does when a requested tool invocation is denied. Reasonable semantic alternatives are permitted; bad-faith or indirect circumvention is not. When no valid path exists, CC must surface the blockage transparently rather than silently failing.

**Auto-allow vs. prompt-to-allow**: The permission model distinguishes between tool invocations that proceed automatically under the current permission set and those that require user confirmation. Which category a given tool call falls into depends on the active permission configuration — not hardcoded per-tool defaults alone.

**Side-question agent spawning**: A `system-reminder`-tagged message type is used to instantiate lightweight side-question agents. These agents receive the conversation context and a strict constraint set — no tools, single response, no promises of future action. The tag instructs CC that it is operating as a separate, ephemeral instance with no connection to the main agent's ongoing work.

**Subagent orchestration (fork and typed agents)**: The system context includes behavioral templates for two subagent patterns: fork-type agents (which inherit conversation context and operate in parallel, reporting back via a later turn) and typed agents (which start fresh and require fully self-contained prompts). The orchestration model instructs CC on when to use each pattern and how to handle the timing of result delivery.

**Autonomous loop machinery**: The timer-driven autonomous mode is governed by a structured loop protocol embedded in the system context. This protocol specifies how CC selects its next delay interval, when to arm persistent monitoring tasks, how to handle wake events from monitoring tasks versus timer fires, and the condition under which the loop should terminate. The loop uses a sentinel value in its scheduling call that expands at fire time to the appropriate instruction set for that loop phase.

**Context compression notice**: The system context includes provisions for how CC should behave when context compression has occurred — specifically, awareness that a loop or session may be operating on a compacted context and that the instruction set for the current phase is regenerated dynamically at fire time rather than carried verbatim from the original session.

**MCP server configuration**: The tool layer includes a discovery and connection protocol for MCP servers. CC knows how to search a registry, present connection UI, and update plugin configuration files — both the wrapped and unwrapped config formats. This machinery is part of the plugin customization surface and operates through defined tool calls rather than ad-hoc file editing.

**Proxy-aware tool execution**: In proxied environments, the system context instructs CC on how to diagnose and resolve tool-specific TLS and proxy failures for a wide range of runtimes and package managers. This is a built-in diagnostic layer — CC knows the standard CA environment variables, tool-specific config file locations, and the correct escalation path for policy-blocked destinations.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.187 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `L` | Analytics dashboard UI renderer / background memory management telemetry host |
| `s` | SQL keyword list (PostgreSQL) + side-question system-reminder message template |
| `l` | PostgreSQL data type list + subagent typed-delegation example templates |
| `a` | Subagent fork-mode orchestration examples and coordinator turn-sequencing templates |
| `A` | Autonomous loop scheduling protocol and sentinel-based prompt expansion instructions |
| `i` | Subagent prompt-writing behavioral guidelines |
| `D` | Subtask block property and event name enumeration (workflow engine constants) |
| `c` | Job block property and event name enumeration (workflow engine constants) |
| `E` | Pseudo-reference code enumeration (access types, component lists, system settings) |
| `k` | Reference record business rule ID enumeration |
| `g` | Dataset event name enumeration (dse* and re* event constants) |
| `d` | Daemon config reload telemetry handler |
| `f` | Background process dispatch telemetry handler (SIGKILL escalation, low-memory, spare worker lifecycle) |
| `bIt` | Bundle assembler call (no large strings; role unresolved from content alone) |
| `H` | Background process management handler (no large strings; role unresolved from content alone) |
| `m` | Background process handler (no large strings; role unresolved from content alone) |
| `u` | Background process handler (no large strings; role unresolved from content alone) |
| `h` | Background process handler (no large strings; role unresolved from content alone) |
| `x` | Background process handler (no large strings; role unresolved from content alone) |
| `w` | Handler at layout offset (no large strings; role unresolved from content alone) |
| `v` | Background process handler (no large strings; role unresolved from content alone) |
| `I` | Report/dashboard CSS stylesheet renderer |
| `p` | PostgreSQL SQLSTATE error code enumeration |
| `rOo` | Tool-denial bypass policy message (graceful degradation and transparency instruction) |
| `fWp` | Git workflow instructions — commit protocol and pull request creation protocol |
| `LVr` | Autonomous loop behavioral policy — scope, pacing, and stewardship constraints |
| `Nsc` | Live documentation URL table and fetch fallback configuration |
| `tPf` | Agent proxy configuration, TLS trust setup, and egress failure diagnostic guide |
| `Zrc` | Files API reference documentation (Python) |
| `Htc` | MCP discovery, registry search, and plugin connector configuration guide |