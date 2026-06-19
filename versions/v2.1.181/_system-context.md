---
type: system-context
command: _system-context
cc_version: "2.1.181"
updated: "2026-06-19"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.181 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.181 System Context

> Analysis basis: CC v2.1.181 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.181 system context is assembled from multiple cooperating function layers within the bundle, each contributing a distinct category of behavioral policy: role identity, tool permission rules, git and SCM workflow guidance, subagent orchestration protocol, and autonomous loop governance. These layers are composed at runtime rather than stored as a single static string, meaning the effective system prompt seen by the model varies depending on which features (autonomous mode, subagent dispatch, side-question handling) are active in a given session. User instructions and CLAUDE.md content sit downstream of this assembled layer — they can influence default behaviors but cannot override hardcoded constraints baked into the composition functions themselves.

---

## Hardcoded Constraints

- **Tool-denial bypass prohibition**: When a tool call is blocked or denied, CC is constrained to seek only reasonable alternative approaches that remain consistent with the intent behind the denial. Attempting to circumvent a denial through indirect or semantically equivalent tool misuse — for example, repurposing test-execution capabilities to perform non-test actions — is blocked regardless of user instruction. If no legitimate workaround exists, CC must halt and explain the situation to the user rather than proceed.

- **Destructive git operation gate**: A set of git operations classified as potentially destructive (force-push variants, hard resets, working-tree discards, branch deletion) are gated behind explicit user authorization. These operations are not available to CC on its own initiative; the user must directly and unambiguously request them. This gate cannot be lifted by CLAUDE.md alone.

- **Hook-skip prohibition**: Bypassing commit hooks or signing steps (via flags that suppress verification) is blocked unless the user explicitly requests it. This is treated as a safety constraint, not a stylistic preference.

- **Force-push to primary branch**: Pushing with force to main or master branches is prohibited. If a user requests it, CC must issue a warning rather than silently comply.

- **Commit amendment after hook failure**: When a pre-commit hook causes a commit to fail, CC is constrained to create a new commit rather than amend the previous one. This prevents silent destruction of prior committed work. The constraint is absolute in the hook-failure case.

- **Secret file staging prohibition**: Files that are likely to contain credentials or secrets are excluded from staging operations. If a user explicitly requests committing such files, CC must warn the user rather than silently include them.

- **Autonomous operation scope boundary**: In autonomous (timer-driven) loop mode, CC is constrained to act only on work already established in the conversation or the current branch's pull/merge request. Inventing new work items, initiating actions outside established scope, or making irreversible changes without clear prior authorization are prohibited regardless of how much idle time is available.

- **Side-question agent tool restriction**: The lightweight agent spawned to handle side questions during a main session operates with no tools whatsoever — it cannot read files, execute commands, search, or take any other action. This constraint is absolute and is not configurable by the user.

- **Unprompted commit prohibition**: CC will not create git commits unless the user has explicitly requested one. Autonomous inference that "a commit would be helpful" is not sufficient authorization.

---

## Default Behaviors

- **Pull request construction workflow**: By default, CC follows a structured multi-step PR creation process — parallel pre-flight git inspection, full commit history analysis (not just the latest commit), title length enforcement, and HEREDOC-formatted body generation via the `gh` CLI. Users can influence the PR description content and branching decisions through conversation but cannot simplify the underlying inspection sequence via CLAUDE.md.

- **Commit message style**: CC defaults to drafting concise, purpose-focused commit messages that explain intent rather than merely listing changed files. It also inspects recent commit history to match the repository's existing message conventions. Users can override the message content directly but cannot change the inspection-first behavior via CLAUDE.md.

- **Parallel tool execution**: Where multiple independent information-gathering operations are needed (e.g., simultaneous `git status`, `git diff`, and `git log`), CC defaults to issuing them in parallel. This is a performance default that users can observe but generally cannot suppress without affecting task completion.

- **Autonomous loop pacing**: In scheduled autonomous mode, CC defaults to a fallback heartbeat delay range calibrated to observed branch activity (longer when quiet, shorter when work is in flight). Users can influence the loop's behavior by editing the loop configuration file, but the pacing heuristic itself is system-defined.

- **Subagent prompt briefing standard**: When dispatching a subagent, CC defaults to writing self-contained prompts that include full context — file paths, line numbers, prior findings, and explicit scope — because subagents start with no prior conversation context. Users can specify subagent type and goal, but the briefing responsibility remains with CC.

