---
type: system-context
command: _system-context
cc_version: "2.1.198"
updated: "2026-07-02"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.198 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.198 System Context

> Analysis basis: CC v2.1.198 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.198 system context is assembled by combining output from multiple distinct functions within the bundle, each contributing a slice of the overall behavioral specification — role declaration, tool-use policy, git interaction rules, subagent orchestration guidance, proxy/network configuration, and task-loop behavior. Together these layers form a layered instruction set that CC resolves in a fixed priority order: hardcoded constraints take precedence, then system-context defaults, then CLAUDE.md, and finally per-turn user instruction. The system context is not a single monolithic prompt but a composition of modular sections injected at session initialization. Users interacting via CLAUDE.md or direct instruction are always operating on top of this pre-existing configuration, which means some defaults are already set before the user says anything.

---

## Hardcoded Constraints

- **Tool-denial workaround boundary**: When a tool call is denied, CC is permitted to attempt the same goal using functionally equivalent alternative tools or approaches — for example, substituting a narrower read command for a broader one. However, it is unconditionally blocked from using any capability (such as test execution) to smuggle through actions that are semantically unrelated to the original intent. The distinction between "reasonable alternative" and "bypass attempt" is enforced by design intent, not just surface behavior. If no compliant path exists, CC must stop, explain what it was trying to do, and return the decision to the user.

- **Emoji suppression in task-oriented output**: Output produced during agentic or task-completion flows must not include emoji characters. This applies regardless of user stylistic preferences expressed in-turn. It is an absolute formatting constraint for that communication register.

- **Colon-before-tool-call prohibition**: Prose immediately preceding a tool invocation must not use a colon as a lead-in to the call. The structural separator between natural-language narration and tool use is enforced at the punctuation level.

- **No markdown report file creation for findings**: When CC operates as a subagent or in a background context and produces findings, it must return those findings directly as text output rather than writing them to a markdown file. Writing intermediate or summary report files is blocked in this context. Files created as inputs to other tools are exempt from this constraint.

- **Absolute path requirement for file references**: Any file path surfaced to the user in a response must be absolute. Relative paths are not permitted in user-facing output, regardless of the working directory context.

- **Proxy and TLS integrity**: CC must never disable TLS certificate verification, never unset the proxy environment variable governing outbound HTTPS, and must not attempt to retry or route around egress policy denials from the organization proxy layer. These are non-negotiable network-integrity constraints.

- **Git destructive-action gate**: A defined set of destructive git operations — including force operations, hard resets, and branch deletions — may not be executed unless the user has explicitly and directly requested them in the current turn. Force-pushing to primary branches triggers an additional warning obligation even when the user requests it.

- **Commit hook bypass prohibition**: Pre-commit and GPG-sign hooks must not be skipped via flag unless the user explicitly requests it. Hook failures require a new commit rather than an amend of the prior one.

- **Sensitive file commit block**: CC must refuse to commit files that are likely to contain credentials or secrets, and must warn the user if they specifically request such a commit.

- **Git config mutation prohibition**: The git configuration must never be modified by CC during a session, regardless of instruction.

- **Worktree isolation enforcement**: In contexts where parallel background jobs are active, file edits in the shared working copy are rejected until an isolation step is completed. This is enforced by the environment, not just advisory.

- **Background job temp directory scoping**: Temporary files produced during background sessions must use a job-scoped directory rather than the shared system temp directory, to prevent clobbering between parallel jobs.

- **Side-question agent tool prohibition**: The lightweight agent instance spawned to handle an interrupt question during a running task has no tools available and must not promise to take any action. It may only respond based on context already present in the conversation.

---

## Default Behaviors

- **Pull request workflow**: By default, CC follows a structured multi-step PR creation process: parallel git status and diff inspection, commit history review across the full branch divergence, title length targeting, and body formatting via heredoc. Users can influence the PR body structure and detail level through instruction, but the underlying parallel-inspection pattern and formatting approach are built-in defaults.

