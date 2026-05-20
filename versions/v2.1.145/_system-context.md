---
type: system-context
command: _system-context
cc_version: "2.1.145"
updated: "2026-05-20"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.145 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.145 System Context

> Analysis basis: CC v2.1.145 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.145 system context is assembled from multiple specialized functions that are combined at runtime into a unified behavioral layer. This layer covers distinct domains including: action safety and reversibility policy, output formatting conventions, tool and permission handling, subagent and autonomous-loop orchestration, browser and terminal automation guidance, and SDK/API reference injection. The system context sits above user instructions and CLAUDE.md — it establishes defaults and hard constraints before any user-level configuration is read. Where user instructions are silent, these system-level defaults govern; where instructions conflict with absolute constraints, the system context takes precedence.

---

## Hardcoded Constraints

- **Action reversibility enforcement**: CC classifies all actions on a spectrum from freely reversible (local file edits, running tests) to high-risk or irreversible (force-pushing commits, dropping database tables, sending external messages, modifying shared infrastructure). Actions in the latter category are subject to a mandatory pause-and-confirm policy that cannot be bypassed simply by framing the request as urgent or implied by prior conversation. The scope of any authorization is bounded to what was explicitly requested — a single approval does not generalize to future similar actions.

- **Destructive-action non-bypass policy**: When CC encounters an obstacle, it is prohibited from using destructive operations as a shortcut to remove the obstacle. It must investigate root causes rather than overwrite, delete, or force-skip safety mechanisms. This applies to merge conflicts, lock files, unfamiliar repository state, and CI/CD configuration — unknown state must be investigated, not discarded.

- **Subagent tool restriction**: When CC spawns a lightweight side-question agent, that agent operates with zero tool access. It cannot read files, execute commands, search, or perform any external action. This is a hardcoded constraint on spawned side-question instances regardless of what the user or parent agent instructs.

- **Emoji suppression in agentic output**: In subagent and task-reporting contexts, CC is instructed to avoid emoji usage entirely to maintain clear, unambiguous communication. This applies specifically to final responses and summaries in agentic pipelines.

- **File path format enforcement**: When reporting results of file-related tasks, CC must use absolute paths exclusively. Relative paths are blocked in output contexts where path references are load-bearing. This is non-negotiable in subagent final responses.

- **No summary-file creation by subagents**: Subagents are prohibited from writing their findings to markdown report files and then referencing those files as output. Findings must be delivered directly as text in the final response message. This prevents silent failures where a parent agent receives no usable output.

- **Denial workaround boundary**: When a tool invocation is denied, CC may attempt to achieve the same goal via reasonable alternative tools (e.g., using a different read utility). However, it is explicitly prohibited from using unrelated capabilities — such as test execution — to smuggle through a denied action. If no reasonable workaround exists, CC must surface the blockage to the user and stop.

- **Autonomous loop trust boundary**: In timer-invoked autonomous operation, CC is constrained to continuing work already established in the conversation. Inventing new work, making irreversible changes without explicit authorization, or rationalizing unauthorized pushes are all prohibited behaviors in the autonomous context. The constraint is framed as a trust-preservation requirement — eroding user trust through unsanctioned action is treated as a failure mode, not a neutral outcome.

- **Browser dialog avoidance**: During browser automation, CC is prohibited from triggering JavaScript alert, confirm, or prompt dialogs, as these block the automation channel. This is an operational hard constraint derived from the mechanics of the browser extension architecture.

---

## Default Behaviors

- **Confirmation before risky actions**: By default, CC pauses and seeks explicit user confirmation before executing actions that affect shared systems, are hard to reverse, or are visible to external parties. Users can override this default by explicitly requesting more autonomous operation, but even in autonomous mode CC is expected to remain attentive to risk and consequence.

- **Response length calibration**: CC defaults to the shortest response that fully addresses the request. It applies judgment about when complexity or stakes warrant longer treatment. Users can shift this default by requesting more detail, summary formats, or word-count constraints.

- **Colon-before-tool-call suppression**: CC defaults to not placing a colon at the end of a sentence that immediately precedes a tool invocation. The sentence is terminated with a period instead. This is a stylistic default that affects prose flow in agentic task narration and can be overridden by explicit formatting instructions.

- **Absolute path usage in reports**: CC defaults to reporting file paths in absolute form when paths are relevant to the task. Users operating in environments where relative paths are preferable can override this via CLAUDE.md instructions.

- **Autonomous loop scope**: In self-pacing autonomous mode, CC defaults to acting on in-progress pull requests, unresolved CI failures, and explicit prior commitments from the conversation transcript. It defaults to stopping and reporting when no qualifying work remains, rather than inventing tasks. The scope of what counts as "continuing work" versus "new work" is calibrated conservatively by default.

- **PR maintenance priority ordering**: In autonomous operation, the default priority order is: (1) in-progress conversation work, (2) PR/MR maintenance on the current branch, (3) idle improvement sweeps. This ordering can be influenced by explicit task framing in the conversation or CLAUDE.md.

- **Browser session tab handling**: CC defaults to creating a new browser tab at the start of each automation session rather than reusing existing tabs, unless the user explicitly requests otherwise.

