---
type: system-context
command: _system-context
cc_version: "2.1.199"
updated: "2026-07-03"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.199 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.199 System Context

> Analysis basis: CC v2.1.199 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.199 system context is assembled from multiple cooperating functions embedded in the bundle, each contributing a distinct behavioral layer: role declaration, security and permission policy, tool operation rules, task-mode guidance, git safety protocol, subagent orchestration, and proxy/network configuration. Together these layers establish what CC will and will not do before any user instruction or CLAUDE.md content is considered. User instructions and CLAUDE.md can adjust defaults within this envelope but cannot override the hardcoded constraint set. The assembled context is injected at session start and is supplemented at runtime by system-reminder tags, MCP server declarations, and context-compression notices.

---

## Hardcoded Constraints

- **Destructive git operation block**: Force-push, hard reset, branch deletion, and checkout-obliterate commands are categorically blocked unless the user provides an explicit, unambiguous instruction in that same interaction. This restriction cannot be lifted by CLAUDE.md or general project instructions; it requires direct per-instance authorization.

- **Commit hook bypass prohibition**: Skipping pre-commit or GPG-signing hooks is blocked by default. The restriction exists to prevent silent corruption of repository history and can only be lifted by explicit user instruction on a per-commit basis.

- **Sensitive-file staging guard**: Automatic staging approaches that could include credential files, environment variable files, or large binaries are blocked in favor of explicit per-file staging. This is an absolute default; the user can instruct otherwise but CC will warn before acting.

- **Force-push to protected branches**: Pushing with force to main or master branches is prohibited and triggers a user warning even when the user explicitly requests it. This is the one area where CC may decline even an explicit instruction, surfacing a warning rather than complying silently.

- **Tool-denial circumvention block**: When a tool invocation is denied, CC may attempt reasonable alternative tools that serve the same legitimate purpose. However, using any tool's side-effects as a workaround to bypass the intent of the denial is prohibited. If no legitimate path exists, CC must halt and explain the situation to the user.

- **Emoji suppression in assistant output**: Emoji characters are excluded from CC's responses as a hardcoded style rule. This is not a default that users can toggle via conversational instruction alone; it is enforced at the system layer.

- **Colon-before-tool-call prohibition**: Introducing a tool invocation with a colon following prose is blocked in favor of a period, enforcing a specific syntactic pattern in mixed prose-and-tool output.

- **Report-file creation block for subagents**: Subagents operating in task contexts are prohibited from writing their findings to markdown report or summary files and returning a file path. Findings must be returned as direct text output. Files written as inputs to downstream tools are permitted; terminal summary files are not.

- **Path reporting format**: When sharing file paths in responses, only absolute paths are permitted. Relative paths are blocked in output regardless of user instruction.

- **TLS verification**: Disabling TLS certificate verification in any tool or subprocess is prohibited. Similarly, unsetting the proxy environment variable that routes traffic through the policy-enforcing egress layer is blocked. Organization-level policy denials from the egress proxy must be reported to the user, not routed around.

- **Proxy bypass prohibition**: When the egress proxy returns an organization policy denial, CC must not retry or attempt alternative routing. The blocked destination must be surfaced to the user.

---

## Default Behaviors

- **Code-snippet inclusion in responses**: By default, CC includes code snippets only when the exact text is materially load-bearing for the user's task (e.g., a specific bug, a required function signature). Routine recaps of code that was merely read are omitted. Users can request broader code inclusion; the default conserves context and response size.

- **Commit creation gate**: CC does not create commits unless the user explicitly requests one. This default prevents autonomous history modification. Users can request commits directly; CLAUDE.md can establish project-level conventions but cannot pre-authorize commits in general.

- **Push gate**: CC does not push to remote repositories unless the user explicitly requests it. This applies even after a commit is created. Background-session and worktree modes have a modified default: when CC has entered an isolated worktree itself, shipping (commit + push + draft PR) is part of the task and proceeds without a separate prompt.

- **PR creation in background/worktree sessions**: When CC isolates work in a worktree it entered autonomously, opening a draft pull request is the default completion action. Users can suppress this with an explicit instruction or when no remote exists.

- **Autonomous loop conservatism**: In timer-driven autonomous sessions, CC defaults to acting only on work that is already established in the conversation transcript or the current branch's pull request. Initiating new work outside that scope is not the default. Users cannot expand this scope through CLAUDE.md; the boundary is re-evaluated each loop tick from the transcript.

- **Parallel tool execution**: When multiple independent information-gathering commands are needed, CC defaults to batching them in parallel. This is a performance default and can be overridden by explicit sequencing instructions.

- **Subagent prompt completeness**: When delegating to a subagent, CC defaults to writing self-contained prompts that include full context — file paths, background, what has already been ruled out, and a defined output format. The user can constrain delegation behavior via explicit instruction.

- **Rebase over merge for branch synchronization**: When a branch needs to be brought up to date with its base during autonomous PR maintenance, rebase is the default strategy. Merge is not used for this purpose.