- **Commit discipline**: CC defaults to not committing unless explicitly asked, staging specific named files rather than using catch-all staging commands, and writing commit messages that emphasize intent over implementation detail. Users can request different commit message styles, and the CLAUDE.md can establish repository-specific conventions that override the generic defaults.

- **Subagent prompt construction**: When delegating to a subagent, CC defaults to constructing self-contained prompts that include full context, specific constraints, and output format guidance. The default assumes the subagent has no prior conversation context. Users can influence how much context is included, but the self-contained briefing pattern is the baseline.

- **Autonomous loop conservatism**: In timer-driven autonomous mode, CC defaults to acting only on work clearly established in the prior conversation transcript, with decreasing scope across repeated idle invocations. Users who want broader autonomous latitude must make that explicit in their setup instructions or CLAUDE.md.

- **Subagent fork vs. fresh-start selection**: The default for subagent type depends on whether conversation context should be inherited. The fork variant inherits context; other types start fresh. The default behavior when no type is specified is the simpler, context-inheriting delegation pattern.

- **PR draft-and-push in isolated worktree**: When CC has isolated itself into a worktree and made code changes, the default is to commit, push the branch, and open a draft PR without waiting for user confirmation — unless the user has said not to open one, or there is no remote to push to. Users can suppress this with explicit instruction.

- **Plan-file workflow for planning sessions**: In planning mode, CC defaults to a phased workflow: exploration, plan drafting, review, and user-confirmation before implementation. The plan file is the only writable artifact during this phase. Users can ask clarifying questions through the dedicated interaction step.

- **Documentation fetch preference**: When bundled references do not cover a topic, CC defaults to fetching live documentation from canonical URLs before improvising. Users can override this by providing documentation directly or by instructing CC to rely on its training knowledge.

- **Loop heartbeat pacing**: In autonomous timer-loop mode, the default heartbeat delay is selected dynamically based on observed activity level — longer during quiet periods, shorter when activity is high. Users can influence this only indirectly by shaping the conditions the loop observes.

---

## CLAUDE.md Redundancy Warning

- **Commit message style**: The system context already instructs CC to write commit messages focused on intent rather than mechanical description of changes, and to keep them concise. Adding equivalent commit message guidance to CLAUDE.md is redundant for style; however, repository-specific conventions (prefix formats, issue references, DCO lines) are genuinely additive and not covered by the default.

- **Emoji prohibition**: The constraint against emoji in output is already embedded in the system context for task-oriented flows. Adding an emoji prohibition to CLAUDE.md is neutral in most cases but may create confusion if the user later tries to enable emoji in a non-task context where the system constraint does not apply.

- **Absolute path requirement**: The system context already mandates absolute paths in user-facing file references. Restating this in CLAUDE.md is redundant and has no additional effect.

- **No speculative or report-file output**: The behavior of returning findings as direct text rather than writing markdown report files is already configured for subagent contexts. Adding this to CLAUDE.md for a top-level session is not harmful but addresses a different context than the one where the constraint is actually enforced.

- **Git safety rules**: Protections against force operations, hook bypasses, sensitive file commits, and config mutation are already hardcoded. Duplicating them in CLAUDE.md is purely redundant — they cannot be overridden by CLAUDE.md anyway, so the duplication provides false confidence rather than actual enforcement.

- **PR creation workflow**: The multi-step parallel-inspection PR workflow is a system-context default. Adding CLAUDE.md instructions to "always check git diff before making a PR" or "keep PR titles short" duplicates what is already present. The only useful additions are project-specific reviewer lists, label conventions, or base branch names.

- **Subagent briefing quality**: Instructions to "write self-contained subagent prompts with full context" are already embedded in the subagent guidance layer. CLAUDE.md additions restating this are redundant. Project-specific context that should always be included in subagent prompts (e.g., which config files matter, which service owns what) is genuinely additive.

- **Autonomous loop scope**: The conservative default for autonomous operation (act only on established work) is already configured. Adding CLAUDE.md instructions to "be conservative in autonomous mode" is redundant. Specific permissions to act on additional categories of work are additive and useful.

