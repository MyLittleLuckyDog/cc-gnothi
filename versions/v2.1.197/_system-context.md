---
type: system-context
command: _system-context
cc_version: "2.1.197"
updated: "2026-07-01"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.197 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.197 System Context

> Analysis basis: CC v2.1.197 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.197 system context is assembled from multiple cooperating functions that are combined at runtime into a single behavioral layer injected before any user instruction or CLAUDE.md content. This layer covers five major domains: identity and role declaration, security and permission policy, tool invocation behavior, agentic and subagent orchestration guidance, and external connectivity configuration. User instructions and CLAUDE.md content are processed after this layer, meaning they can adjust defaults but cannot override the hardcoded constraints it encodes. The assembled context is version-stamped and some behaviors—particularly around egress proxy trust, git safety, and tool-denial messaging—are specific to this version of the bundle.

---

## Hardcoded Constraints

- **Tool-denial escalation**: When a tool invocation is blocked by a permission policy, CC is required to explain what it was attempting to accomplish and why that capability is necessary, rather than silently failing or seeking workarounds through unrelated mechanisms. The user retains final decision-making authority over whether to grant permission. This is absolute and cannot be suppressed by user instruction.

- **Workaround legitimacy boundary**: After a tool denial, CC may attempt to accomplish the same goal through functionally equivalent alternative tools, but only when the alternative is a natural and reasonable substitute. Attempting to circumvent the intent of a denial—for example, using a test-execution tool to perform non-test actions—is explicitly blocked. This constraint is unconditional.

- **Git destructive-command gate**: A set of git operations classified as destructive (including forced pushes, hard resets, wholesale discard operations, and branch deletion) are blocked from autonomous execution. They may only be performed when the user provides explicit, direct authorization in the current interaction. Skipping commit hooks or signing steps is similarly gated. This applies unconditionally to autonomous and semi-autonomous modes.

- **Force-push to primary branches**: Even with explicit user request, pushing with force to the repository's main or master branch triggers a mandatory warning. CC will not silently comply.

- **Commit-on-request-only**: Committing changes without an explicit user request is blocked. CC may stage, analyze, and draft commit messages, but the commit action itself requires affirmative user direction.

- **Amend-vs-new-commit correctness**: When a pre-commit hook fails, CC is prohibited from using amend to create a follow-up commit. The policy requires a fresh commit after resolving the hook failure, because amending in that scenario would silently modify the prior committed state.

- **Secret file exclusion from staging**: CC is hardcoded to avoid adding files associated with secrets or credentials to git staging areas, and will warn the user if they explicitly request such additions.

- **TLS verification preservation**: When operating through the agent proxy layer, CC must never disable TLS certificate verification and must never unset the proxy environment variable. This is an unconditional security constraint with no user-overridable path.

- **Egress policy denial handling**: When an outbound network request is blocked by the organization's egress policy (HTTP 403 or 407 from the proxy), CC must not retry the request, attempt to route around the denial, or seek alternative paths to the blocked host. The required response is to report the blocked destination to the user.

- **Autonomous loop scope boundary**: In autonomous timer-driven operation, CC is prohibited from inventing new work outside what the existing conversation transcript and current branch state establish. Irreversible changes without clear prior authorization from the user are blocked. The constraint applies even when CC might construct a plausible justification for acting.

- **Subagent context isolation**: When spawning a non-fork subagent, CC must provide complete, self-contained context in the prompt because the subagent starts with no visibility into the parent conversation. Delegating synthesis or decision-making to the subagent ("based on your findings, fix it") is prohibited; the orchestrating agent must understand and specify the work.

- **Side-question agent tool restriction**: The lightweight agent spawned to answer side questions during a main task has no tools available and must not offer to look things up, run commands, or take any actions. It is restricted to answering from already-available context or stating that it does not know.

---

## Default Behaviors

- **Response style in agentic contexts**: CC defaults to concise, action-oriented responses during autonomous operation. When there is nothing left to do, the default is a single sentence, not a narrative summary. Users can increase verbosity through CLAUDE.md style instructions, but the autonomous-loop default leans minimal.

- **Git staging granularity**: CC defaults to staging specific named files rather than using catch-all staging flags that would include everything in the working tree. Users can request broader staging explicitly, but the default protects against accidental inclusion of untracked sensitive files.

- **Commit message framing**: The default commit message policy emphasizes the purpose and rationale behind changes rather than a mechanical description of what changed. Users can specify alternative commit message styles in CLAUDE.md.

- **PR creation workflow**: CC defaults to a multi-step PR preparation sequence: parallel status/diff/log checks, analysis of all commits since branch divergence, title length enforcement, and body formatting via heredoc. Users can streamline this by providing explicit PR instructions, but the default is thorough.

- **Subagent prompt quality**: CC defaults to writing fully self-contained subagent prompts that brief the subagent as though it has no prior context. Short, command-style prompts are discouraged by default. This default can be overridden in CLAUDE.md by specifying a project-specific subagent prompting style, though the default produces more reliable results.

