---
type: system-context
command: _system-context
cc_version: "2.1.196"
updated: "2026-06-30"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.196 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.196 System Context

> Analysis basis: CC v2.1.196 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.196 system context is assembled from multiple cooperating functions within the bundle, each contributing a distinct behavioral layer: role and identity declaration, tool usage policy, git and version-control procedure, sub-agent delegation protocol, autonomous loop governance, and network proxy configuration. Together these layers form a prioritized instruction stack that is evaluated before any user instruction or CLAUDE.md content. User instructions and CLAUDE.md can tune defaults within this stack but cannot override its absolute constraints. The system context also embeds self-documentation references — live URL tables that CC can consult when its bundled knowledge is insufficient — and an explicit side-channel response mechanism for lightweight parallel queries.

---

## Hardcoded Constraints

- **Tool-denial acknowledgment and escalation**: When a tool invocation is denied, CC is directed to consider whether the same goal is achievable through a functionally equivalent alternative tool that is within its current permissions. However, it is explicitly prohibited from circumventing the *intent* of the denial through indirect means — for example, exploiting test-running capabilities to execute unrelated system commands. If CC determines that the denied capability is genuinely essential to complete the request, it must halt, explain its intent and the specific permission gap to the user, and defer the decision about how to proceed entirely to the user. This constraint is absolute and applies regardless of task urgency or user pressure.

- **Destructive git operation gate**: A set of git operations classified as potentially irreversible — including force operations, hard resets, branch deletions, and wholesale working-tree restores — are blocked from autonomous execution. CC must receive explicit, unambiguous user instruction before executing any of these. Force-pushing to primary branches (main/master) triggers an additional mandatory warning even when the user has requested it. This constraint cannot be waived by CLAUDE.md.

- **Git hook bypass prohibition**: Skipping pre-commit or other git hooks (via flags that suppress verification or signing) is prohibited unless the user explicitly requests it. When a pre-commit hook fails, CC is required to fix the underlying issue and create a new commit rather than amending the previous one — amending after a hook failure is treated as a destructive action because it risks silently destroying prior committed work.

- **Sensitive file exclusion from commits**: CC will not stage or commit files that appear to contain secrets or credentials (environment files, credential stores, and similar) unless the user explicitly and directly instructs it to do so. Even then, CC issues a warning. This applies regardless of CLAUDE.md commit configuration.

- **Proxy integrity enforcement**: In proxied agent sessions, CC is prohibited from disabling TLS verification, unsetting the designated proxy environment variable, or routing traffic to bypass the organization egress policy. Hosts blocked by a 403 or 407 policy response must be reported rather than retried or circumvented. These are absolute constraints tied to the security model of the agent proxy infrastructure.

- **Sub-agent prompt quality gate**: When delegating to a sub-agent, CC is prohibited from writing prompts that push synthesis or understanding back onto the agent — phrases that amount to "based on your findings, do the thing" are explicitly out of bounds. CC must prove its own understanding in the prompt by including concrete specifics before delegation occurs. This is a hardcoded quality constraint on the delegation interface, not a stylistic suggestion.

- **Side-channel agent response scope**: A lightweight parallel-query agent spawned via the side-channel mechanism operates under absolute constraints: it has no tools, cannot take actions, cannot make promises to look things up, and must deliver a single terminal response. It is prohibited from referring to itself as interrupted or as having prior context beyond what the conversation provides. These constraints are structurally embedded in the side-channel invocation envelope and are not user-configurable.

- **Autonomous loop scope restriction**: When operating in autonomous timer-driven mode, CC is constrained to work that was already established by the user in the active conversation or in the current branch's pull/merge request. Inventing new work, initiating new directions, or making irreversible changes without prior authorization is treated as a trust violation. The constraint is behavioral rather than technical but is described as load-bearing for the autonomous operation model.

---

## Default Behaviors

- **Commit creation policy**: By default, CC does not create git commits unless the user explicitly requests one. This default is conservative — CC will stage, analyze, and draft commit messages preparatorily but will not finalize the commit action without a clear instruction. Users can instruct CC to commit as part of a workflow, but the default posture is to ask or wait.

- **Remote push policy**: Pushing to a remote repository is off by default. CC will not push even after a successful commit unless the user separately and explicitly asks for it. This applies both to regular pushes and to the initial upstream-tracking push (with the `-u` flag). Users can change this per-session through direct instruction.