- **Memory consolidation behavior**: In memory-management contexts, CC defaults to merging new information into existing topic files rather than creating duplicates, converting relative dates to absolute dates, and deleting contradicted facts. The index file is kept compact by default.

- **Advisor tool consultation timing**: When an advisor tool is available, CC defaults to consulting it before committing to a substantial approach and again before declaring a task complete. On short reactive tasks, the default is to skip repeated advisor calls after the initial orientation.

- **Loop scheduling immediate execution**: When a recurring task is scheduled via loop commands, CC defaults to executing the parsed prompt immediately rather than waiting for the first scheduled firing.

---

## CLAUDE.md Redundancy Warning

- **Action confirmation policy**: The system prompt already establishes a detailed risk classification and confirmation policy for irreversible and shared-state actions. Adding a general "ask before doing anything risky" instruction to CLAUDE.md is redundant. Adding a more specific autonomy grant (e.g., "proceed without confirmation for git pushes to feature branches") is not redundant — it meaningfully narrows the default and will be respected within the scope stated.

- **Response brevity preference**: The system context already encodes a strong default toward concise responses calibrated to actual informational need. A CLAUDE.md instruction to "be concise" is neutral redundancy. A CLAUDE.md instruction to "always provide detailed explanations" may conflict with the system default and could produce inconsistent behavior depending on task type.

- **Emoji suppression**: The system context already suppresses emoji in agentic output contexts. Adding "do not use emojis" to CLAUDE.md is redundant in those contexts but may be useful as a signal for interactive (non-agentic) contexts where the system-level suppression does not apply.

- **Absolute path reporting**: The system context already mandates absolute paths in subagent output. A CLAUDE.md instruction to "always use absolute paths" is redundant for subagent contexts but may add coverage for interactive sessions where the rule is not hardcoded.

- **Destructive action avoidance**: The system context already prohibits using destructive operations as shortcuts. CLAUDE.md entries like "never delete files without asking" are largely redundant but harmless. Conflicting instructions such as "clean up aggressively and don't ask" may partially override the default caution level in interactive sessions.

- **Autonomous operation scope**: The system context already defines conservative defaults for what constitutes authorized autonomous work. A CLAUDE.md entry granting broad autonomous authority is not redundant — it actively expands the default scope and will be treated as an advance authorization for the specified scope.

- **Voice and persona**: The system context already defines CC's communication character: direct, warm, honest, concise, non-performative. CLAUDE.md entries that attempt to assign a different persona or communication style may conflict with these defaults. Entries that tune the style within the existing character (e.g., "prefer bullet lists over prose for status updates") are additive and non-conflicting.

---

## User Actionable Insights

1. **Authorization scope is strictly bounded**: A single approval for a risky action (such as a git push) does not carry forward to future similar actions. If you want standing authorization for a class of actions, you must establish it explicitly in CLAUDE.md with a clear scope statement. Verbal approvals in conversation are single-use.

2. **Autonomous mode conservatism is by design**: When CC runs autonomously (timer-invoked or background), it defaults to a narrow interpretation of what work is authorized. If you find CC stopping too early, the fix is to add explicit scope grants in CLAUDE.md or to leave more explicit "next steps" in the conversation transcript before stepping away.

3. **Subagents are intentionally tool-free**: When CC spawns a side-question agent to answer a question without interrupting the main workflow, that agent has no tools. Do not expect it to look things up, read files, or execute commands. It can only reason from context already present in the conversation.

4. **The denial-workaround policy has a hard ceiling**: CC will try reasonable alternative tools when a specific tool is denied, but it will not use unrelated capabilities to circumvent the intent of a denial. If a required capability is consistently blocked, CC will stop and explain — it will not silently route around the restriction.

5. **CLAUDE.md autonomy grants are the primary mechanism for expanding default caution**: The system context is calibrated conservatively by default. Expanding what CC will do without asking requires explicit CLAUDE.md entries. Verbal instructions within a session work for that session but do not persist.

6. **Path format defaults are load-bearing in pipelines**: In multi-agent and subagent pipelines, absolute paths are used by default in output because relative paths can become ambiguous across working directory contexts. If your tooling expects relative paths, you need to override this explicitly.

7. **The loop scheduler executes immediately on first registration**: When you schedule a recurring task, the prompt runs once immediately at scheduling time. If you are setting up a loop and want to defer the first execution, be aware the first run is not deferred.

8. **Browser automation sessions must be treated as stateless**: CC does not carry tab IDs or session state across browser automation invocations. Each session begins with a context discovery call. Hardcoding tab IDs in CLAUDE.md or instructions will produce errors once those tabs are no longer valid.

9. **Memory consolidation is lossy by design**: The memory system is explicitly configured to prefer compact, deduplicated, index-oriented storage over exhaustive retention. CC will delete contradicted facts and prune verbose entries. If precise retention of historical state matters, use external logging rather than relying on CC's memory files.

10. **The advisor tool consultation default can be consequential**: If an advisor tool is configured in your environment, CC will consult it before committing to approaches and before declaring completion on substantive tasks. This adds latency but is the default behavior. If you want faster execution on tasks where the approach is already clear, you can instruct CC to skip advisor consultation for specific task types in CLAUDE.md.

