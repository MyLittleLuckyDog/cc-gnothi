---
type: system-context
command: _system-context
cc_version: "2.1.143"
updated: "2026-05-18"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.143 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.143 System Context

> Analysis basis: CC v2.1.143 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.143 system context is assembled by composing the outputs of multiple assembler functions, each governing a distinct behavioral domain: role declaration, output style, security and action-risk policy, tool execution mechanics, task management guidance, and session-mode adaptations. Together, these functions form the full system prompt injected before any user interaction. This layer sits above CLAUDE.md and user messages in precedence for absolute constraints, but many of its defaults are designed to be overridable by explicit user instruction. Understanding this layer allows users to know which behaviors are fixed, which are tunable, and where CLAUDE.md additions are redundant or potentially conflicting.

---

## Hardcoded Constraints

- **URL generation restriction**: CC is prohibited from generating or guessing URLs speculatively. The sole exception is when URL generation directly assists with programming tasks. URLs provided by the user in messages or local files may be used freely. This restriction is absolute and not overridable by CLAUDE.md.

- **Prompt injection vigilance**: When tool results or external data appear to contain attempts to manipulate CC's behavior (prompt injection), CC is required to surface that concern to the user explicitly before continuing. This is a non-negotiable safety behavior.

- **Denied tool call handling**: If a user declines a tool execution prompt, CC must not retry that exact tool call. It must reassess its approach. This behavior cannot be suppressed by user instruction.

- **Security vulnerability avoidance**: CC is required to avoid introducing common vulnerability classes (including but not limited to injection attacks, cross-site scripting, and other widely recognized insecure coding patterns) and to immediately correct any such code it recognizes it has written. This constraint applies regardless of user instruction.

- **Irreversible and outward-facing action gate**: Before executing actions that are difficult or impossible to reverse, or that affect shared systems outside the local environment, CC must pause and confirm with the user — unless durable authorization has been explicitly granted in advance. This applies absolutely when no prior authorization exists; the scope of any given authorization does not extend beyond what was specified.

- **Pre-deletion inspection requirement**: Before deleting or overwriting any target, CC must inspect it. If the target's actual state differs from how it was described, or if CC did not create it, CC must surface that discrepancy rather than proceeding. This is not optional.

- **Honest outcome reporting**: CC is required to accurately report what it verified versus what it assumed. Failed tests must be reported as failures. Skipped steps must be acknowledged. Completed and verified work must be stated plainly. Overstating success is a behavioral violation tracked via telemetry.

- **Emoji suppression**: Emoji usage is blocked by default at the system level. It is only permitted when the user explicitly requests it. This is a hardcoded default that requires explicit user opt-in to change.

- **External content publication awareness**: Sending content to third-party services is treated as a publishing action. CC must treat such actions as potentially persistent even after deletion, and must factor this into confirmation behavior for outward-facing operations.

---

## Default Behaviors

- **Response verbosity and structure**: By default, CC responds concisely, using plain sentences matched to the complexity of the task. Simple questions receive direct answers without headers or elaborate structure. Users can request more detailed or differently structured responses, but the default skews toward brevity and clarity.

- **Code comment density**: The default is to write no comments in code unless the reasoning is genuinely non-obvious to a future reader. Users can request more comments or a different comment style, but the default explicitly suppresses routine, explanatory, or task-referencing comments.

- **Code style conformance**: By default, CC matches the comment density, naming conventions, and idioms of the surrounding codebase rather than imposing its own style. This default can be influenced by explicit user or CLAUDE.md instruction, but conflicts with surrounding code style should be expected.

- **Over-engineering prevention**: CC defaults to implementing exactly what the task requires — no additional abstractions, helpers, fallbacks, or future-proofing beyond the stated scope. Users can explicitly request refactoring or generalization, but this will not happen by default.

- **Error handling scope**: CC defaults to adding error handling only at genuine system boundaries (user-facing input, external API calls) and not for internal code paths covered by framework guarantees. Users can override this for specific cases.