---

## User Actionable Insights

1. **Tool denial handling is not fully user-controllable.** When CC denies itself a tool, the workaround boundary is enforced by the system context, not by user instruction. You cannot instruct CC to "try harder" past an intent boundary — you must either grant the permission explicitly or restructure the task.

2. **The commit gate is absolute until you speak.** CC will not commit code unless you explicitly ask for it in the current turn. CLAUDE.md cannot pre-authorize commits in advance — the trigger is always an explicit per-turn request.

3. **Background jobs have a scoped temp directory.** If you are running parallel background tasks, any scripts or intermediate outputs produced by CC go into a job-specific directory, not `/tmp`. This is transparent in practice but matters if you are debugging file location issues across parallel sessions.

4. **Subagent prompts are written as if the agent is context-free.** Even in fork mode (which shares conversation context), the system-context guidance instructs CC to write briefings that stand alone. If you want a subagent to rely heavily on implicit conversation context, you need to explicitly tell CC to do so — the default is over-briefing, not under-briefing.

5. **Autonomous loop scope shrinks on repeated idle results.** If CC finds nothing to do on three consecutive autonomous loop invocations, it reduces its own activity to a minimal CI check rather than continuing to scan. You cannot prevent this via CLAUDE.md; you can only prevent it by ensuring there is actual work in the conversation transcript or PR state.

6. **Draft PR creation is automatic in worktree-isolated sessions.** If CC has entered a worktree, made changes, and you have not told it not to open a PR, it will push and create a draft PR without pausing. To suppress this, include an explicit instruction before the task begins.

7. **The side-question agent cannot take actions.** When you interrupt a running task with a question, the instance that answers it has no tool access. It cannot look up files, run commands, or check state — it can only synthesize from what is already in the conversation. Do not ask it to "check" or "verify" anything.

8. **Live documentation URLs are baked into the bundle.** CC v2.1.198 has a curated table of canonical documentation URLs it consults when bundled knowledge is insufficient. These URLs point to `code.claude.com/docs/en/` and are version-specific to this bundle. If those URLs change or go stale between bundle releases, CC will not automatically know — you may need to provide updated URLs via CLAUDE.md in that scenario.

9. **Proxy TLS verification cannot be disabled by instruction.** In environments routed through the CC agent proxy, TLS verification is a hardcoded constraint. If a tool fails with certificate errors, the expected resolution path is to point the tool at the provided CA bundle — not to disable verification. Instructing CC to disable TLS verification will not work.

10. **Git config is read-only for CC.** CC will never modify git configuration, even if doing so would simplify a task. If your workflow requires git config changes (e.g., setting `user.email` for a CI context), those must be made outside CC or pre-configured in the environment.

---

## Tool & Permission Layer

The system context embeds a multi-mode permission model that governs how CC handles tool access and confirmation requirements.

**Auto-allow vs. prompt-to-allow**: Tool operations are split between those CC may execute without per-invocation confirmation and those that require explicit user approval before proceeding. The boundary is defined by the operation's reversibility and blast radius. Read-only operations generally fall in the auto-allow category; write, network, and process-execution operations are more likely to require confirmation unless the user has granted broader permissions.

**Tool denial and graceful degradation**: When a specific tool invocation is denied, CC attempts functionally equivalent alternatives within the intent boundary. If no compliant alternative exists, CC stops and reports the blocked operation to the user rather than silently failing or attempting a bypass.

**Hook event handling**: The system context references a set of lifecycle events (before/after start, open, close, update, delete, and similar) that can be used to trigger behavioral hooks. These events are part of the extensibility layer and can be wired to external handlers via the hooks configuration.

**MCP server integration**: Model Context Protocol servers are treated as first-class tool providers. The system context includes guidance on how CC interacts with MCP-supplied tools, including trust boundaries and how MCP tool results are incorporated into task execution.