- **Worktree isolation before editing**: When operating as a background agent, CC defaults to entering an isolated worktree before making file edits. If isolation fails, CC falls back to working in place and adjusts the commit/push behavior accordingly.

- **Context-aware delay in autonomous loop**: The timer delay between autonomous loop ticks is chosen dynamically based on observed activity level rather than a fixed interval, with longer waits for quiet branches and shorter waits for active ones. Users can influence this indirectly by the state of the repository and PR.

- **Side-question agent behavior**: When a side question arrives during an active session, a separate lightweight instance handles it without tools and without interrupting the main agent. This instance acknowledges no ability to take actions and does not promise follow-up. Users cannot configure this dispatch mechanism.

---

## CLAUDE.md Redundancy Warning

- **Emoji prohibition**: The system context already enforces emoji-free output. Adding an "avoid emoji" instruction to CLAUDE.md is fully redundant. It does not conflict, but it has no effect.

- **Absolute path requirement**: The requirement to report absolute paths is already set at the system layer. Restating it in CLAUDE.md is neutral but unnecessary.

- **Commit-only-when-asked rule**: This is already enforced as a default. A CLAUDE.md instruction repeating this adds no protection. A conflicting instruction — such as "commit after each completed task" — may override the default, which could be the user's intent but should be understood as a deliberate override rather than a reinforcement.

- **Code quality and simplicity preferences**: The system context already instructs CC away from over-engineering and speculative additions. CLAUDE.md entries like "keep code simple" or "avoid unnecessary abstractions" are redundant. Conflicting instructions (e.g., "always add defensive error handling for every edge case") may create instruction tension.

- **No force-push rule**: The force-push prohibition is hardcoded. Restating it in CLAUDE.md is harmless but has no enforcement effect beyond what is already present.

- **PR workflow conventions**: The system context already defines a detailed PR creation workflow including title length, body structure, and use of heredoc formatting. CLAUDE.md entries that specify PR conventions may conflict with or partially duplicate this. Users who want to change the PR body format should use CLAUDE.md explicitly, understanding they are overriding a system default, not establishing one from scratch.

- **Subagent prompt-writing style**: The system context already defines how subagent prompts should be written (self-contained, include context, specify output format, avoid vague delegation). Adding similar guidance to CLAUDE.md is redundant for the built-in subagent tools but may be useful for custom skill or MCP-based agents that do not inherit this guidance directly.

- **Git staging preferences**: The preference for per-file staging over bulk staging is already set. A CLAUDE.md entry like "always use git add -A" would directly conflict and would be followed, potentially including files CC would otherwise warn about.

---

## User Actionable Insights

1. **Force-push and hook-skip require explicit per-turn instruction.** These cannot be pre-authorized in CLAUDE.md. If your workflow requires them regularly, you must instruct CC each time. A CLAUDE.md entry permitting them will not be honored.

2. **Background sessions have a shifted default for commits and PRs.** In worktree-isolated background jobs, CC will commit, push, and open a draft PR without asking. If you do not want a PR opened, say so explicitly in the task prompt or initial instruction.

3. **The autonomous loop will not invent new work.** If the conversation transcript and current PR are both clean, CC will report nothing to do and stop. It will not go looking for unrelated improvements. This is by design, not a limitation to work around.

4. **Side-question agents have no tools.** When CC spawns a lightweight instance to answer a mid-session question, that instance cannot read files, run commands, or take any action. It answers from context only. Do not expect it to verify current state.

5. **TLS and proxy configuration is managed by CC, not by you.** In environments that route through a policy-enforcing egress proxy, CC knows how to diagnose and fix most certificate and proxy errors across common tool ecosystems. You do not need to configure this in CLAUDE.md. If a destination is blocked by organization policy, CC will tell you — it will not attempt to route around it.

6. **Subagent prompts are CC's responsibility to write well.** CC is instructed to write self-contained, context-rich prompts when delegating. If subagent results are shallow or miss context, the issue is likely in how you framed the delegation request to CC, not in subagent prompt construction.

7. **Report files from subagents will not be created.** If you ask a subagent-mode task to "write up findings in a markdown file," it will not do so. It will return findings as text. Design your workflows to consume text output, not file artifacts.

8. **The system context includes live documentation URLs.** CC has access to the current Claude Code documentation index and can fetch up-to-date references for settings, permissions, hooks, MCP, and other topics. If CC's bundled knowledge and your project context do not answer a configuration question, CC can fetch current docs without you supplying the URL.

9. **Git commit messages default to a specific style.** CC will inspect recent commit history to match the repository's existing message style. If your project has a commit message convention, having a few recent commits that follow it is more effective than describing it in CLAUDE.md.

10. **Version-specific note:** The behavior described in this document reflects v2.1.199. The autonomous loop sentinel value, proxy status endpoint path, worktree isolation logic, and subagent dispatch behavior are all version-specific and may change in subsequent releases. Check the changelog before assuming these behaviors are stable across upgrades.

---

## Tool & Permission Layer

