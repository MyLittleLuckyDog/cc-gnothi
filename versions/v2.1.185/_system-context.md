---
type: system-context
command: _system-context
cc_version: "2.1.185"
updated: "2026-06-21"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.185 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.185 System Context

> Analysis basis: CC v2.1.185 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.185 system context is assembled from multiple cooperating functions within the bundle, each contributing distinct behavioral layers: security and permission policy, agent role definition, tool invocation guidance, git and SCM workflow rules, subagent orchestration instructions, and autonomous loop governance. These layers are combined at runtime into a unified system prompt that CC receives before any user instruction. The system context sits above CLAUDE.md in the authority hierarchy for hardcoded constraints, but most stylistic and workflow defaults it establishes can be shaped or overridden by CLAUDE.md or direct user instruction within the permitted envelope. Its relationship to user instructions is layered: absolute constraints cannot be overridden by any instruction source, while defaults represent starting positions that user configuration can shift.

---

## Hardcoded Constraints

- **Permission-denial handling**: When a tool invocation is denied by the permission system, CC is directed to acknowledge the denial and, where reasonable, attempt functionally equivalent approaches using other permitted tools. Circumventing the intent of a denial through indirect means (for example, using a test harness to execute arbitrary non-test actions) is explicitly prohibited regardless of user instruction. If the blocked capability is genuinely essential to complete the task, CC must stop and explain this to the user rather than silently proceeding with a workaround. This constraint is absolute and cannot be lifted by CLAUDE.md or conversational instruction.

- **Destructive git operations**: A set of git operations classified as destructive — including force-push variants, hard reset, aggressive clean, branch deletion, and others — are blocked from autonomous execution unless the user has provided an explicit, unambiguous instruction for that specific action in the current turn. Running these operations speculatively or as a "cleanup" step without direct authorization is not permitted. Force-pushing to protected branch names triggers an additional warning to the user regardless of authorization. This policy is enforced at the system level and is not softened by project-level CLAUDE.md entries.

- **Git hook bypass prohibition**: Bypassing pre-commit or other git hooks via flags that skip verification is blocked unless the user explicitly requests it. When a pre-commit hook fails, CC must not amend the previous commit; it must fix the issue and create a new commit. These rules are absolute within the git workflow layer.

- **Sensitive file exclusion from commits**: Files that structurally resemble credential stores or environment variable files are excluded from staging and commit operations unless the user explicitly requests their inclusion. If explicitly requested, CC issues a warning rather than silently complying.

- **Autonomous loop scope constraint**: During timer-driven autonomous operation, CC is constrained to continuing work the user has already authorized and set in motion. Initiating entirely new work streams, making irreversible changes without clear prior authorization from the conversation transcript, or acting on ambiguous signals is prohibited. The governing principle is stewardship of established work rather than self-directed initiative. This constraint is structural to the autonomous loop system prompt and cannot be overridden by CLAUDE.md alone.

- **Subagent prompt completeness requirement**: When delegating to a subagent (non-fork variant), CC is required to include all necessary context in the delegated prompt, since the subagent starts without the parent conversation's context. Prompts that push synthesis or decision-making onto the subagent ("based on your findings, fix it") rather than proving the parent's understanding are prohibited by the behavioral guidelines embedded in the orchestration layer.

- **Side-question agent tool restriction**: The lightweight agent spawned to handle side questions operates with no tools available and is constrained to a single response. It cannot make promises to look up information, run commands, or take actions. This is enforced by the system-reminder tag injected for that agent type.

---

## Default Behaviors

- **Pull request creation workflow**: By default, CC executes a multi-step parallel information-gathering sequence before drafting a PR — inspecting branch status, staged and unstaged diffs, commit history relative to the base branch, and remote tracking state. The PR title is kept concise and the body is structured with a summary and test plan. Users can influence the PR body structure and title conventions via CLAUDE.md, but the underlying safety checks (checking divergence, verifying remote state before push) remain as defaults.

- **Commit message style**: CC defaults to drafting commit messages that focus on the rationale for a change rather than a mechanical description of what changed, and keeps messages concise. It inspects recent commit history to match repository conventions. Users can override the preferred style via CLAUDE.md instructions specifying a different convention, and this is a purely stylistic default with no hardcoded floor.

- **Parallel tool execution**: Where multiple independent information-gathering operations are needed, CC defaults to running them concurrently rather than sequentially. Users do not typically need to instruct this; it is the default posture for tool calls that have no ordering dependency.

- **Autonomous loop verbosity**: During autonomous operation, when there is genuinely nothing to do, CC defaults to a single brief statement and stops — no enumeration of what was checked, no speculative next-step list. After several consecutive idle results, the default is to reduce scope to a minimal check. This default can be influenced by explicit loop configuration but is the baseline behavior.

- **Subagent prompt delegation style**: CC defaults to writing subagent prompts that are self-contained and fully briefed, treating the subagent as a colleague with no prior context. The default is to include goal, relevant background, what has been tried, and a scoped output format. Users can adjust the expected output format and length constraints by configuring how CC constructs delegation prompts, though the self-containment requirement is structural.

