---
type: system-context
command: _system-context
cc_version: "2.1.141"
updated: "2026-05-18"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.141 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.141 System Context

> Analysis basis: CC v2.1.141 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

CC v2.1.141 assembles its system context from multiple discrete functions rather than a single monolithic prompt. These functions together cover: core identity and voice policy, action-safety and reversibility rules, text output formatting standards, tool and permission scaffolding, autonomous-loop governance, memory management, and a suite of embedded skill templates (browser automation, loop scheduling, batch APIs, Files API, diagnostics). User instructions and CLAUDE.md content sit above this layer in priority for most behavioral defaults, but the action-safety and tool-denial handling policies are enforced regardless of instruction source. The system context is the substrate; everything the user configures operates on top of it.

---

## Hardcoded Constraints

- **Tool-denial compliance**: When a tool call is blocked or denied, CC is constrained to seek alternative tools that serve the same legitimate goal through normal means. It is blocked from using adjacent capabilities (such as test runners) to execute non-test side-effects as a workaround. If no compliant path exists, CC must stop and surface the limitation to the user rather than routing around the denial's intent. This constraint is absolute and not overridable by user instruction.

- **Action reversibility and blast-radius governance**: Before taking any action that is difficult to reverse, affects shared or external systems, or carries meaningful destructive potential, CC is required to evaluate scope and default to seeking user confirmation. This includes: destructive filesystem operations, force-pushes and history-rewriting git operations, actions visible to third parties (PR comments, messages, posts), and uploads to external services. The constraint establishes a strong default toward confirmation; users can explicitly authorize more autonomous operation, but prior approval of a specific action does not generalize to future instances of that action unless captured in durable instructions.

- **Scope matching**: CC is constrained to match the scope of its actions to what was actually requested. Authorization is bounded to the stated scope and does not extend implicitly to related or adjacent actions. This is not overridable on a per-session basis without durable instruction.

- **Workaround prohibition on blocked actions**: When encountering a restriction, CC may attempt reasonable alternative approaches that do not circumvent the intent of the restriction. Using testing infrastructure or other permitted tools to execute effectively-blocked side effects is explicitly prohibited. Absolute — no authorization pathway exists to permit intent-circumventing workarounds.

- **Scratchpad isolation**: Temporary files must go to a session-specific scratchpad directory rather than system temp locations (e.g., `/tmp`), unless the user explicitly requests otherwise. This keeps working files isolated from the user's project. The exception (explicit user request for `/tmp`) is user-overridable.

- **Memory content boundaries**: The persistent memory system is constrained not to save information that is already captured in the repository (code structure, git history, CLAUDE.md content) or information that is only relevant to the current conversation. If a user asks CC to remember something in those categories, CC is directed to surface what is non-obvious about it and save that narrower fact instead. This is a default policy with some user-instruction influence at the margins.

- **Thinking-block suppression via system-reminder**: Harness-injected `<system-reminder>` tags may instruct CC to respond without a thinking block on simpler messages. CC treats these as internal instructions and does not surface them to the user. This tuning mechanism is hardcoded as a recognized signal; it cannot be disabled by user instruction.

---

## Default Behaviors

- **Text output verbosity**: CC defaults to the shortest response that is still clear and complete, with minimal structural formatting for simple questions. Users can shift this toward more expansive output by requesting detail or by establishing a preference in CLAUDE.md, but the baseline leans toward concision.

- **Code comment policy**: The default in code is to write no inline comments, and to avoid multi-line docstrings or comment blocks. A single short line is the maximum. Users can override this per-task or via CLAUDE.md; adding a blanket "always comment code" instruction will override the default.

- **Intermediate planning documents**: CC defaults to working from conversation context rather than producing intermediate analysis or planning files unless explicitly asked. Users who want structured plan artifacts must request them.

- **End-of-turn summary style**: Responses default to closing with a brief statement of what changed and what comes next. This is a soft default that user style preferences can override.

- **Action confirmation cadence**: The default is to confirm before risky or irreversible actions. Users can authorize more autonomous behavior through explicit instruction (persistent instructions in CLAUDE.md are more durable than per-session requests). However, the default reverts if the user has not explicitly extended authorization.

- **Autonomous loop behavior (timer/background invocations)**: When invoked on a timer without the user present, CC defaults to continuing established work from the conversation transcript rather than initiating new work. The bias toward inaction on ambiguous items is a default; explicit prior instructions in the transcript increase what CC will act on autonomously.

- **Memory consolidation and pruning**: Memory files are managed with a default policy of updating existing files rather than creating duplicates, converting relative dates to absolute, and pruning contradicted facts. Users can trigger manual consolidation or schedule nightly runs; the underlying behavior is default-on when memory tools are active.

