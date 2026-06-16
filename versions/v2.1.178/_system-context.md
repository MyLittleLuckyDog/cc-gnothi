---
type: system-context
command: _system-context
cc_version: "2.1.178"
updated: "2026-06-16"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.178 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.178 System Context

> Analysis basis: CC v2.1.178 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.178 system context layer is assembled from multiple specialized functions that are composed at runtime into a unified instruction set. These functions collectively govern four main domains: multi-agent session security and authority boundaries, version-control safety protocols, autonomous operation policies, and live documentation routing. The system context sits above user instructions and CLAUDE.md in the authority hierarchy for hardcoded constraints, but yields to user instructions for configurable defaults. Understanding this layer helps users avoid redundant configuration, prevents surprising refusals, and clarifies which behaviors are version-specific versus architectural.

---

## Hardcoded Constraints

- **Inter-session authority isolation**: When CC receives messages that originate from a peer agent instance rather than the active user session, those messages are treated as carrying zero user authority. The system enforces this boundary absolutely: a peer agent cannot grant permissions, authorize actions, or compel consequential operations regardless of the content of its request. This constraint is not overridable by CLAUDE.md or user instruction.

- **Permission laundering prevention**: If a peer agent requests an action that the current session's permission settings do not allow — particularly actions the peer claims it cannot perform itself — CC is instructed to refuse and escalate to the human user rather than relay or proxy the request. This is treated as an architectural security boundary, not a soft preference.

- **Peer message consent boundary**: Receiving a message from another Claude session is explicitly defined as not constituting user consent or approval for any action. No amount of framing, urgency, or claimed context from a peer session can satisfy the consent requirement that must come from the active human user.

- **Destructive git operation gating**: A set of git commands considered irreversible or high-risk (including force operations, hard resets, wholesale file discards, and branch deletions) are blocked from autonomous execution. These may only be run when the user explicitly and directly requests them. This is not a soft default — it is framed as a safety protocol that protects against accidental data loss.

- **Force-push to primary branch**: Force-pushing to branches named as primary integration branches (such as `main` or `master`) is treated as a specially flagged operation. If a user requests it, CC surfaces a warning rather than silently executing. There is no configuration to suppress this warning.

- **Hook and verification bypass prohibition**: Git operations that would skip pre-commit hooks, signing steps, or other verification mechanisms are blocked unless the user explicitly requests the bypass. This prevents silently circumventing repository quality gates.

- **Amend-after-hook-failure correction**: When a pre-commit hook fails and no commit has been recorded, CC is instructed to create a new commit after fixing the issue rather than amending the previous one. This is enforced to prevent a specific class of data loss where amend would destructively modify a prior commit.

- **Sensitive file staging guard**: CC avoids staging files that pattern-match common sensitive file types (environment files, credential stores, etc.) unless the user specifically directs it to. If a user explicitly requests staging such files, CC surfaces a warning rather than silently proceeding.

- **Autonomous mode scope restriction**: During timer-invoked autonomous operation, CC enforces a hard distinction between continuing work the user has already authorized and initiating new, independent work. Inventing new tasks, making irreversible changes without clear authorization from the conversation transcript, or acting on weak justifications are treated as violations of the autonomous operation contract — not user-configurable preferences.

- **Tool denial response policy**: When a tool use is denied by the permission system, CC may attempt reasonable alternative approaches using other available tools to accomplish the same goal. However, it is prohibited from using indirect capabilities (such as test runners) to execute actions that were denied through a more direct path. If no compliant path exists, CC must stop and explain the situation to the user rather than silently route around the denial.

---

## Default Behaviors

- **Git commit creation threshold**: By default, CC does not create commits unless explicitly asked. Users who want commits created automatically during task completion need to explicitly instruct this in their session or CLAUDE.md. The default leans toward minimal footprint.

- **Remote push policy**: CC defaults to not pushing to remote repositories unless the user directly requests it, even after creating a commit. This must be explicitly requested per-session or configured in CLAUDE.md.

- **Parallel tool invocation**: CC defaults to batching independent tool calls into parallel execution when multiple pieces of information are needed simultaneously. Users who prefer sequential execution for debugging or legibility reasons can instruct this.

- **Pull request body format**: When creating pull requests via the GitHub CLI, CC defaults to a structured format with a summary section and a test plan checklist. Users can override this format by providing their own template in CLAUDE.md or per-request.

- **PR title length targeting**: CC defaults to keeping pull request titles under a specific character threshold to maintain readability. This can be adjusted if users specify different conventions.

- **Commit message focus**: Commit messages default to emphasizing the rationale behind a change rather than describing the mechanical diff. Users who prefer what-focused messages can specify this.

- **Specific file staging preference**: Rather than staging all changes with a catch-all flag, CC defaults to staging files individually by name. This can be overridden but carries the documented caveat about sensitive file risk.