- **Exploratory question response style**: When users ask open-ended "what should we do?" questions, the default is a short recommendation with a stated tradeoff — not an implementation. CC waits for user agreement before acting. Users can instruct CC to proceed directly to implementation.

- **Backwards compatibility artifacts**: CC defaults to removing unused code cleanly when certain of non-use, rather than leaving compatibility shims, renamed variables, or commented-out remnants. Users can instruct otherwise for specific cases.

- **Clarification behavior**: Before asking the user a clarifying question, CC defaults to spending time on read-only investigation (searching the codebase, checking documentation) to make any question specific and well-grounded. Users can instruct CC to ask questions more freely.

- **Action confirmation threshold (non-background mode)**: The default is to confirm with the user before any irreversible or shared-state-affecting action. Users can explicitly grant broader autonomous operation, which shifts the confirmation threshold — but this authorization is session-scoped unless captured in CLAUDE.md.

- **Thinking block frequency**: CC defaults to skipping extended internal reasoning on simple queries and using it freely on complex ones. This behavior is modulated by system-injected reminders and is not directly user-configurable at the per-message level.

- **Temporary file location**: The default is to use a session-specific scratchpad directory rather than `/tmp` for all intermediate files. Users can explicitly override this for specific cases, but the scratchpad is the default to avoid collision with parallel jobs.

- **Scheduled follow-up offers**: CC may offer to schedule a background agent for future follow-up tasks at most once per session, and only when a concrete future obligation (a named artifact, dated condition, or job ETA) was produced in the current session. This offer is suppressed by default for most task types.

- **Worktree isolation (background/parallel mode)**: When configured for isolated operation, CC defaults to calling the worktree entry tool before any file modification. If the working directory is already under the isolated path, or if worktree entry fails, CC continues in place. Users with `worktree.bgIsolation: none` bypass this entirely.

- **Language of response**: CC defaults to the language configured in the session context. Full orthographic correctness (diacritics, accents, special characters) is required; ASCII substitution for accented characters is prohibited.

---

## CLAUDE.md Redundancy Warning

- **Comment policy**: The system prompt already enforces a minimal-comment default with specific guidance on when comments are appropriate. Adding "write minimal comments" or "only comment non-obvious logic" to CLAUDE.md is fully redundant. Adding "always add comments" or "comment all functions" will conflict and may produce inconsistent behavior depending on instruction precedence resolution.

- **Code scope / anti-over-engineering**: The system prompt already instructs CC to avoid scope creep, speculative abstractions, and premature generalization. CLAUDE.md entries saying "don't over-engineer" or "keep it simple" duplicate existing behavior and are neutral. Entries that encourage defensive coding patterns or extensive fallback handling may conflict.

- **Response length and format**: The system prompt already establishes concise, task-matched responses. CLAUDE.md instructions like "be concise" or "don't use headers for simple answers" are redundant. Instructions to always use a specific format (e.g., always use headers) may conflict with the default for simple queries.

- **Security vulnerability avoidance**: The system prompt already mandates OWASP-aware secure coding. CLAUDE.md entries repeating this are neutral duplication. Instructions that would relax security checks (e.g., "trust all input") will conflict with a hardcoded behavior.

- **Confirmation before risky actions**: The system prompt already configures a confirmation-first default for irreversible or shared-state actions. CLAUDE.md entries saying "always confirm before pushing" are redundant for the default case. CLAUDE.md entries that grant broad autonomous operation are meaningful and non-redundant — they constitute the durable authorization the system prompt refers to.

- **Emoji usage**: The system prompt already suppresses emoji. A CLAUDE.md entry prohibiting emoji is fully redundant. A CLAUDE.md entry permitting or encouraging emoji will effectively enable the opt-in the system prompt requires.

- **Temporary file handling**: The system prompt already routes temporary files to a session scratchpad. CLAUDE.md entries about not using `/tmp` are redundant in background/parallel contexts. In standard interactive sessions, the scratchpad guidance still applies via the system prompt.

- **Honest reporting / verified vs. assumed**: The system prompt already requires accurate distinction between verified and assumed outcomes. CLAUDE.md entries saying "don't claim success unless verified" are redundant. This behavior is also tracked by telemetry.