- **Live documentation retrieval**: When bundled references do not cover a topic, CC defaults to consulting live documentation endpoints. The documentation source map embedded in the system context provides a structured index of topic-to-URL mappings. Users can influence this by pointing CC to alternative or internal documentation sources in CLAUDE.md.

- **Context compression acknowledgment**: When the conversation context is compressed, CC receives a system-reminder notification about the compression event. The default behavior is to absorb this notification and continue without surfacing it unnecessarily to the user. This is a default that does not require user configuration.

- **SCM CLI preference for GitHub operations**: All GitHub-related operations default to using the CLI tooling rather than direct API calls or web UI instructions. Users can influence specific command formatting but the CLI-first default is strongly established in the system context.

---

## CLAUDE.md Redundancy Warning

- **Commit message conventions**: The system context already instructs CC to inspect recent commit history and match the repository's existing style. Adding a commit message format specification to CLAUDE.md is not harmful and can be useful for enforcing a specific convention, but if the CLAUDE.md specification conflicts with what the repository history shows, the explicit instruction takes precedence and may produce inconsistency. Duplication is neutral-to-useful; conflict is potentially disruptive.

- **PR body structure**: The system context already establishes a default PR body format. If CLAUDE.md specifies an alternative PR template or structure, the explicit instruction overrides the default — this is the intended behavior and not a conflict. Users who want a custom PR format should put it in CLAUDE.md. Redundant duplication of the default format in CLAUDE.md is neutral.

- **Avoiding destructive git commands**: The system context already blocks these without explicit instruction. Adding a CLAUDE.md rule like "never force push" is completely redundant for the protected cases and adds no safety margin, since the constraint is enforced at a layer below CLAUDE.md. It is not harmful, but creates a false impression that the protection comes from the CLAUDE.md rule.

- **Parallel tool execution instruction**: Instructing CC to "run tools in parallel where possible" in CLAUDE.md is redundant — this is already the default. The instruction does not hurt but occupies CLAUDE.md space unnecessarily.

- **Subagent briefing quality**: The system context already instructs CC to write self-contained, well-briefed subagent prompts. Adding equivalent guidance to CLAUDE.md (e.g., "always fully brief delegated agents") is redundant. If the CLAUDE.md instruction conflicts with the system-level guidance (e.g., specifying a terse format for subagent prompts), the explicit instruction may win but could degrade subagent quality.

- **Autonomous loop behavior when idle**: The system context already specifies the correct idle behavior. Adding instructions like "if nothing to do, say so briefly" to CLAUDE.md is redundant. Conflicting instructions (e.g., "always summarize what you checked") may override the default and produce verbose autonomous output.

- **Live documentation lookup**: The system context already configures when and how CC fetches live docs. Redundant CLAUDE.md instructions pointing to the same documentation endpoints add no value. However, CLAUDE.md entries pointing to project-specific or internal documentation sources that supplement the defaults are additive and useful.

---

## User Actionable Insights

1. **The permission-denial workaround policy cannot be overridden.** If a tool permission is denied, CC will look for reasonable alternative approaches but will not attempt to circumvent the denial's intent. No CLAUDE.md entry or conversational instruction changes this. Users who need a blocked capability must explicitly grant the permission through the permissions system, not by asking CC to work around it.

2. **Destructive git operations require explicit per-turn instruction.** A CLAUDE.md entry that says "you may force-push when needed" does not constitute sufficient authorization — CC requires an explicit instruction in the current conversational turn for each destructive action. Users who routinely need these operations should expect to authorize them explicitly each time.

3. **The autonomous loop is scope-bounded by design.** CC running on a timer will not expand into new work that wasn't already established in the conversation. Users who want autonomous coverage of new areas must explicitly instruct those areas before the loop is armed. This is not a bug or limitation to work around; it is the designed trust model.

4. **The side-question lightweight agent has no tools.** When CC spawns a side-question agent, that agent cannot read files, run commands, or verify anything — it can only respond from conversation context. Users should not expect side-question responses to reflect file system state or command output; those require the main agent.

5. **CLAUDE.md cannot lower the floor on git safety.** The git safety protocol is enforced below the CLAUDE.md layer. Users cannot use CLAUDE.md to grant blanket authorization for destructive operations; those require explicit per-request instruction.

6. **Subagent prompts should be pre-synthesized by the user.** The system context teaches CC to write self-contained subagent prompts, but the quality of delegation depends on what the parent agent understands. Users who provide vague tasks to CC will get vague subagent prompts downstream. Providing specific file paths, line numbers, and concrete questions to CC improves delegation quality structurally.

7. **Live documentation is consulted automatically when needed.** Users do not need to tell CC to check the documentation — the system context already includes a structured source map. However, for project-internal documentation, adding source URLs to CLAUDE.md does extend this capability in a meaningful way.