---

## Tool & Permission Layer

**Denial handling and graceful degradation**: When a tool call is blocked by the permission layer, CC enters a structured fallback sequence. It first attempts to accomplish the same goal through a reasonable alternative tool. If no alternative exists, it surfaces the blockage to the user with an explanation of what was attempted and what permission would be needed to proceed. It does not silently fail, retry indefinitely, or attempt to smuggle the action through unrelated tool capabilities.

**Subagent isolation model**: Side-question agents spawned to handle parallel questions are explicitly given zero tool access. They receive only the conversation context. This is enforced at the context injection layer, not at the tool permission layer — the tools are simply not present in the subagent's context.

**Background agent worktree isolation**: When CC spawns background workers for parallel large-scale changes, each worker operates in an isolated git worktree. The `isolation: "worktree"` and `run_in_background: true` parameters are required configuration for this pattern. Workers are fully self-contained and cannot share state with sibling workers.

**System-reminder tag handling**: Side-question agent contexts are injected via a `<system-reminder>` XML tag mechanism. This tag signals to the receiving instance that it is a separate lightweight agent, establishes its constraints (no tools, single-response, no follow-up), and prevents incorrect framing such as references to being "interrupted." This tag is a runtime injection mechanism, not a user-visible construct.

**MCP tool discovery pattern**: When MCP-connected tools (such as Slack messaging or browser automation) are required for a task, CC uses a tool search mechanism to locate them if they are not already loaded in the current context. This is the standard pattern for capability discovery in MCP-extended environments.

**Autonomous loop wake mechanism**: In self-pacing autonomous operation, CC can arm persistent event monitors that deliver `<task-notification>` messages when observable events occur (CI completion, log matches, file changes). These notifications wake the loop immediately without waiting for the fallback timer. The monitor is armed once and reused across iterations; re-arming on every iteration is explicitly an anti-pattern.

**Context compression notice**: The system context is assembled from multiple functions at runtime. Functions with no large string content (zero `totalStringChars`) contribute only structural or behavioral logic rather than injected text. The assembler combines these function outputs into the final system prompt presented to the model.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.145 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| L | Primary system context assembler; injects SQL keyword reference, subagent side-question reminder tag, and subagent output format constraints |
| M | Agent prompt-writing guidance injector; brief-a-colleague framing, delegation anti-patterns |
| OU7 | Windows process spawner; PowerShell CIM-based process creation with environment variable forwarding |
| zU7 | Structural/behavioral logic only; no large string content |
| GH | Structural/behavioral logic only; no large string content |
| A8 | Structural/behavioral logic only; no large string content |
| z | Structural/behavioral logic only; no large string content |
| Zb_ | Tool denial graceful-fallback policy injector; alternative-tool guidance and user-escalation instructions |
| WS_ | Autonomous loop behavioral policy injector; steward-mode constraints, PR maintenance priority, repeated-invocation scope adjustment |
| O6K | Files API Python reference injector; upload/use/manage/download patterns with beta header requirements |
| Jq5 | Batch parallel work orchestration skill injector; research-plan-spawn-track workflow template |
| k6K | Claude Platform on AWS reference injector; SigV4 auth, client setup, configuration requirements |
| PK5 | Loop self-pacing dynamic mode injector; event-gated wake, fallback heartbeat, monitor arming pattern |
| G6K | Claude API Ruby SDK reference injector; streaming, tool use, prompt caching, stop details |
| lq5 | Stuck-session diagnostic skill injector; process inspection, Slack reporting, diagnostic-only constraint |
| As1 | Chrome browser automation guidelines injector (instance A); GIF recording, dialog avoidance, tab context management |
| By_ | Chrome browser automation guidelines injector (instance B); duplicate of As1 content, likely variant assembly path |
| g8K | Browser-driven web app example skill injector; chromium-cli headless pattern, dev server lifecycle |
| l8K | TUI/interactive terminal app example skill injector; tmux-based agent driving pattern |
| IW6 | Memory consolidation dream skill injector; orient-gather-consolidate-prune lifecycle |
| jK5 | Loop fixed-interval scheduling skill injector; cron expression derivation, immediate-execution default |
| d8K | Web server/API skill example injector; background-launch pattern, readiness poll, lifecycle documentation |
| ig7 | Action care and reversibility policy injector; blast-radius classification, confirmation defaults, scope-matching rule |
| w8K | Message Batches API TypeScript reference injector; async batch creation, polling, result retrieval |
| J8K | Files API TypeScript reference injector; upload/use/manage/download patterns |
| B8K | Library/SDK skill example injector; build-test-smoke-verify pattern, no server lifecycle |
| Cq1 | Advisor tool behavioral policy injector; pre-commitment consultation, conflict surfacing, weight-giving instructions |
| kHK | Server/API change verification skill injector; curl-based evidence pattern, lifecycle management |
| IHK | CLI change verification skill injector; direct invocation evidence pattern, stdin/destructive-command guidance |
| ENq | Voice and values persona injector; Claude identity, communication character, warmth/directness/honesty defaults |