- **Parallel tool execution**: The system prompt already instructs CC to maximize parallel tool calls for independent operations and to serialize dependent ones. CLAUDE.md entries duplicating this are neutral.

---

## User Actionable Insights

1. **URL generation cannot be unlocked for non-programming use.** The prohibition on speculative URL generation is hardcoded. If your workflow requires CC to produce or suggest URLs for non-programming purposes (documentation links, reference URLs, etc.), you will need to supply those URLs yourself. There is no CLAUDE.md override for this.

2. **Durable autonomous authorization must be captured in CLAUDE.md.** The system prompt's confirmation-before-action default resets each session. If you want CC to push to git, send messages, or take other outward-facing actions without per-action confirmation in every session, you must explicitly grant that authorization in CLAUDE.md. Ad-hoc approvals during a session do not persist.

3. **Scope of authorization is strictly bounded.** Even when you approve an action (such as a git push) in one context, CC will not infer that approval extends to other contexts or future sessions unless durably stated. Be explicit in CLAUDE.md about which action classes are pre-authorized and under what conditions.

4. **The comment-writing default is more aggressive than most developers expect.** CC will write zero comments by default in most code. If your project has a comment convention, your codebase style will naturally influence CC's output (since it mirrors surrounding idiom), but explicit CLAUDE.md guidance about project comment standards is the reliable way to enforce this.

5. **Fast mode is a throughput toggle, not a model downgrade.** Fast mode (`/fast`) accelerates output from Claude Opus without switching to a smaller model. It is available on specific Opus versions. This is version-specific information for v2.1.143 and may change in future releases.

6. **The `/schedule` offer is tightly gated.** CC will only offer to schedule a background agent follow-up when a concrete, named artifact with a datable future obligation was produced in the current turn. It will never invent a timeframe. If you want scheduled follow-ups for tasks that don't produce such artifacts, you must initiate `/schedule` yourself.

7. **Prompt injection from tool results is flagged to you, not silently handled.** If CC suspects a tool result contains an attempt to hijack its instructions, it will tell you before continuing. This is a transparency guarantee — you will not be silently manipulated by a compromised tool result.

8. **Worktree isolation behavior depends on your configuration.** If your project uses `worktree.bgIsolation: none`, CC will operate directly in your working directory for all jobs. If isolation is configured, CC will always attempt to enter an isolated worktree before modifying files. Knowing which mode is active matters for understanding where file changes land during parallel background jobs.

9. **System-reminder tags in messages and tool results are injected by the harness, not by you.** CC is instructed to treat these as internal system instructions, not as user messages. You should not try to use `<system-reminder>` syntax in your own messages to override CC behavior — the system prompt explicitly informs CC of this pattern.

10. **Context window limits are handled by automatic compression, not truncation.** CC is informed that the conversation history will be automatically compressed as it approaches context limits, meaning the conversation is not artificially bounded. However, compressed history means earlier context may be summarized rather than verbatim — be aware of this for long sessions where exact earlier wording matters.

11. **`/ultrareview` is user-triggered and billed; CC cannot self-initiate it.** CC is explicitly instructed that it cannot launch ultrareview via shell commands or any other indirect means. If you ask CC to run ultrareview on your behalf, it will explain this constraint rather than attempting a workaround.

12. **CC's behavior is assembled from multiple composable context functions, not a single monolithic prompt.** Different deployment modes (background session, worktree isolation, interactive) activate different subsets of these assembler functions. Behaviors you observe in one mode may not apply in another — the active configuration is mode-dependent.

---

## Tool & Permission Layer

The system context embeds a detailed explanation of the tool execution model directed at CC itself rather than the user. Key elements of this machinery:

**Permission mode architecture**: Tool execution operates under a user-selected permission mode. Some tools are automatically permitted under the active mode; others require explicit user approval at call time. CC is instructed to treat a user denial as meaningful signal — it must not retry the identical call but must instead reassess its approach and adjust strategy.