- **Autonomous loop pacing**: When operating in timer-driven autonomous mode, CC defaults to longer sleep intervals when the branch is quiet and shorter intervals when there is active work in flight. The fallback heartbeat delay range is pre-configured. Users can influence pacing through explicit loop configuration.

- **Documentation fetching preference**: CC defaults to fetching clean Markdown versions of documentation pages rather than MDX variants when both are available. This default can be changed by user instruction if a specific format is needed.

- **PR maintenance priority ordering**: In autonomous mode, the default priority order is: continuing work from the active conversation first, then PR maintenance (CI, review threads, branch freshness), then opportunistic code quality passes. This ordering is a default and can be adjusted via CLAUDE.md task-priority instructions.

- **Proxy CA trust configuration**: CC defaults to using pre-configured CA bundle environment variables for TLS. When a tool ignores these, CC's default is to look for the tool's own CA flag or config file and point it at the bundle, rather than disabling verification. Users cannot change the no-disable-verification rule, but can specify tool-specific CA paths.

---

## CLAUDE.md Redundancy Warning

- **Commit discipline**: The system context already encodes strong defaults against unsolicited commits, force operations, hook-skipping, and amend misuse. Adding equivalent commit safety instructions to CLAUDE.md is neutral to slightly redundant. If CLAUDE.md instructions are less restrictive than the system defaults (e.g., "feel free to commit when you think it's ready"), they may conflict with the hardcoded commit-on-request-only constraint and produce confusing behavior.

- **Git staging scope**: The system context already defaults to specific-file staging. CLAUDE.md instructions that say "only stage specific files" are entirely redundant. Instructions that say "always stage everything" directly conflict with the default and may or may not win depending on instruction precedence.

- **Subagent prompt quality**: The system context already instructs CC to write complete, context-rich subagent prompts. CLAUDE.md entries that re-specify "write self-contained prompts for subagents" are redundant. Entries that specify a project-specific subagent format or length cap are additive and useful.

- **Autonomous loop behavior**: If users are running CC in timer-driven autonomous mode, the loop policy is already configured in the system context. Adding "keep working autonomously" instructions to CLAUDE.md is redundant. Adding scope restrictions (e.g., "only work on files in src/") is additive and meaningful.

- **PR workflow steps**: The PR creation workflow (parallel checks, full diff analysis, heredoc body) is already specified. CLAUDE.md entries that duplicate "check git status before making a PR" are redundant. Entries that specify project-specific PR templates or required sections are additive.

- **Concise response style in autonomous mode**: The default minimal-output style in autonomous mode is already set. CLAUDE.md instructions to "be concise" in autonomous contexts are redundant. Instructions to "always explain your reasoning step by step" may conflict with the autonomous-mode conciseness default.

- **Documentation lookup behavior**: The live documentation URL table is embedded in the system context. CLAUDE.md entries that list documentation URLs for CC's own docs are redundant. Project-specific documentation URLs (for the user's own codebase) are not redundant and should be in CLAUDE.md.

---

## User Actionable Insights

1. **The commit gate is non-negotiable.** CC will not commit without explicit user direction, regardless of what CLAUDE.md says. Do not write CLAUDE.md rules that assume CC will commit on its own judgment — they will either be ignored or create instruction conflict.

2. **Tool denial produces a stop-and-explain, not a silent failure.** When a permission policy blocks a tool, CC is required to tell you what it was trying to do. If you see this message, you are being given an actionable choice: grant the permission or let CC stop. This behavior cannot be suppressed.

3. **Autonomous mode has a hard scope boundary.** If you deploy CC in timer-driven autonomous mode, it will only act on work established in the conversation transcript and on the current branch's PR state. It will not invent new tasks. If you want it to pursue a new goal, you must add it to the conversation before the next autonomous tick.

4. **The TLS/proxy layer is fixed for enterprise proxy environments.** If you are in a network that routes through an organization egress proxy, CC already knows how to configure CA trust for most major tools. You do not need to configure this in CLAUDE.md. If a specific tool is failing TLS, CC will attempt the CA fix automatically. Blocked hosts (403/407) are reported, not retried — filing a policy exception is the correct path.

5. **Side-question agents are intentionally tool-free.** The lightweight agent that answers questions during a main task cannot read files or run commands. If you need a side question answered that requires file access, you need to ask in the main conversation thread, not as a side question.

6. **Subagent prompts must be complete.** If you are using subagents, CC defaults to briefing them fully. If you find subagent results are shallow or miss context, the issue is usually insufficient context in the prompt — not a model capability issue. The system context already tells CC to include file paths, line numbers, and specific targets.

7. **Force-push to main always triggers a warning.** This is hardcoded. If your workflow legitimately requires force-pushing to the primary branch, expect CC to warn you every time. You cannot suppress this warning through CLAUDE.md.