- **Parallel tool execution**: CC defaults to running independent tool calls in parallel when multiple pieces of information are needed simultaneously and all calls are expected to succeed. This is a performance-oriented default for tasks like pre-commit inspection (status, diff, log all run together). Users can request sequential execution but parallel is the system default.

- **Git staging granularity**: When staging files for a commit, CC defaults to adding specific named files rather than using broad staging commands that capture everything in the working tree. This guards against accidentally staging sensitive or unintended files. Users who want broad staging must explicitly request it.

- **Commit message style**: CC defaults to drafting commit messages that focus on the reason for a change rather than a mechanical description of what changed. It also defaults to inspecting the repository's recent commit history to match the project's established style. Users can override preferred message format through CLAUDE.md or direct instruction.

- **Pull request body structure**: When creating pull requests, CC defaults to a structured body format including a summary section and a test plan checklist. It defaults to keeping PR titles short and placing detail in the body. Users can specify alternate PR templates or formats.

- **GitHub operations routing**: All GitHub platform operations (issues, PRs, checks, releases) are routed through the `gh` CLI by default. CC does not use alternative API approaches unless instructed. This is a tool-routing default, not an absolute restriction.

- **Sub-agent prompt delegation style**: When writing prompts for sub-agents, CC defaults to treating the agent as a smart peer with no prior context — providing full background, goals, already-ruled-out approaches, and explicit response format and length constraints. Users can adjust the depth of briefing through instruction but the self-contained briefing posture is the default.

- **Autonomous loop verbosity**: When an autonomous loop check finds nothing actionable, CC defaults to a single short status sentence and stops — it does not enumerate what it checked or speculate about future actions. After several consecutive null-result invocations, the default behavior is to reduce scope to a minimal check rather than continuing full sweeps.

- **Documentation lookup behavior**: When bundled references do not answer a question about CC's own behavior or configuration, CC defaults to consulting the live documentation URL index before generating an answer from prior knowledge. Users can suppress this by asking CC to answer from what it already knows.

- **Context compression notice**: CC includes a mechanism to notify the user when context compaction has occurred in a session, allowing the user to understand that the conversation history visible to CC has been summarized. This is a transparency default.

---

## CLAUDE.md Redundancy Warning

- **Commit-only-when-asked**: The system prompt already encodes a conservative "only commit when explicitly asked" posture with considerable emphasis. Adding a CLAUDE.md instruction to the same effect is redundant. A CLAUDE.md instruction that relaxes this (e.g., "always commit after completing a task") will conflict with the hardcoded destructive-action gate and may produce inconsistent behavior depending on task type.

- **No force-push to main**: The system prompt already prohibits force-pushing to primary branches and mandates a user warning. A CLAUDE.md instruction reiterating this is neutral redundancy. A CLAUDE.md instruction attempting to pre-authorize force pushes to main will be overridden by the hardcoded warning requirement.

- **Parallel tool calls**: The system prompt already instructs CC to run independent tool calls in parallel. CLAUDE.md instructions like "run commands efficiently" or "use parallel execution" duplicate an existing default. Instructions demanding strictly sequential execution will conflict and may degrade performance.

- **Commit message focus on "why"**: The system prompt already directs CC toward purpose-focused commit messages that adapt to the repository's existing style. CLAUDE.md entries like "write descriptive commit messages" are redundant. Specific format requirements (e.g., a Conventional Commits prefix format) are additive and non-conflicting — these are appropriate CLAUDE.md content.

- **PR body format**: The system prompt already defines a default PR summary-plus-test-plan structure. A CLAUDE.md instruction repeating this is redundant. Specifying a project-specific PR template or additional sections is additive and appropriate.

- **Sub-agent briefing depth**: The system prompt already instructs CC to write self-contained sub-agent prompts with full context. CLAUDE.md entries telling CC to "explain context when delegating" are redundant. Project-specific context to include in delegations (e.g., "always mention our database migration conventions") is additive and appropriate.

- **Sensitive file exclusion**: The system prompt already prohibits committing credential and environment files. A CLAUDE.md entry adding `.env` to a "never commit" list is partially redundant for the credential-detection heuristic but may be additive for project-specific sensitive file patterns not covered by the heuristic.

- **Documentation self-lookup**: The system prompt already directs CC to consult live documentation URLs when its bundled knowledge is insufficient. CLAUDE.md entries telling CC to "check the docs" before answering configuration questions are redundant for this specific domain.

---

## User Actionable Insights

1. **The tool-denial escalation path is non-negotiable.** If CC hits a denied tool and concludes no equivalent alternative exists, it will stop and ask — it will not attempt creative workarounds against the intent of the denial. Users who encounter this in automated pipelines should pre-grant the necessary permissions rather than hoping CC will find an alternative path.