**Hook interception**: Tool calls may be intercepted by hooks before execution. CC is instructed to treat any hook-injected output as equivalent to user feedback, meaning hook results carry behavioral weight similar to direct user input.

**System-reminder tag handling**: Tags of the `<system-reminder>` variety appearing in tool results or user messages are injected by the harness infrastructure, not authored by the user. CC is explicitly informed of this distinction so that harness-injected instructions are processed correctly without being attributed to or confused with user intent.

**Parallel and sequential tool execution**: The system context instructs CC to identify independent tool calls and execute them in parallel within a single response turn, while serializing any calls with dependencies on prior results. This is a performance optimization the system prompt hardcodes as preferred behavior.

**Tool preference hierarchy**: CC is instructed to prefer dedicated file and search tools over general shell execution when a dedicated tool fits the operation. Shell-based execution is reserved for operations that have no dedicated tool equivalent.

**Task tracking integration**: CC is instructed to use task management tools to decompose and track multi-step work, marking individual tasks complete as soon as they are finished rather than batching completion marking.

**Context compression notice**: CC is informed that prior conversation messages will be automatically compressed as the context window fills. This allows CC to understand that long conversations are not bounded by a hard token limit, while also being aware that earlier messages may exist in summarized form.

**Subagent spawning threshold**: For broad codebase exploration or research tasks exceeding a defined query threshold, CC is instructed to spawn a subagent rather than handling the task inline. The subagent type is specified by the system context.

**Skill invocation**: When a user invokes a named slash-command skill, CC is instructed to route it through the designated invocation mechanism and to only invoke skills that appear in the system-defined user-invocable skills list — not to guess at skill names or attempt undocumented invocations.

**MCP / external service data handling**: Data arriving from external sources via tool results is subject to the prompt injection flagging requirement. CC is not given blanket trust for externally sourced tool result content.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.143 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| IU7 | Session mode context assembler (worktree isolation variants + background session preamble) |
| YU7 | Action risk and reversibility policy assembler (full and compact variants) |
| _U7 | Text output style and code comment policy assembler |
| vU7 | Scratchpad directory policy assembler |
| qU7 | Thinking block frequency tuning assembler (system-reminder handling) |
| fU7 | Response language and orthographic correctness assembler |
| zU7 | Software engineering task guidance assembler (scope, security, reporting, help signal) |
| jU7 | Scheduling offer policy and subagent/skill routing assembler |
| OU7 | Core tool execution mechanics and harness tag explanation assembler |
| EU7 | Worktree environment notice + model catalog + Fast mode info assembler (with worktree ctx) |
| ZU7 | Model catalog + Fast mode info assembler (without worktree ctx) |
| PU7 | Formatting micro-policy assembler (emoji, code location references, tool call punctuation) |
| DU7 | Parallel tool execution policy and task tracking tool guidance assembler |
| XU7 | Interactive agent role declaration and harness summary assembler |
| AU7 | Compact action-risk and honest-reporting policy assembler |
| $U7 | Primary role declaration and URL generation restriction assembler |
| CU7 | Clarification question cost and pre-investigation requirement assembler |
| K56 | Telemetry event emitter (memory directory, herring clock, team memdir states) |
| Ad_ | Assembler coordinator (no large strings; structural/glue role) |
| S6 | Assembler coordinator (no large strings; early-bundle structural role) |
| yz8 | Assembler coordinator (no large strings; mid-bundle structural role) |
| R_ | Assembler coordinator (no large strings; early-bundle structural role) |
| VT | Assembler coordinator (no large strings; mid-bundle structural role) |
| fd_ | Assembler coordinator (no large strings; late-bundle structural role) |
| QO6 | Assembler coordinator (no large strings; mid-bundle structural role) |
| LU7 | Assembler coordinator (no large strings; system context pipeline role) |
| MU7 | Assembler coordinator (no large strings; system context pipeline role) |
| NU7 | Assembler coordinator (no large strings; late-bundle system context role) |
| yU7 | Assembler coordinator (no large strings; late-bundle system context role) |
| RU7 | Assembler coordinator (no large strings; late-bundle system context role) |