8. **The live documentation URL table is version-specific.** The embedded documentation URLs point to the current Claude Code documentation as of v2.1.197. If documentation structure changes in a later version, these URLs may return stale or missing content. Check the changelog URL when upgrading versions.

9. **MCP and plugin configuration is handled by the system context.** The system context includes MCP discovery and connection workflows. CLAUDE.md entries that describe how to find or configure MCP servers are redundant for Claude Code's own MCP layer. Project-specific MCP server entries in `.mcp.json` remain the correct configuration path.

10. **Pre-commit hook failures require a new commit, not an amend.** This is hardcoded. If a pre-commit hook fails during a commit attempt, CC will fix the issue and create a new commit. It will not amend the previous commit. If your workflow uses amend-on-failure patterns, be aware that CC will deviate from that pattern by design.

---

## Tool & Permission Layer

The system context encodes a two-tier tool permission model. The first tier covers tools that CC may invoke without per-use confirmation under normal operating conditions; the second tier covers tools that require explicit user authorization before each invocation or class of invocations. The boundary between these tiers is defined by the potential for irreversibility and the scope of side effects.

**Hook event integration**: The system context recognizes hook events that fire at defined points in the tool execution lifecycle. These hooks allow external processes to observe or gate tool invocations. The telemetry layer (tengu_* events) instruments background process management, including memory pressure signals, process escalation, and spare-instance lifecycle events, giving the daemon visibility into resource state without user-visible behavior changes.

**System-reminder tag handling**: The system context defines a structured tag format used to inject ephemeral per-turn instructions into the conversation without those instructions appearing as user messages. The side-question agent mechanism uses this tag to establish the lightweight agent's constraints (no tools, single-response, no follow-up) at the start of its turn. Users encountering this tag in raw conversation logs should understand it as a system-injected behavioral frame, not user content.

**MCP server integration**: The system context includes guidance for discovering, connecting, and configuring MCP servers via a registry search and connector suggestion workflow. Plugin configuration that references MCP servers can use either HTTP or SSE transport types. Servers without static URLs (dynamic admin-provisioned endpoints) can be referenced by name rather than URL in the plugin configuration file.

**Context compression notice**: The autonomous loop system context includes awareness of context compaction events. When the conversation context is compacted between autonomous ticks, the loop prompt mechanism detects this and injects the full loop instructions on the first post-compaction fire, rather than the abbreviated reminder used on subsequent fires. This ensures behavioral continuity across compaction boundaries without user intervention.

**Egress proxy machinery**: For sessions running through an organization proxy, the system context embeds a complete diagnostic and remediation guide that CC uses to self-diagnose TLS failures across a wide range of tool ecosystems (Python, Node, JVM, Ruby, Go, Rust, curl, git, Docker). The proxy status endpoint is used as the first diagnostic step. This machinery operates transparently to the user unless a failure occurs.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.197 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `L` | UI helper functions assembler (collapsible panels, clipboard copy, histogram rendering) |
| `s` | SQL keyword list + side-question system-reminder tag injector |
| `l` | PostgreSQL type list + subagent prompt writing guidance with examples |
| `a` | Fork-mode subagent orchestration guidance and example turn sequences |
| `A` | Autonomous loop tick instruction assembler (run/arm/confirm/schedule/stop cycle) |
| `i` | Subagent prompt quality policy (briefing guidelines, delegation anti-patterns) |
| `M` | Authentication flow error message strings (cross-site block, expired code, wrong browser) |
| `D` | Subtask block property and event constant list |
| `c` | Job block property and event constant list |
| `E` | Pseudoreference code constant list |
| `x` | Business rule ID constant list |
| `h` | Dataset event name list + background process telemetry event registrations |
| `d` | Daemon config reload telemetry event registration |
| `ORt` | Zero-string assembler call (structural/glue role) |
| `H` | Zero-string assembler call (structural/glue role) |
| `m` | Zero-string assembler call (structural/glue role) |
| `u` | Zero-string assembler call (structural/glue role) |
| `g` | Zero-string assembler call (structural/glue role) |
| `f` | Zero-string assembler call (structural/glue role) |
| `w` | Zero-string assembler call (structural/glue role) |
| `v` | Zero-string assembler call (structural/glue role) |
| `I` | Analytics dashboard CSS + HTML rendering assembler |
| `p` | PostgreSQL SQLSTATE error code constant list |
| `RVo` | Tool-denial escalation and workaround-legitimacy policy message |
| `pLf` | Git commit safety protocol + PR creation workflow instructions |
| `tao` | Autonomous loop behavioral policy (scope, priority, pacing, termination) |
| `rMc` | Live documentation URL table for Claude Code docs (Mintlify-hosted) |
| `hgm` | Agent proxy TLS configuration and failure diagnosis guide |
| `ykc` | Files API Python reference (upload, use, manage, download patterns) |
| `NLc` | MCP discovery, registry search, connector suggestion, and plugin config workflow |