**System-reminder tag handling**: The `<system-reminder>` XML tag is a recognized injection point in the system context layer. It is used to deliver scoped behavioral overrides for specific session types — notably the side-question agent context, which uses this tag to communicate its toolless, single-response constraints. CC treats content within this tag as high-priority contextual instruction.

**Context compression notice**: The system context includes awareness of context compaction events. When a compaction occurs (conversation history is summarized to reclaim context window space), CC is expected to recognize this and adjust its understanding of prior state accordingly, particularly in autonomous loop contexts where loop-local state may have been summarized.

**Agent proxy egress control**: All outbound HTTPS in proxied deployment contexts is routed through a policy-enforcing local proxy. CC is instructed on how to diagnose proxy failures by class (certificate errors, 403/407 policy denials, tool-level proxy blindness, git SSH rewriting), and the system context provides explicit remediation steps for each. This machinery is described to CC itself so it can self-diagnose and repair tool connectivity issues without user intervention.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.198 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `s` | System context assembler — combines SQL keyword/type token lists and injects side-question agent system-reminder block and subagent output formatting rules |
| `L` | Dashboard UI renderer — generates HTML/JS for analytics report pages including collapsible sections, clipboard copy, and usage histogram |
| `a` | Coordinator subagent orchestration guide — fork vs. fresh-start delegation examples, coordinator-side prompt construction, mid-wait status response patterns |
| `l` | PostgreSQL type token list provider + simplified subagent tool usage examples (non-fork delegation pattern) |
| `A` | Autonomous timer-loop instruction block — tick logic, monitor arming, heartbeat delay selection, task-notification wake handling, loop termination procedure |
| `i` | Subagent prompt writing guidance — briefing philosophy, context-inclusion requirements, anti-patterns for shallow delegation |
| `R` | Auth error message provider — cross-origin block notice, expired code notice, wrong-browser session notice |
| `D` | Subtask block property/event constant list — workflow engine subtask schema identifiers |
| `c` | Job block property/event constant list — workflow engine job schema identifiers |
| `E` | Pseudo-reference code constant list — system reference type identifiers for component/privilege/group lookups |
| `x` | Validation rule ID constant list — reference record business rule identifiers |
| `g` | Dataset event constant list + background process telemetry event emitter (sigkill escalation, low-memory, spare agent lifecycle) |
| `d` | Daemon config reload telemetry event emitter |
| `pDt` | No-string assembler function (role: structural/wiring, no large string content) |
| `H` | No-string assembler function (role: structural/wiring, no large string content) |
| `m` | No-string assembler function (role: structural/wiring, no large string content) |
| `u` | No-string assembler function (role: structural/wiring, no large string content) |
| `h` | No-string assembler function (role: structural/wiring, no large string content) |
| `f` | No-string assembler function (role: structural/wiring, no large string content) |
| `w` | No-string assembler function (role: structural/wiring, no large string content) |
| `v` | No-string assembler function (role: structural/wiring, no large string content) |
| `I` | Dashboard CSS and charting renderer — full page stylesheet and timezone-aware histogram update logic |
| `p` | PostgreSQL SQLSTATE / error code token list provider |
| `$zo` | Tool-denial graceful-degradation message injector — delivers the policy explanation and escalation instruction when a tool call is blocked |
| `_mm` | Background session context injector — worktree isolation enforcement block, post-isolation PR shipping policy, background session identity and temp-directory scoping rules |
| `e8p` | Git workflow instruction provider — PR creation protocol, commit discipline rules, git safety constraints, interactive flag prohibitions |
| `Bco` | Autonomous loop behavioral policy block — stewardship scope, action prioritization hierarchy, PR maintenance procedure, idle handling and scope reduction rules |
| `kNc` | Live documentation URL table provider — canonical Mintlify doc URLs organized by topic area with extraction prompt hints |
| `hAm` | Agent proxy configuration and diagnostics block — TLS re-termination setup, failure class diagnosis guide, per-tool CA configuration patterns, egress policy denial handling |
| `KOc` | Files API reference injector — Python SDK usage examples for upload, message attachment, metadata retrieval, deletion, and download |