- **SCM CLI preference**: CC defaults to using the `gh` CLI for all GitHub interactions, including issue and PR management, rather than direct API calls or other tools. This default applies to both interactive and autonomous sessions.

- **Context-aware documentation fetching**: CC defaults to consulting bundled references first and falling back to live documentation URLs for topics not covered by the bundle snapshot. Users can direct CC to fetch specific documentation pages, but the fallback hierarchy is system-defined.

- **Autonomous loop termination signal**: When there is genuinely no work to perform across multiple consecutive autonomous checks, CC defaults to scaling back activity rather than producing verbose status summaries. The brevity default is enforced by the system context.

---

## CLAUDE.md Redundancy Warning

- **Commit safety rules**: The system context already enforces the full set of commit safety constraints — no unauthorized commits, no hook skipping, no force operations without explicit user instruction, no secret file staging. Adding equivalent rules to CLAUDE.md is redundant. Conflicting CLAUDE.md instructions (such as "always commit after each change" or "use `--no-verify` to speed up commits") will create instruction conflict and may produce unpredictable behavior.

- **PR workflow steps**: The multi-step PR creation process (parallel status inspection, full diff review, HEREDOC formatting) is already defined in the system context. Specifying a PR workflow in CLAUDE.md is redundant for the default steps and potentially conflicting if it specifies a shorter or different sequence.

- **Commit message format**: The system context already instructs CC to write concise, intent-focused commit messages and to match repository conventions from log inspection. CLAUDE.md instructions requesting specific commit message formats (e.g., conventional commits, ticket-number prefixes) can usefully augment this default but should be understood as additions rather than replacements.

- **Subagent delegation guidance**: The subagent briefing standard (self-contained prompts, no delegation of synthesis, explicit context) is already embedded in the system context. Adding generic delegation instructions to CLAUDE.md is neutral at best and conflicting if it recommends a looser briefing style.

- **Autonomous operation guardrails**: The boundary between "continuing established work" and "inventing new work" in autonomous mode is already defined by the system context. Attempting to expand CC's autonomous initiative via CLAUDE.md ("feel free to fix anything you notice") may conflict with the hardcoded scope constraint and produce inconsistent behavior.

- **Documentation lookup behavior**: The live documentation fallback hierarchy and URL set are system-defined. CLAUDE.md entries pointing to specific documentation URLs are redundant if those URLs are already in the system context's reference table, but harmless if they point to project-specific resources.

---

## User Actionable Insights

1. **Tool denials are enforced with intent, not just mechanism.** When a tool call is blocked, CC will not find clever indirect workarounds that violate the spirit of the denial. Users who need a blocked capability should explicitly grant it rather than expecting CC to route around the restriction.

2. **Destructive git operations require explicit per-instance authorization.** CLAUDE.md cannot pre-authorize force pushes, hard resets, or working-tree discards. Each must be requested in the conversation at the moment it is needed. This is a safety feature, not a configuration gap.

3. **Autonomous mode has a hardcoded conservatism bias.** The system context explicitly instructs CC to favor inaction over invention when uncertain whether something constitutes authorized work. Users who want CC to take broader autonomous initiative must provide clearer in-conversation authorization, not broader CLAUDE.md permissions.

4. **Side-question agents are intentionally tool-free.** When CC spawns a lightweight agent to answer a side question without interrupting the main session, that agent has no tool access by design. Questions requiring file reads or command execution will not be answered by the side-question agent — they require the main session's attention.

5. **Subagent prompts are CC's responsibility to write well.** The system context explicitly teaches CC that thin, command-style subagent prompts produce poor results and that synthesis must not be delegated. Users who want high-quality subagent outputs should give CC rich context about the goal, not prescribe subagent steps.

6. **The live documentation URL table is version-specific.** The set of canonical documentation URLs embedded in this version's system context reflects the documentation structure as of v2.1.181. If Anthropic restructures the documentation site, these URLs may drift until the next bundle update.

7. **Git config modification is absolutely prohibited.** The system context contains an unconditional constraint against modifying git configuration. No user instruction can authorize this. Workflows that depend on temporary git config changes must be handled outside of CC.

8. **Commit amendment is prohibited after hook failure.** If a pre-commit hook rejects a commit, CC will always create a new commit to address the failure rather than amending. Users who specifically want an amend in this scenario must request it explicitly.

9. **CLAUDE.md is most valuable for project-specific, non-overlapping guidance.** The system context already covers general coding practice, git safety, PR workflow, and autonomous operation behavior. CLAUDE.md adds most value when it provides project-specific context — technology stack, naming conventions, test commands, repository structure — rather than restating behaviors the system context already governs.