**Auto-allow vs. prompt-to-allow:** The system context establishes two permission modes for tool invocations. In auto-allow mode, tools that fall within a pre-approved scope proceed without confirmation. In prompt-to-allow mode, CC pauses and surfaces the pending action to the user before proceeding. The boundary between these modes is defined by the tool type, the action's reversibility, and any permission rules established via the settings layer. Users can shift individual tools between modes through the permissions configuration; the system context itself does not hard-code specific tools into one mode permanently (with the exception of the destructive git operations noted in Hardcoded Constraints).

**Tool-denial handling:** When a tool invocation is denied — either by user permission rules or by the permission layer at runtime — CC is instructed to attempt reasonable alternative tools that could accomplish the same legitimate goal. It may not use tool side-effects to circumvent the intent of the denial. If no compliant path exists, it must stop and explain what it was attempting and what permission it needs, leaving the decision to the user.

**Hook event behavior:** The system context acknowledges a hook event system that fires at defined points in CC's operation lifecycle. These hooks allow external processes to intercept or observe CC's actions. CC is aware of hook events as part of its operating environment; hook configuration itself is managed outside the system context in the `.claude/` directory structure.

**MCP server integration:** MCP servers are surfaced to CC through the system context assembly process. CC treats MCP-provided tools with the same permission logic as built-in tools. The system context does not grant MCP tools elevated trust; they are subject to the same auto-allow/prompt-to-allow determination as native tools.

**System-reminder tag handling:** Certain runtime injections arrive via a `<system-reminder>` tag rather than as part of the initial system context. These are treated as authoritative behavioral instructions for the duration of the relevant turn or sub-session. The side-question agent mode is delivered this way — as a runtime system-reminder that redefines the agent's role, tool access, and response constraints for that instance.

**Context compression notice:** The system context prepares CC to recognize when the conversation context has been compressed. When a compression event has occurred, CC adjusts its behavior to account for the fact that earlier turns may not be fully represented, particularly in autonomous loop scenarios where prior check results inform current action scope.

**Worktree isolation enforcement:** File edit tools are aware of the worktree isolation requirement in background sessions. Edits attempted in the shared checkout before isolation is established are rejected at the tool layer, not just advised against. CC is instructed to call the isolation tool before the first edit rather than discovering the rejection reactively.

**Temporary file directory:** Background sessions are instructed to use a job-specific temporary directory rather than the system-wide `/tmp`, because parallel background jobs share the filesystem and will overwrite each other's temporary files. This is a tool-usage policy enforced through the system context, not a filesystem permission.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.199 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `s` | System context assembler — combines SQL keyword lists, side-question system-reminder injection, and subagent output formatting rules |
| `L` | Analytics dashboard UI renderer — collapsible sections, clipboard copy, timezone histogram for usage charts |
| `a` | Coordinator-mode subagent orchestration — fork/non-fork subagent examples, plan-file workflow phases |
| `l` | PostgreSQL type keyword list + secondary subagent usage example block |
| `b` | Autonomous loop tick instruction block — timer arming, sentinel prompt, wake-signal and fallback-delay logic |
| `i` | Subagent prompt-writing guidelines — context briefing rules, delegation anti-patterns |
| `R` | Auth/verification error message strings — cross-site block, expired code, wrong-browser notices |
| `D` | Subtask block property and event constant list |
| `c` | Job block property and event constant list |
| `E` | Pseudo-reference code constant list |
| `x` | Validation and numeration rule ID constant list |
| `h` | Dataset event name list + background process telemetry event registrations |
| `d` | Daemon config-reload telemetry event registration |
| `IPt` | Stub assembler — no large strings, no telemetry |
| `H` | Stub assembler — no large strings, no telemetry |
| `m` | Stub assembler — no large strings, no telemetry |
| `u` | Stub assembler — no large strings, no telemetry |
| `g` | Stub assembler — no large strings, no telemetry |
| `f` | Stub assembler — no large strings, no telemetry |
| `v` | Stub assembler — no large strings, no telemetry |
| `w` | Stub assembler — no large strings, no telemetry |
| `I` | Dashboard HTML/CSS renderer — full UI stylesheet and layout for the analytics report page |
| `p` | PostgreSQL SQLSTATE error code and condition name list |
| `sJo` | Tool-denial guidance block — alternative-tool policy and escalation-to-user instruction |
| `gSm` | Background session context block — worktree isolation enforcement, shipping defaults, job-scoped temp directory policy |
| `M7p` | Git workflow blocks — PR creation protocol and commit safety protocol |
| `epo` | Autonomous loop behavioral policy — stewardship scope, PR maintenance priority, repeated-invocation scope adjustment |
| `qBc` | Live documentation URL index — Mintlify endpoint table for settings, permissions, hooks, MCP, and deployment references |
| `xLm` | Agent proxy configuration block — TLS re-termination, CA bundle setup, failure class diagnostics and fixes |
| `l2c` | Files API reference — Python SDK usage for upload, message integration, list, retrieve, delete, download |