8. **Version v2.1.185 includes an explicit autonomous loop management layer** with timer-armed wakeup, event-gated monitor support, and fallback heartbeat scheduling. Users operating CC in autonomous/daemon mode should understand that this loop system has its own prompt and constraints separate from the interactive session system prompt.

9. **MCP server configuration is handled through structured discovery** (`search_mcp_registry` → `suggest_connectors` → config update). Users who manually maintain `.mcp.json` files should be aware that CC understands the MCP configuration format natively and can update it programmatically during plugin customization workflows.

10. **Context compression is a known, handled event.** The system context includes machinery to notify CC when compression occurs. Users who notice behavioral discontinuity after long sessions are experiencing a documented system behavior, not an error. Pinning critical context in CLAUDE.md reduces the impact of compression on project-specific knowledge.

---

## Tool & Permission Layer

The permission system in v2.1.185 operates in two modes: auto-allow (for tools and operations that fall within pre-authorized scope) and prompt-to-allow (for operations outside that scope). The system context instructs CC on how to behave when a tool invocation is denied: acknowledge the denial, consider whether a functionally equivalent permitted approach exists, and if no reasonable alternative exists, stop and explain the situation to the user rather than proceeding with workarounds that circumvent the denial's intent.

Hook events are handled as lifecycle signals that CC must respect — pre-commit hooks in particular receive explicit treatment, with the constraint that hook failures must result in new commits rather than amended ones. This prevents hook failures from silently corrupting commit history.

The `<system-reminder>` tag is used by the runtime to inject context-specific behavioral constraints into specific agent instances. The side-question agent receives a system-reminder that establishes its tool-free, single-response operating mode. This tag mechanism allows the runtime to specialize CC's behavior for different invocation contexts without modifying the base system prompt.

MCP server integration is supported through a discovery-and-configuration workflow: CC can search a registry, present connection options to users, and update plugin MCP configuration files. Both HTTP and SSE transport types are supported, and configuration can reference servers by name when URL-based addressing is not available.

Context compression events are surfaced to CC via a notification mechanism. When compression occurs, CC receives a signal indicating that prior context has been shed. The behavioral default is to absorb this and continue; the system context does not instruct CC to alert the user unless the compression materially affects the current task.

The background process manager embedded in the bundle manages worker lifecycle (spawning, memory pressure response, SIGKILL escalation, spare worker pre-warming) through telemetry-instrumented functions. These operate below the conversational layer and are not directly configurable through CLAUDE.md.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.185 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `L` | UI dashboard assembler — collapsible/copy controls, usage histogram, analytics report renderer |
| `s` | SQL keyword lexer data + side-question system-reminder tag injector |
| `l` | PostgreSQL type keyword lexer + subagent delegation prompt examples (non-fork variant) |
| `a` | Fork-mode subagent orchestration prompt examples and coordinator turn-handling guidance |
| `E` | Autonomous loop step instructions — timer arming, event monitor, heartbeat scheduling, loop termination |
| `i` | Subagent prompt-writing guidelines — context briefing, delegation quality rules |
| `M` | Subtask block property and event constant registry |
| `c` | Job block property and event constant registry |
| `y` | Pseudo-reference code constant registry (access types, components, groups, settings) |
| `x` | Business rule ID constant registry (numeration, requisite, interval, firm-context rules) |
| `h` | Dataset event name constant registry (dse* and re* event identifiers, route selection events) |
| `d` | Daemon config reload telemetry handler (no string content) |
| `f` | Background worker dispatch and memory pressure telemetry handler |
| `JSt` | Zero-content assembler call (role undetermined from string analysis) |
| `g` | Zero-content assembler call (role undetermined from string analysis) |
| `m` | Zero-content assembler call (role undetermined from string analysis) |
| `u` | Zero-content assembler call (role undetermined from string analysis) |
| `A` | Zero-content assembler call (role undetermined from string analysis) |
| `k` | Zero-content assembler call (role undetermined from string analysis) |
| `w` | Zero-content assembler call (role undetermined from string analysis) |
| `v` | Zero-content assembler call (role undetermined from string analysis) |
| `I` | Full analytics dashboard HTML/CSS renderer (UI report page) |
| `p` | PostgreSQL SQLSTATE error code and condition name lexer data |
| `j0o` | Permission-denial behavioral instruction — workaround policy and user escalation guidance |
| `B$p` | Git workflow system prompt — commit protocol, PR creation steps, git safety rules |
| `Q6r` | Autonomous loop check prompt — stewardship scope, PR maintenance, idle behavior, repeated invocation rules |
| `rJl` | Live documentation source map — topic-to-URL index for fetching current CC docs |
| `EYl` | Files API reference (Python) — upload, use, manage, download patterns |
| `UKl` | MCP discovery and connection workflow — registry search, connector suggestion, config update |
| `kYl` | Claude API reference (Ruby) — client init, messages, thinking, caching, beta features |