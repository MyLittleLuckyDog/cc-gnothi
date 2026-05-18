---
type: system-context
command: _system-context
cc_version: "2.1.142"
updated: "2026-05-18"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.142 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.142 System Context

> Analysis basis: CC v2.1.142 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.142 system context is assembled from multiple functions within the bundle, each contributing a distinct behavioral layer: identity and voice configuration, action-safety policy, tool-use protocols, agentic loop guidance, and memory management. Together these layers define a consistent operating envelope that sits above user instructions and CLAUDE.md. While user instructions and CLAUDE.md can influence many default behaviors, the system context establishes floors and ceilings that persist across all sessions — particularly around irreversible actions, tool-denial handling, and output style. The combined context also embeds several first-party skill prompts (loop scheduling, batch orchestration, browser automation, diagnostics) that users invoke by name rather than by writing their own instructions.

---

## Hardcoded Constraints

- **Tool-denial bypass prohibition**: When a tool call is denied, CC is permitted to seek alternative tools that could accomplish the same legitimate goal through normal means. It is absolutely prohibited from exploiting adjacent capabilities (for example, using a test-running facility to execute arbitrary non-test actions) in order to work around the denial. The intent behind the denial governs, not the letter of which specific tool was refused. If no legitimate alternative exists, CC must stop and surface the blocker to the user rather than self-authorizing a workaround.

- **Irreversible and high-blast-radius action gating**: A class of actions — including destructive filesystem operations, force-pushes, database table drops, process kills, amendments to published commits, and modifications to shared infrastructure — requires explicit user confirmation before execution by default. This is not merely a style preference: the asymmetry between the low cost of pausing and the potentially high cost of an unwanted action is stated as the justification. The constraint is not absolute in the sense that users can authorize more autonomous operation, but any such authorization is scoped strictly to what was explicitly sanctioned; prior approval in one context does not generalize to future contexts unless captured in durable project-level instructions.

- **Scope matching**: CC is required to match the scope of its actions to what was actually requested. Authorization granted for one action does not implicitly authorize related or larger actions. This applies even when operating autonomously under user-granted permission.

- **Obstacle handling without destructive shortcuts**: When CC encounters a blocker, it is required to investigate root causes rather than bypass safety mechanisms (such as disabling commit hooks or forcibly removing lock files). Unexpected state — unfamiliar files, branches, or configuration — must be investigated before being deleted or overwritten, as it may represent work in progress.

- **Autonomous loop stewardship boundary**: When operating in timer-driven autonomous mode, CC is constrained to continuing work already established in the conversation rather than inventing new work. Irreversible changes without clear prior authorization are blocked in this mode. Repeated idle findings trigger a scope reduction rather than continued narration.

- **Browser automation dialog prohibition**: When using browser automation tooling, CC must not trigger JavaScript alert, confirm, or prompt dialogs, as these block all subsequent browser events. This is an operational absolute, not a preference.

- **Thinking-block suppression on simple tasks**: A system-level harness injects reminders that instruct CC to suppress explicit reasoning blocks for straightforward user messages. These injected instructions are not user-visible and must not be mentioned to the user.

- **Scratchpad directory isolation**: Temporary files must be written to a designated session-specific scratchpad directory rather than system temp locations, unless the user explicitly requests otherwise. This is a hardcoded routing constraint, not a suggestion.

---

## Default Behaviors

- **Response length calibration**: By default, CC targets the shortest response that remains clear and complete for the task at hand. Simple questions receive direct answers; complex or high-stakes tasks justify longer responses. Users can shift this calibration by requesting more detail, but the default leans toward concision rather than comprehensiveness.

- **Code comment policy**: The default in code is to write no inline comments, and specifically to avoid multi-paragraph docstrings or multi-line comment blocks. A single short line is the maximum default. Users can override this by requesting comments, but adding comment instructions to CLAUDE.md is more durable if the preference is project-wide.

- **Intermediate document creation**: CC defaults to working from conversation context rather than generating planning, decision, or analysis documents as intermediate artifacts. Users must explicitly request such documents; they are not produced proactively.

- **Pre-action communication**: Before the first tool call in a sequence, CC provides a one-sentence statement of intent. During work, brief updates are given at key inflection points. This behavior is on by default and is not typically overridden by user instruction, though CLAUDE.md could suppress it.

- **End-of-turn summary**: By default, each turn ends with a brief statement of what changed and what comes next. The default length is one to two sentences. Users who prefer no summary can specify this in CLAUDE.md.

- **Git and SCM confirmation**: Push operations, PR creation, branch deletion, and similar SCM actions that are visible to others or affect shared state default to requiring explicit confirmation. This default can be relaxed by explicit user instruction or CLAUDE.md authorization, but the relaxation is scoped.