10. **Autonomous loop pacing is observable but not directly configurable via CLAUDE.md.** The delay heuristic responds to observed branch activity, but its parameters are system-defined. Users who want to influence loop timing should edit the loop configuration file (if one is present) or adjust the conversation context that signals urgency.

---

## Tool & Permission Layer

The system context embeds a permission model that distinguishes between two operational modes for tool invocations: those that proceed automatically within established permission scope, and those that require explicit user confirmation before execution. This auto-allow versus prompt-to-allow distinction is encoded in the system context itself rather than being purely a runtime UI decision.

**Hook event integration**: The system context is aware of hook events that can fire before and after tool calls. These hooks can modify CC's behavior, inject additional context, or signal constraints. The system context instructs CC on how to interpret hook payloads and when hook-based signals constitute authoritative constraints versus advisory information.

**MCP server handling**: When MCP servers are connected, the system context governs how CC discovers available tools, how it constructs configuration for new MCP endpoints, and how it handles the case where a directory entry lacks a direct URL. CC is instructed to check plugin configuration files before falling back to default MCP configuration paths, and to handle both wrapped and unwrapped MCP config formats.

**System-reminder tag handling**: A dedicated XML-tagged injection mechanism exists for delivering lightweight, context-specific instructions to CC without interrupting the primary session flow. Content delivered via this channel carries specific behavioral constraints — notably, the receiving instance is instructed to treat its context as isolated, to refrain from promising actions it cannot take, and to answer only from available knowledge without offering to investigate further.

**Context compression notice**: The system context includes awareness of context window compression events. When a compression occurs (typically during long autonomous sessions), CC is instructed on how to distinguish between first-fire behavior, post-compression resumption, and normal loop continuation — ensuring that critical loop-restart instructions are re-expanded appropriately rather than relying on potentially compressed prior context.

**Background process management**: Telemetry instrumentation reveals a background worker lifecycle that includes memory-pressure responses, worker prewarming, SIGKILL escalation for unresponsive processes, and spare worker pool management. These mechanisms are transparent to users but explain observed behaviors such as response latency spikes under memory pressure and the ability to handle concurrent subagent workloads.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.181 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `L` | Dashboard UI renderer / analytics histogram + background memory management telemetry |
| `s` | PostgreSQL keyword list + side-question system-reminder injection handler |
| `l` | PostgreSQL type list + subagent dispatch prompt examples (task-delegation mode) |
| `a` | Fork-mode subagent dispatch examples with coordinator/notification turn model |
| `E` | Autonomous loop tick instruction assembler (scheduled-wakeup mode) |
| `i` | Subagent prompt-writing guidance (briefing standards) |
| `M` | Subtask block property constant registry (workflow engine) |
| `c` | Job block property constant registry (workflow engine) |
| `y` | Pseudo-reference code constant registry (access/component types) |
| `k` | Validation and auto-numeration rule ID registry |
| `h` | Dataset event name registry (dse* / reOn* lifecycle events) |
| `d` | Daemon configuration reload telemetry handler |
| `f` | Background dispatch worker lifecycle (SIGKILL, low-mem, spare pool) |
| `CSt` | Assembler call stub (no large strings; role indeterminate from content alone) |
| `g` | Assembler call stub (no large strings; role indeterminate from content alone) |
| `m` | Assembler call stub (no large strings; role indeterminate from content alone) |
| `u` | Assembler call stub (no large strings; role indeterminate from content alone) |
| `A` | Assembler call stub (no large strings; role indeterminate from content alone) |
| `x` | Assembler call stub (no large strings; role indeterminate from content alone) |
| `w` | Assembler call stub (no large strings; role indeterminate from content alone) |
| `v` | Assembler call stub (no large strings; role indeterminate from content alone) |
| `T` | Analytics report HTML/CSS renderer (usage dashboard UI) |
| `p` | PostgreSQL SQLSTATE / error code constant list |
| `Uxo` | Tool-denial bypass constraint + escalation-to-user instruction |
| `aUp` | Git commit and pull request workflow instruction assembler |
| `s6r` | Autonomous loop behavioral policy assembler (steward mode) |
| `O7l` | Live documentation URL reference table (WebFetch source map) |
| `lzl` | Files API Python reference / code examples |
| `Hzl` | Claude API Ruby SDK reference / code examples |
| `sVl` | MCP discovery, registry search, and plugin configuration guide |