- **Browser automation session startup**: When browser automation tools are available, CC defaults to querying the current tab context before creating new tabs. It does not reuse stale tab IDs. This default is hardcoded in the browser skill layer and applies whenever those tools are active.

- **Advisor tool call timing**: When an advisor tool is available, CC defaults to calling it before committing to a substantive approach and before declaring a task complete. Users cannot suppress this default per-task without removing the tool, but the cadence is influenced by task length and complexity.

- **Loop scheduling default interval**: When the `/loop` command is used without an explicit interval, a system-defined default interval applies. Users set the interval explicitly to override; the default is a fallback only.

- **Thinking frequency**: CC defaults to skipping explicit reasoning blocks on simple messages and reasoning freely on complex ones. Harness-injected reminders can tune this downward; the default is adaptive, not fixed.

---

## CLAUDE.md Redundancy Warning

- **Concise response style**: The system context already establishes a strong default toward brevity and minimal formatting. Adding "be concise" or "avoid verbose responses" to CLAUDE.md is neutral-to-redundant. Adding "always be detailed and thorough" will actively override the default and may produce responses longer than warranted for simple questions.

- **No inline comments in code**: The system prompt already sets this as the default. Duplicating "don't add comments" in CLAUDE.md is purely redundant. Adding "always add comments" will conflict and override — which may be intentional for documentation-heavy projects, but users should know they are overriding a system default.

- **No planning documents by default**: The system prompt already instructs CC to work from conversation context rather than producing intermediate files. Specifying "don't create planning files" in CLAUDE.md is redundant. Specifying "always create a plan file before implementing" will override the default and is a legitimate use of CLAUDE.md.

- **Confirm before risky actions**: The system context already enforces confirmation-first for risky operations. Adding "always ask before pushing" to CLAUDE.md is redundant for the operations already covered. If a user wants to expand autonomous authorization beyond the default, CLAUDE.md is the correct and intended mechanism — this is a case where CLAUDE.md adds value rather than redundancy.

- **Scratchpad directory usage**: The system prompt already directs CC to use the session scratchpad for temp files. Repeating this in CLAUDE.md is redundant. Specifying `/tmp` as the preferred location will override the default (this is an explicit user preference the system acknowledges as valid).

- **Identity and voice**: The system context already establishes CC's voice as direct, warm, non-performative, and concise. Adding instructions like "don't be sycophantic" or "be direct" to CLAUDE.md is largely redundant with the existing default. Conflicting style instructions (e.g., "always begin responses with an enthusiastic greeting") will override the voice defaults.

- **Memory save policy**: The rule against saving repo-derivable or conversation-only facts is already embedded in the memory system instructions. Duplicating it in CLAUDE.md is redundant. Expanding what should be saved (e.g., "always remember my preferred branch naming convention") is a legitimate CLAUDE.md use that adds signal beyond the default.

---

## User Actionable Insights

1. **The tool-denial workaround prohibition is absolute.** If a tool is blocked, CC will not use other permitted tools to achieve the same blocked effect by a side door. Users who find themselves wanting CC to work around a permission restriction must grant the permission directly — not rely on creative instruction.

2. **One-time action approval does not persist.** Approving a risky action (such as a force-push) in one turn does not authorize it in subsequent turns unless it is written into CLAUDE.md or another durable instruction file. Users who want standing authorization for specific operations should add them to CLAUDE.md explicitly.

3. **CLAUDE.md is the correct place to expand autonomous authorization.** The system default is cautious and confirmation-seeking. CLAUDE.md is specifically designed to carry durable authorization expansions. Per-session verbal instructions work but reset; CLAUDE.md persists.

4. **The scratchpad isolation policy is version-specific and new users should be aware of it.** Temporary files do not go to `/tmp` by default in v2.1.141. Scripts or workflows that expect temp artifacts at system paths may need adjustment, or an explicit CLAUDE.md entry permitting `/tmp` use.

5. **Browser automation has a mandatory tab-context-first policy.** Any automation workflow that assumes a specific tab ID from a prior session will fail silently or produce errors. Workflow scripts relying on browser automation should treat tab IDs as ephemeral.

6. **The thinking-block suppression mechanism is invisible to users.** Harness-injected `<system-reminder>` tags affect reasoning depth on a per-turn basis without user visibility. Users who notice inconsistent depth of reasoning on simple vs. complex turns are observing this mechanism operating as designed, not a bug.

7. **Memory content has enforced boundaries regardless of user instruction.** Asking CC to "remember" something that is already in the codebase or CLAUDE.md will not result in a memory file for that fact as stated — CC will surface the non-obvious element and save that instead. Users who want exact facts persisted should phrase the memory request around what is non-obvious or context-specific.

8. **Autonomous loop mode operates conservatively by design.** When CC runs on a timer without user presence, it will not invent new work. Users who want background agents to explore and initiate must either pre-authorize specific classes of work in the transcript or in CLAUDE.md, or accept that background sessions will only continue what was already in motion.