2. **Explicit "please push" is required every time.** The system default never pushes automatically. Workflows that expect CC to push after committing must include an explicit push instruction in the same request or in a CLAUDE.md workflow definition. Omitting it is the most common source of "CC committed but the remote wasn't updated" confusion.

3. **Pre-commit hook failures must be fixed, not bypassed.** If a project's pre-commit hooks fail, CC will not use `--no-verify` or amend the prior commit. It will fix the issue and create a new commit. Users running in environments with flaky hooks (e.g., linters with network dependencies) should resolve the hook reliability issue rather than expecting CC to skip it.

4. **Autonomous mode is a steward, not an initiator.** The autonomous timer-driven loop is explicitly constrained to continuing work already established in the conversation or PR. It will not pick up new tasks, touch unrelated files, or make architectural decisions. Users configuring autonomous mode should ensure the active conversation context clearly establishes what work is in scope.

5. **Side-channel queries are tool-free and terminal.** The lightweight parallel query agent cannot look anything up, cannot run commands, and will not offer to do so. Users sending side-channel queries should ask questions answerable from the existing conversation context. Asking it to fetch a file or check a status will produce an honest "I cannot do that" response, not an attempt.

6. **CLAUDE.md git instructions should be additive, not duplicative.** The most valuable CLAUDE.md git content is project-specific: branch naming conventions, required PR labels, which CI checks are considered authoritative, project-specific sensitive file patterns, and commit message prefixes. General instructions like "be careful with git" or "don't force push" duplicate hardcoded behavior and add noise.

7. **The proxy CA configuration is pre-applied in proxied sessions.** Users running CC in a proxied agent environment do not need to manually configure TLS trust for most tools — the system context already sets up the CA bundle across multiple trust mechanisms. Manual intervention is needed only for tools that override environment CA settings via their own config files, or for container-isolated processes that cannot reach the proxy's loopback address.

8. **Sub-agent prompts require user-side synthesis.** CC will refuse to write delegation prompts that push understanding back onto the sub-agent. If a user instruction says "ask the agent to figure it out based on what you found," CC will push back. Users should expect to iteratively refine delegation prompts that include concrete file paths, line numbers, and specific questions — vague delegations will be rejected or rewritten.

9. **Live documentation URLs are bundled and version-specific.** CC v2.1.196 includes a hardcoded table of live documentation endpoints covering configuration, extensibility, workflow, and deployment topics. When CC consults these during a session, it is fetching current documentation that may be newer than the bundle's own bundled knowledge. Users debugging behavior differences between what CC knows and what the docs say should be aware this lookup path exists.

10. **MCP server configuration follows a discoverable pattern.** The system context includes a structured MCP discovery and connection workflow for plugin customization contexts. Users building plugins or custom skill configurations should use the `search_mcp_registry` → `suggest_connectors` → config-update workflow rather than manually editing MCP configuration files, as the system prompt guides CC through this sequence by default.

---

## Tool & Permission Layer

**Tool denial and alternative-path policy**: When a tool call is blocked — either by the permission model or by an explicit denial — CC evaluates whether a functionally equivalent alternative tool achieves the same goal within current permissions. If an alternative exists and is reasonable, CC may use it. If the workaround would circumvent the intent of the denial rather than simply find an alternative path, it is prohibited. When no acceptable path exists, CC surfaces the blocked capability to the user for a decision.

**Auto-allow vs. prompt-to-allow modes**: The system context distinguishes between tool operations that proceed automatically within established permission grants and those that require explicit per-invocation user confirmation. Destructive operations (irreversible git commands, broad file staging, force operations) are always in the prompt-to-allow category regardless of broader permission grants. Read-only and inspection operations are generally in the auto-allow category.

**Hook event handling**: CC's background process infrastructure emits lifecycle telemetry events associated with dispatch management, memory pressure signaling, and spare-instance lifecycle (claim and failure states). These hook events are part of the internal orchestration layer and are not directly user-configurable, but their presence indicates that CC's autonomous operation model has a daemon-level configuration reload path and spare-instance pooling for background tasks.

**System-reminder tag handling**: The bundle includes a structured `<system-reminder>` envelope used to inject contextual constraints into side-channel query agents. This tag signals to the receiving instance that it is operating in a constrained, tool-free, single-response mode. The envelope is injected by the CC orchestration layer and is not something users construct manually.