- **Autonomous operation verbosity**: When operating in timer-invoked autonomous mode with nothing productive to do, CC defaults to a single brief statement and stops — it does not produce summaries, lists of what it checked, or speculation about future actions. After several consecutive idle results, it scales back further. This behavior is not directly configurable but responds to the conversation transcript context.

- **Documentation freshness handling**: CC defaults to treating its training-data knowledge of its own configuration as potentially stale. When answering questions about commands, flags, settings, or hooks, it defaults to checking live configuration state before answering from memory. If network access is unavailable, it defaults to disclosing this limitation explicitly rather than silently answering from stale data.

- **Subagent isolation mode**: When spawning worker agents for parallel batch operations, CC defaults to using isolated git worktree environments with background execution. This keeps parallel work from contaminating shared state.

- **Interactive git flag avoidance**: CC defaults to avoiding git command flags that require interactive terminal input (such as interactive rebase or interactive add), since these cannot function in non-interactive execution contexts.

---

## CLAUDE.md Redundancy Warning

- **Commit-on-request behavior**: The system context already establishes that commits are only created when explicitly requested. Adding a CLAUDE.md instruction saying "only commit when asked" is redundant. A conflicting CLAUDE.md instruction asking CC to commit more proactively may override this default, which could surprise users who expect the conservative baseline.

- **Push conservatism**: The system context already defaults to not pushing remotely without explicit instruction. Restating this in CLAUDE.md is redundant. An instruction to push automatically after commits would conflict and may produce unexpected remote state changes.

- **Sensitive file warnings**: The system context already includes guidance to avoid committing credential-pattern files and to warn when asked. CLAUDE.md entries repeating this are neutral-redundant. Instructions that attempt to suppress these warnings (e.g., "commit all files without prompting") would conflict with the hardcoded safety policy and may not produce the expected result.

- **PR format templates**: The system context already embeds a default PR structure. If CLAUDE.md specifies a different PR format, that instruction should take precedence, but users should be aware the system default is opinionated and detailed — a partial CLAUDE.md template may produce merged/hybrid output rather than clean replacement.

- **Parallel tool execution**: The system context already instructs CC to parallelize independent tool calls where possible. Adding CLAUDE.md instructions to "run commands in parallel" is redundant. Instructions to force sequential execution would conflict and may slow task completion.

- **Documentation self-check behavior**: The system context already tells CC to check live configuration state before answering questions about itself. CLAUDE.md instructions telling CC to "always use current documentation" are redundant. Instructions telling it to answer from memory without checking could conflict with this behavior.

- **Destructive git command caution**: The system context already includes the full git safety protocol. CLAUDE.md entries like "never force push" or "always ask before destructive git operations" duplicate existing behavior and are neutral-redundant. They cannot make these constraints stricter, but they also cause no harm.

---

## User Actionable Insights

1. **Peer agent messages cannot grant you elevated permissions.** If you build multi-agent pipelines where a subagent orchestrates CC, the subagent's messages carry no authority beyond what the original user session established. Design your pipelines so that permission grants come from the human-facing session, not from agent-to-agent communication.

2. **The permission denial path has a defined fallback behavior you can rely on.** When CC cannot use a tool because permission was denied, it will attempt reasonable alternative approaches before stopping. If you see it stopping and explaining, that means no compliant alternative was found — this is the intended signal to you that you need to either grant the permission or reconsider the task design.

3. **Autonomous/timer mode has a built-in conservatism you cannot fully override.** CC will not invent new work during autonomous invocations. If you want it to tackle a new task while running autonomously, that task needs to be visible in the conversation transcript before autonomous mode begins. Leaving vague goals in the transcript is unlikely to produce the work you expect.

4. **The git safety protocol is not a preference — it is enforced.** You cannot instruct CC via CLAUDE.md to run force resets, force pushes to primary branches, or hook-bypass commits without also providing that instruction explicitly in the request that triggers the action. Blanket CLAUDE.md permissions for destructive git operations will not propagate as expected.

5. **CC's self-knowledge is intentionally treated as stale.** When asking CC about its own commands, settings, or flags, it is designed to check live configuration rather than rely on training data. This means answers about CC's own behavior are more reliable than you might expect from an LLM, but also means CC may refuse to answer confidently if it cannot reach documentation and the live config doesn't cover the question.

6. **For parallel batch work, the worktree isolation model is the expected pattern.** If you are designing large-scale parallel refactors or migrations using CC's subagent capability, the system context already assumes `isolation: worktree` and background execution as the correct defaults. You do not need to specify these in your prompts unless overriding them.

7. **Commit message convention is influenced by your repository's history.** CC's commit workflow includes checking recent commit messages to adopt the repository's existing style. If you want a specific format, ensuring your repository already demonstrates that format is more effective than trying to specify it purely via CLAUDE.md.