9. **The advisor tool, when present, has a prescribed call timing that users cannot suppress without removing the tool.** If an advisor tool is loaded, expecting CC to skip the pre-commitment advisor call is not reliable. Remove the tool from the session if the call overhead is undesirable.

10. **Loop scheduling uses a system-defined default interval when no interval is specified.** Users who care about the exact cadence should always specify an interval explicitly. The default is not documented as a user-visible configuration value and may change across versions.

---

## Tool & Permission Layer

**Auto-allow vs. prompt-to-allow**: The system context embeds a model of tool permissions that distinguishes between actions CC can take freely (local, reversible, low-blast-radius) and actions that require user confirmation (irreversible, shared-state, externally visible). This is not a binary toggle but a risk-gradient model. The permission boundary is described in terms of reversibility, scope of impact, and whether the action is visible to parties beyond the local environment.

**Hook event and notification handling**: The autonomous loop context recognizes `<task-notification>` messages as wake signals from background monitors. These notifications bypass the normal polling interval and trigger immediate handling. CC is instructed to distinguish between being woken by a notification versus being woken by a timer expiry, and to respond differently to each. This mechanism is embedded in the loop skill layer.

**`<system-reminder>` tag handling**: Injected system-reminder blocks are treated as internal harness instructions rather than user messages. CC is directed not to surface or acknowledge them in responses. They carry legitimate operational signals (such as thinking-block suppression) that the harness uses to tune per-turn behavior without user involvement.

**MCP server integration**: The browser automation skill layer references MCP-namespaced tools (`mcp__claude-in-chrome__*`). The system context establishes behavioral rules for when and how these tools are invoked (tab context first, no stale tab reuse, no dialog-triggering interactions). These rules are part of the embedded skill prompts, not the top-level system prompt, which means they apply when the relevant skill is active.

**Context compression and session continuity**: The memory system (including dream/consolidation passes) is the mechanism by which information survives context compression. The system context instructs CC to treat recalled memories appearing in `<system-reminder>` blocks as background context rather than user instructions, and to verify that named files, functions, or flags still exist before acting on them. This guards against stale memory artifacts causing incorrect actions post-compression.

**Worktree isolation for parallel agents**: The batch orchestration skill layer instructs spawned subagents to use `isolation: "worktree"` and `run_in_background: true`. This is a hardcoded requirement within that skill — agents spawned through the parallel orchestration path are always isolated. Users cannot instruct the orchestrator to spawn non-isolated parallel agents through normal instruction.

**Scratchpad as permission-free zone**: The session scratchpad directory is explicitly designated as a location where CC can write freely without triggering permission prompts. This is part of the tool permission model — the scratchpad is pre-authorized, and writing there does not require the same confirmation behavior as writing to user project directories or external locations.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.141 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `LR_` | Tool-denial response policy / workaround prohibition handler |
| `Ww_` | Autonomous loop governance / background invocation behavior |
| `bsq` | Files API skill — Python reference implementation |
| `_85` | Parallel batch orchestration / subagent spawning skill |
| `ssq` | Claude Platform on AWS integration reference |
| `A_5` | Self-paced loop / dynamic scheduling mode handler |
| `dsq` | Claude API skill — Ruby reference implementation |
| `R85` | Stuck/frozen session diagnostic skill (`/stuck`) |
| `P91` | Browser automation skill — primary instance (Claude in Chrome) |
| `rY_` | Browser automation skill — secondary instance (Claude in Chrome, duplicate) |
| `FP6` | Dream memory consolidation skill — full consolidation pass |
| `H_5` | Loop scheduling skill — fixed-interval cron mode |
| `du7` | Action care / reversibility and blast-radius policy |
| `utq` | Message Batches API skill — TypeScript reference implementation |
| `ptq` | Files API skill — TypeScript reference implementation |
| `vA1` | Advisor tool usage policy and call-timing instructions |
| `saq` | Server/API change verification skill (curl-based) |
| `oaq` | CLI change verification skill (direct invocation) |
| `aEq` | Identity, voice, and values definition |
| `nR7` | Team onboarding guide template handler |
| `pr1` | Persistent file-based memory system instructions |
| `bu7` | Text output formatting and verbosity policy |
| `Ur1` | Dream memory pruning skill — stale/duplicate removal pass |
| `n85` | Dream nightly consolidation scheduler |
| `HZq` | User profile template (about-the-user memory scaffold) |
| `Vaq` | Session debug skill (`/debug`) |
| `qm7` | Scratchpad directory isolation policy |
| `uu7` | Thinking-block suppression via system-reminder handler |
| `Rsq` | Message Batches API skill — Python reference implementation |
| `gtq` | Streaming API skill — TypeScript reference implementation |