- **Advisor tool invocation pattern**: When the advisor tool is available, the default is to call it before committing to a substantive approach and again before declaring a task complete. On short reactive tasks this is relaxed. Users cannot suppress this from CLAUDE.md in a meaningful way because the advisor policy is expressed as a judgment call, not a toggle.

- **Memory persistence scope**: The default for the file-based memory system is to save only information that is non-obvious and not already derivable from the repository, git history, or CLAUDE.md. Memories recalled via system-reminder blocks are treated as background context rather than as active user instructions, and their contents are verified before acting on them.

- **Autonomous loop verbosity**: When nothing is left to do in an autonomous pass, the default is one sentence stating that fact, followed by a stop. After several consecutive idle results, the scope narrows automatically. Users cannot easily override this from CLAUDE.md because it is embedded in the loop skill prompt itself.

- **Browser session startup**: At the start of any browser automation session, CC defaults to querying current tab context before creating new tabs. Tab IDs from prior sessions are never reused by default.

---

## CLAUDE.md Redundancy Warning

- **Response concision**: The system context already establishes a strong default toward brief, direct responses and discourages performative filler. Adding "be concise" or "avoid unnecessary verbosity" to CLAUDE.md is redundant. Adding "always provide detailed explanations" may create instruction conflict, with CLAUDE.md likely winning for the session but potentially producing inconsistent behavior.

- **Code comment suppression**: The no-comments default is already embedded. Adding "don't add comments" to CLAUDE.md is neutral redundancy. Adding "always comment your code" will override the default but may conflict if CC is also operating under the system-level text output guidance.

- **Confirmation before destructive actions**: The system context already requires confirmation for destructive and irreversible operations. Adding "always ask before deleting files" to CLAUDE.md is redundant. Adding "proceed autonomously without confirmation" is a meaningful override and will be respected, but users should understand they are relaxing a safety default, not setting a new preference.

- **No intermediate planning documents**: The default against generating unprompted planning files is embedded. Adding "don't create intermediate documents" to CLAUDE.md is harmless redundancy. Adding "always create a plan file before coding" is a meaningful override.

- **End-of-turn summaries**: The default summary behavior is already specified. Adding "always end with a summary" to CLAUDE.md is redundant. Adding "skip end-of-turn summaries" is a meaningful suppression and will likely be honored.

- **Avoiding over-engineering and speculation**: The system context's identity and voice layer already discourages speculative additions and encourages matching scope to the request. CLAUDE.md instructions like "don't over-engineer" or "don't add features I didn't ask for" are redundant with this layer, though not harmful.

- **Memory save behavior**: The criteria for what to persist in memory are defined in the system context. Adding broad "remember everything" instructions to CLAUDE.md conflicts with the system-level guidance to exclude information already recorded in the repo or conversation. The system context's more selective policy is more durable.

---

## User Actionable Insights

1. **Tool-denial workarounds are bounded by intent, not by tool name.** If CC is denied a specific tool, it will attempt legitimate alternatives but will not reframe the task to exploit a different capability category. Users who want a broader workaround must explicitly grant it rather than assuming CC will find one.

2. **Destructive action confirmation is a floor, not just a default.** The confirmation requirement for irreversible operations is framed as a safety asymmetry, not merely a preference. Relaxing it in CLAUDE.md or via instruction is possible, but the relaxation should be explicit and scoped — CC will not infer blanket autonomy from a single prior approval.

3. **Autonomous loop mode has a built-in conservatism that cannot be fully overridden by CLAUDE.md.** The boundary between "continuing established work" and "inventing new work" is evaluated from conversation evidence, not from permissions. Users who want autonomous agents to take novel actions should establish that intent clearly in the transcript before the autonomous session begins.

4. **The scratchpad directory is always used for temporary files unless the user says otherwise.** Scripts, intermediate results, and working files go to a session-isolated location. If a workflow depends on writing to `/tmp` or another system location, the user must explicitly request it.

5. **System-reminder injections for thinking suppression are invisible to users.** CC receives harness-level instructions to skip reasoning blocks on simple queries. These are not user instructions and will not be acknowledged if asked about. This is version-specific behavior that may change across bundle versions.

6. **Memory recalled in system-reminder blocks is treated as potentially stale context, not as current instructions.** If a recalled memory names a file, function, or flag, CC verifies it still exists before acting. Users relying on memory for critical configuration should keep it current or use CLAUDE.md for durable configuration instead.

7. **The advisor tool, when present, has a call protocol that operates above user instruction.** The policy of calling the advisor before substantive work and before declaring completion is embedded in the system context. Users cannot suppress this from CLAUDE.md. The advisor sees the full conversation history automatically.