**Context compression notice**: When the system context is assembled for a session that has undergone context compaction, CC includes a notice in its response layer to inform the user that the conversation history available to it has been summarized. This transparency mechanism is part of the system prompt assembly, not a user-triggered behavior.

**MCP server injection**: MCP server configurations are resolved and injected into the session context at assembly time. The system context explains to CC how to discover, connect, and configure MCP servers within plugin customization workflows, including how to handle directory entries that have dynamic rather than static endpoint URLs.

**Agent proxy awareness**: In sessions routed through an organization egress proxy, the system context injects a complete proxy operational guide including diagnosis commands, per-tool CA configuration instructions, failure class taxonomy, and explicit prohibitions (no TLS bypass, no proxy circumvention, no retrying policy-denied hosts). This is assembled conditionally based on session environment detection.

**Sub-agent delegation machinery**: Two delegation patterns are described in the system context — a fork pattern (where the spawned agent shares conversation context and reports back asynchronously as a user-role message) and a fresh-start pattern (where the agent receives no prior context and must be fully briefed in the prompt). The coordinator agent is expected to understand which pattern is active and behave accordingly: the fork coordinator does not have the sub-agent's findings until the notification arrives; it must not fabricate results while waiting.

**Autonomous loop scheduler integration**: The timer-driven autonomous loop uses a structured scheduling protocol with explicit delay parameters, a sentinel prompt value that expands dynamically at fire time, and an optional persistent monitor that can wake the loop early on specific events (CI completion, PR comments). The loop termination condition is explicit: omit the rescheduling call and cancel any active monitors. The system context embeds the full loop protocol description as a self-instruction to CC, making loop behavior predictable and auditable from the bundle.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.196 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `L` | UI analytics dashboard — collapsible sections, clipboard copy helpers, timezone-adjusted usage histogram renderer |
| `s` | Dual-purpose: PostgreSQL keyword list for syntax highlighting; side-channel system-reminder envelope injector |
| `l` | PostgreSQL type keyword list; sub-agent delegation prompt examples (fresh-start pattern with full briefing) |
| `a` | Sub-agent fork delegation protocol examples (fork pattern with async notification and coordinator wait behavior) |
| `A` | Autonomous timer loop scheduling protocol — delay selection, monitor arming, sentinel prompt, loop termination |
| `i` | Sub-agent prompt writing guidelines — briefing depth, context requirements, anti-patterns for delegation prompts |
| `M` | Authentication flow user-facing error messages — cross-origin block, expired code, wrong-browser verification |
| `D` | Subtask block property and event constant list for workflow orchestration schema |
| `c` | Job block property and event constant list for workflow orchestration schema |
| `E` | Pseudo-reference code constant list for access control and component reference resolution |
| `x` | Business rule ID constant list for reference record validation and auto-numbering rules |
| `h` | Dataset event name constants; background process telemetry hook registrations (dispatch, memory, spare-instance) |
| `d` | Daemon configuration reload telemetry event emitter |
| `Okt` | Assembly coordinator (no large strings; role inferred from call graph position) |
| `H` | Assembly coordinator (no large strings; role inferred from call graph position) |
| `m` | Assembly coordinator (no large strings; role inferred from call graph position) |
| `u` | Assembly coordinator (no large strings; role inferred from call graph position) |
| `g` | Assembly coordinator (no large strings; role inferred from call graph position) |
| `f` | Assembly coordinator (no large strings; role inferred from call graph position) |
| `w` | Assembly coordinator (no large strings; role inferred from call graph position) |
| `v` | Assembly coordinator (no large strings; role inferred from call graph position) |
| `I` | Stats dashboard HTML/CSS renderer — session analytics UI, CLAUDE.md action cards, friction category display |
| `p` | PostgreSQL SQLSTATE error code and condition name list for error handling reference |
| `CVo` | Tool-denial alternative-path policy and user escalation instruction block |
| `tLf` | Git workflow instructions — commit protocol, PR creation protocol, safety rules, gh CLI routing |
| `Qio` | Autonomous loop behavioral governance — scope constraints, PR maintenance protocol, repeated-invocation rules |
| `qkc` | Live documentation URL index — mintlify endpoint table for configuration, extensibility, workflow, deployment topics |
| `sgm` | Agent proxy operational guide — CA trust setup, failure taxonomy, per-tool fix instructions, prohibition list |
| `lRc` | Files API Python reference — upload, message usage, management operations, end-to-end example |
| `CLc` | MCP discovery and connection workflow — registry search, connector suggestion, config file format, examples |