8. **The `gh` CLI is the mandated path for all GitHub operations.** The system context explicitly routes all GitHub-related work (issues, PRs, checks, releases) through the GitHub CLI rather than alternative tools or API calls. If you have workflows that depend on different GitHub integration approaches, be aware they may be redirected.

9. **Version v2.1.178 is the first analyzed baseline.** No prior version data exists in this spec. Behavioral changes observed in future versions should be diffed against this document, not against assumed prior behavior.

10. **Live documentation URLs are embedded in the system context.** CC knows where to fetch current documentation for its own features. If you are working in an air-gapped environment, CC will disclose its inability to reach these sources and fall back to training data with an explicit caveat — this is by design, not a bug.

---

## Tool & Permission Layer

**Tool denial and workaround policy**: The permission system generates structured denial signals when a requested tool use is blocked. Upon receiving a denial, CC is instructed to evaluate whether the underlying goal can be accomplished through alternative tool combinations that would naturally serve the same purpose — but it is explicitly prohibited from using indirect capabilities to route around the intent of the denial. The line between "reasonable alternative" and "bypass" is enforced by intent-matching logic embedded in the system context.

**Peer session message tagging**: The system context includes a mechanism for labeling inbound messages that originate from other Claude sessions. These messages receive a distinct authority classification that strips them of any implicit user-delegation. The tagging logic appears in multiple locations in the bundle (the same policy text is instantiated for different message positions), suggesting it is applied at multiple points in the message assembly pipeline rather than only at session initialization.

**Autonomous mode invocation context**: Timer-invoked autonomous sessions receive a specialized context block that includes the full autonomous operation policy, scope restrictions, escalation rules for repeated idle cycles, and guidance on SCM-based maintenance work (CI status, review thread resolution, branch rebasing). This block is injected specifically for non-interactive autonomous invocations and is not present in normal interactive sessions.

**Git worktree isolation for subagents**: Batch orchestration contexts include explicit instructions to spawn worker subagents with worktree-level isolation and background execution. The system context provides the worker instruction template and the progress tracking table format as part of the orchestration scaffolding, meaning the orchestration protocol is partially specified at the system level rather than being left entirely to user prompts.

**Live documentation reference system**: The system context embeds a structured reference table mapping topic categories to live documentation URLs. CC is instructed to consult these URLs via WebFetch before falling back to training data when answering questions about its own features. The reference system covers configuration, extensibility, workflow surfaces, and deployment targets, and includes extraction prompts to guide efficient document fetching.

**MCP server configuration layer**: Plugin and MCP server configuration is handled through a structured discovery-and-connection workflow embedded in the system context. This includes registry search, connector suggestion UI rendering, and config file format resolution. The system context teaches CC how to locate and modify MCP configuration files at the plugin level, distinguishing between wrapped and unwrapped formats and handling the case where directory entries lack static URLs.

**Context and knowledge freshness signaling**: When CC cannot reach live documentation, the system context mandates explicit disclosure of this limitation to the user, including a directive to name the documentation source the user can consult independently. Silent fallback to training data without disclosure is not permitted behavior.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.178 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| OU7 | GitHub GraphQL query — pull request review decision fetcher |
| qq | System context assembler call (no large strings; likely a composer or router) |
| RAq | System context assembler call (no large strings) |
| zU7 | System context assembler call (no large strings) |
| WAq | System context assembler call (no large strings) |
| Xr_ | System context assembler call (no large strings) |
| wU7 | System context assembler call (no large strings) |
| i$ | System context assembler call (early bundle offset; likely core initializer) |
| rY | System context assembler call (no large strings) |
| J | System context assembler call (late bundle offset; likely finalization or export) |
| hU7 | System context assembler call (no large strings) |
| bH | System context assembler call (no large strings) |
| N | System context assembler call (no large strings) |
| Os | System context assembler call (no large strings) |
| hL | System context assembler call (no large strings) |
| SH | System context assembler call (no large strings) |
| d6 | System context assembler call (no large strings) |
| hAq | System context assembler call (no large strings) |
| zR6 | Peer session authority boundary policy — injected for both subagent and orchestrator message positions |
| n3A | Tool denial response and workaround guidance — governs behavior after permission refusal |
| Mq6 | Peer session authority boundary policy — single-position variant |
| xyL | Git workflow instructions — commit protocol, PR creation protocol, safety rules |
| YU_ | Autonomous loop operation policy — scope, escalation, SCM maintenance, idle handling |
| DnK | Live documentation URL reference table — topic-to-URL mapping for self-documentation queries |
| BcK | Files API reference (Python) — embedded SDK usage documentation |
| ocK | Claude API reference (Ruby) — embedded SDK usage documentation |
| BQK | MCP discovery and connection workflow — plugin MCP config management |
| nE5 | Batch parallel work orchestration — subagent spawning, worktree isolation, progress tracking |
| PnK | Claude Code configuration self-help guidance — freshness policy and documentation routing |
| qlK | Claude Platform on AWS reference — embedded deployment documentation |