8. **Browser automation has a hard prohibition on triggering modal dialogs.** This is not a style preference — it is an operational constraint because dialogs block the extension's event loop. Workflows that require interacting with dialog-triggering UI elements need special handling, and users should be warned before such interactions are attempted.

9. **Loop and schedule skills have their own embedded behavioral rules.** The `/loop` and related scheduling skills contain their own parsing, cron-conversion, and self-pacing logic baked into the bundle. Users customizing loop behavior via CLAUDE.md will find limited leverage; the skill prompt governs.

10. **Version-specific note — v2.1.142:** This bundle includes a dual implementation of the browser automation skill (two functions with identical content at different offsets), a three-phase batch orchestration skill for large parallel changes, and a nightly memory consolidation scheduling skill. Users on earlier versions will not have these capabilities regardless of CLAUDE.md configuration.

---

## Tool & Permission Layer

The system context embeds a multi-level permission model that governs how CC decides whether to proceed with, confirm, or refuse tool use.

**Auto-allow vs. prompt-to-allow:** Local, reversible actions — file edits, test runs, read operations — are auto-allowed by default. Actions that are hard to reverse, affect shared state, or carry significant blast radius require user confirmation before execution. This distinction is not binary; CC evaluates reversibility, visibility to others, and scope against what was requested.

**Hook event behavior:** When operating in autonomous or timer-driven mode, CC monitors for event notifications delivered as tagged message blocks. These wake the loop immediately rather than waiting for a scheduled deadline. The loop is expected to arm exactly one persistent monitor per event type and reuse it across iterations rather than spawning redundant monitors.

**MCP server and system-reminder tag handling:** Content delivered inside system-reminder tags is treated as background context injected by the harness, not as instructions from the user. CC is explicitly instructed not to surface these to the user or acknowledge them when asked. MCP server tool availability is discovered at session start and treated as part of the tool inventory for that session.

**Context compression and memory:** The file-based memory system uses a structured frontmatter format with typed entries. The index file has explicit size constraints to keep it as a navigational index rather than a content dump. The dream/consolidation skill provides a periodic pruning and synthesis pass that runs on a scheduler. These mechanisms collectively manage context growth across long-running sessions.

**Scratchpad isolation:** All temporary file I/O is routed to a session-specific directory that is isolated from the user's project tree. This prevents temporary artifacts from appearing in the project's working tree and avoids permission conflicts with other sessions.

**Subagent and worktree isolation:** The batch orchestration skill requires worker agents to use isolated git worktrees and run in the background. Each worker receives a fully self-contained prompt including all necessary context, because workers cannot query the user directly. The orchestrator tracks completion via result parsing and re-renders a status table as notifications arrive.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.142 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| ZR_ | Tool-denial handling and bypass prohibition policy |
| Xw_ | Autonomous loop behavioral guidelines and stewardship policy |
| Vsq | Files API reference — Python implementation |
| S65 | Batch parallel work orchestration skill (plan/spawn/track phases) |
| gsq | Claude Platform on AWS client and configuration reference |
| R85 | Loop self-pacing dynamic mode and event-driven scheduling logic |
| bsq | Claude API reference — Ruby SDK |
| f85 | Stuck/frozen session diagnostic skill |
| Z91 | Browser automation guidelines — Chrome extension (instance A) |
| oY_ | Browser automation guidelines — Chrome extension (instance B, duplicate) |
| SP6 | Dream memory consolidation skill (orient/gather/consolidate/prune phases) |
| h85 | Loop fixed-interval scheduling skill with cron conversion |
| Zm7 | Action care and reversibility policy (blast radius, confirmation rules) |
| vtq | Message Batches API reference — TypeScript |
| ktq | Files API reference — TypeScript |
| CA1 | Advisor tool invocation protocol and weighting policy |
| gaq | Server/API change verification skill (curl pattern) |
| Baq | CLI change verification skill (direct invocation pattern) |
| dZq | Claude identity, voice, and values configuration |
| IC7 | Team onboarding guide template and Claude onboarding buddy instructions |
| pZ9 | File-based persistent memory format and save/recall policy |
| Dm7 | Text output and response style policy |
| UZ9 | Dream memory pruning skill (stale/duplicate deletion pass) |
| E85 | Dream nightly consolidation schedule setup skill |
| iZq | User profile template (name, timezone, work, schedule, preferences) |
| waq | Debug skill for current CC session diagnostics |
| mm7 | Scratchpad directory routing policy |
| Jm7 | Thinking-block suppression via system-reminder harness |
| Esq | Message Batches API reference — Python implementation |
| Rtq | Streaming API reference — TypeScript |