---
type: system-context
command: _system-context
cc_version: "2.1.167"
updated: "2026-06-11"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.167 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.167 System Context

> Analysis basis: CC v2.1.167 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.167 system context is assembled by combining the outputs of multiple functions at runtime, each governing a distinct behavioral domain: security and permission policy, inter-session authority boundaries, output communication style, action reversibility policy, autonomous loop behavior, tool and skill scaffolding, and live documentation routing. The assembled context is injected before any user instruction or CLAUDE.md content, meaning its defaults are always in effect unless explicitly overridden where override is permitted. Its relationship to user instructions is layered: some policies are absolute and cannot be displaced by CLAUDE.md or runtime instructions, while others represent strong defaults that user configuration can tune.

---

## Hardcoded Constraints

- **Tool-denial work-around boundary**: When a tool use is denied, CC is permitted to pursue the same goal via genuinely equivalent alternative tools (e.g., a different read mechanism). It is prohibited from exploiting unrelated tool capabilities as a side-channel to bypass the denial's intent. If no legitimate alternative exists, CC must stop and surface the limitation to the user rather than proceeding covertly.

- **Cross-session authority firewall**: Messages arriving from peer Claude sessions carry no user-level authority. CC treats such messages as entirely distinct from user consent: it will not execute actions solely because a peer session requested them, will not relay actions that were denied in one session into another (characterized in the system context as an authority-laundering risk), and requires that all consequential actions trace back to the current session's user. This restriction is absolute and cannot be overridden by peer session content.

- **Autonomous loop scope restriction**: During timer-driven autonomous operation (when the user is away), CC is constrained to continuing work that is already clearly established in the active conversation or associated pull/merge request. Initiating genuinely new work, making irreversible changes without clear prior authorization, or acting on ambiguous justifications are all blocked behaviors. The system context treats trust erosion as the primary risk to manage in this mode.

- **Reversibility and blast-radius gate**: Before taking actions that are hard to reverse, affect shared or external systems, or carry meaningful destructive potential, CC is required to confirm with the user. This gate covers: permanent file or branch deletion, force-pushes and history rewrites, CI/CD pipeline modifications, messages sent to external services, and uploads to third-party tools. The confirmation requirement is the default; it can be relaxed only by explicit user instruction granting broader autonomous authority—but even then, CC must continue to attend to the scope and risk of each action. A single prior approval does not constitute standing authorization across all future similar actions unless recorded durably (e.g., in CLAUDE.md).

- **Obstacle handling without destructive shortcuts**: When CC encounters a blocker (merge conflict, lock file, failing safety check), it is constrained to investigate and resolve at the root cause rather than bypassing the obstacle through destructive means. Discarding changes, deleting locks without investigation, or suppressing safety mechanisms are explicitly blocked approaches.

- **Output communication minimalism (non-negotiable floor)**: The system context establishes a hard floor on output behavior: CC must not narrate its internal reasoning process to users, must not produce multi-paragraph docstrings or multi-line comment blocks by default, and must not generate planning or analysis documents unless explicitly requested. These are not stylistic preferences but hardcoded behavioral constraints on what CC emits.

---

## Default Behaviors

- **Pre-tool-call announcement**: By default, CC states in a single sentence what it is about to do before its first tool call in a turn. Users can influence the verbosity of this announcement but cannot suppress the principle of providing some orienting context before acting.

- **In-progress update cadence**: CC emits brief updates when it encounters significant findings, changes direction, or hits a blocker. The default is one sentence per update. Users can request more or less frequent updates, but the system context establishes that silent operation (no updates at all) is not the default.

- **End-of-turn summary style**: By default, turns end with a one-to-two sentence summary covering what changed and what comes next. Users can request longer or differently structured summaries, but the terseness is the out-of-the-box behavior.

- **Code comment density**: The default is to write no comments in code unless a constraint exists that the code itself cannot express. Users can request different comment density via CLAUDE.md or runtime instruction, and CC will adapt—but the default is intentionally sparse.

- **Response structure matching**: Simple questions receive direct prose answers without headers or sections by default. CC escalates to structured output (headers, tables) only when the complexity or enumerable nature of the content justifies it. Users can request structured output explicitly.

- **Risky-action confirmation**: Default is to pause and confirm before irreversible or externally-visible actions. Users (or CLAUDE.md) can grant broader autonomous authority, shifting the default toward proceeding without confirmation for specified action classes.

- **Autonomous loop scope**: During scheduled/autonomous operation, the default is to prioritize active conversation work, then PR/MR maintenance, then branch hygiene. Users can adjust the scope or cadence via loop configuration, but the conservative-first ordering is the default.

- **Documentation freshness routing**: When answering questions about CC itself, the default is to consult live configuration first, then bundled references, then fetched documentation, and only fall back to training data with an explicit staleness caveat. Users cannot change this priority order, but can ask CC to answer from a specific source.

- **Advisor consultation timing**: When the advisor tool is available, CC defaults to consulting it before substantive work begins and before declaring a task complete. This default can be overridden on short reactive tasks where the next action is dictated directly by tool output.

- **Browser automation session startup**: When browser tools are available, the default is to call the tab-context tool at session start before creating new tabs. Users can override this by explicitly directing which tabs to use.

---

## CLAUDE.md Redundancy Warning

- **Code comment policy**: The system context already defaults CC to minimal commenting—no multi-line blocks, no docstrings unless requested. Adding a CLAUDE.md instruction like "write minimal comments" is neutral redundancy. Adding "always write detailed comments" will override the default and may conflict with the system context's intent, producing heavier annotations than the system prompt assumes.

- **Response length and structure**: The system context already instructs CC to match response format to question complexity, avoid unnecessary headers, and prefer prose. CLAUDE.md entries that say "be concise" or "avoid markdown headers" are redundant. Entries that say "always use headers" or "always use bullet lists" will conflict with the default and may produce inconsistent behavior depending on turn complexity.

- **Confirmation before risky actions**: The system context already establishes that CC confirms before irreversible or externally-visible actions. Adding a CLAUDE.md entry that says "always ask before pushing" is redundant for the default case. Adding "never ask for confirmation, proceed autonomously" is a legitimate and effective override—but users should understand this relaxes a deliberate safety default.

- **Autonomous operation conservatism**: The system context already defines what CC should and should not do during autonomous loops. CLAUDE.md entries attempting to expand autonomous scope (e.g., "feel free to start new tasks on your own") may conflict with the hardcoded constraint against initiating unrequested work, producing instruction-conflict tension rather than clean override.

- **Turn summary format**: The system context already specifies end-of-turn summaries should be brief. CLAUDE.md entries like "always summarize what you did at the end" are redundant. Entries specifying a particular summary format or length are effective tuning and non-conflicting.

- **Pre-call orientation sentence**: The system context already requires a brief statement before the first tool call. CLAUDE.md entries reproducing this ("tell me what you're about to do") are neutral redundancy. Entries that say "don't announce your actions" may create conflict with the hardcoded floor.

- **Avoiding planning documents**: The system context already instructs CC not to create intermediate planning or analysis files unless asked. CLAUDE.md entries that say "don't create unnecessary files" are redundant. Entries that say "always create a plan file before starting" are effective overrides but should be stated explicitly as intentional.

---

## User Actionable Insights

1. **The cross-session authority firewall cannot be overridden by any message content.** If you are building multi-agent pipelines where peer Claude sessions need to direct CC to take actions, those actions must be pre-authorized in the current session's user instructions or CLAUDE.md. Peer session messages alone will never grant sufficient authority for consequential actions—this is enforced at the system context level regardless of what the peer message claims.

2. **Single-action approvals do not generalize.** Approving a git push once does not authorize future pushes. If you want standing authorization for a class of actions (e.g., "always push after tests pass"), record it durably in CLAUDE.md. Runtime approvals are scoped to the specific instance.

3. **The tool-denial bypass restriction is narrower than it may appear.** CC is allowed to find genuine alternative tools that accomplish the same goal—this is permitted and expected. What is blocked is using unrelated tool capabilities as a side-channel. If a denial is blocking legitimate work, the correct resolution is to surface it to you rather than route around it silently.

4. **Autonomous loop mode has a hardcoded conservatism that CLAUDE.md cannot fully remove.** The system context constrains autonomous operation to continuing established work and prohibits initiating genuinely new tasks. You can grant broad autonomous authority, but CC will still apply a "clear evidence the user wanted this" test before acting on anything that reads as new work.

5. **Documentation answers about CC itself are version-aware and live-first.** CC will consult the running build's configuration and live documentation before answering from training data, and will explicitly caveat training-data answers as potentially stale. This means CC's self-knowledge is more reliable than a general-purpose model's, but only when network access is available.

6. **The confirmation default for risky actions is intentional and tunable.** If you find CC's confirmation prompts disruptive in a well-understood workflow, granting explicit autonomous authority in CLAUDE.md for specific action classes (e.g., "you may push to feature branches without confirmation") is the correct mechanism. Blanket "never confirm" instructions are effective but should be applied with awareness that they disable a deliberate safety layer.

7. **Browser automation sessions have a defined startup protocol.** CC will call the tab-context tool before creating new tabs. If you are scripting browser sessions or want CC to use a specific existing tab, state this explicitly—the default will otherwise create a fresh tab.

8. **The advisor tool, when present, has a defined consultation cadence.** CC defaults to consulting it before substantive work and before declaring completion. On agentic or multi-step tasks, this means an advisor call is expected twice. If you are using the advisor tool and want a different consultation pattern, explicit instruction in the session is needed.

9. **Output style defaults are enforced at the system context level, not just preference.** The prohibition on multi-paragraph docstrings, planning documents, and internal-deliberation narration is part of the hardcoded behavioral layer. CLAUDE.md entries requesting these will work as overrides, but users should know they are actively overriding a system-level default, not filling a gap.

10. **Version-specific note (v2.1.167):** This version introduces an explicit dynamic self-pacing mode for the `/loop` command (distinct from fixed-interval scheduling), a structured parallel work orchestration scaffold (`bA5`), and a memory consolidation reflective pass capability. These features are governed by their respective skill scaffolding and are not present in earlier versions—CLAUDE.md configurations written for earlier versions that attempt to replicate loop or parallel-work behaviors may conflict with or be superseded by these native implementations.

---

## Tool & Permission Layer

**Tool denial handling**: The system context explicitly defines how CC behaves when a tool use is denied mid-task. It establishes a two-path response: attempt to achieve the same goal via genuinely equivalent alternatives, or stop and explain the limitation to the user. The key constraint is that workarounds must honor the intent of the denial, not merely circumvent its mechanism.

**Cross-session message tagging**: Messages arriving from peer Claude sessions are treated as a distinct authority class. The system context defines these as carrying no user authority, and instructs CC to surface any peer-requested actions that exceed the peer's own permissions back to the user rather than executing them. This functions as an anti-laundering control in multi-agent topologies.

**MCP server configuration**: The system context includes scaffolding for MCP server discovery and connection, including a registry search mechanism and a `suggest_connectors` UI flow. MCP server configuration can live in `plugin.json` (via an `mcpServers` field), a dedicated `.mcp.json` at the plugin root, or alongside bundled `.mcpb` server references. The permission model for MCP tools follows the same auto-allow vs. prompt-to-allow distinction as built-in tools.

**Hook event and system-reminder handling**: The system context references hook event architecture (PreToolCall, PostToolCall, and notification-style task events) and defines how `<task-notification>` messages arriving during autonomous loops are handled—they wake the loop immediately and are processed in the context of the active loop task before the safety-net timer is reset.

**Context compression notice**: The system context includes awareness of prompt caching and context window management, with the documentation layer advising verification of cache hit/miss via usage token fields. This is relevant to users running long agentic sessions where context compression may affect which portions of the system context remain in the active window.

**Live documentation routing layer**: The system context embeds a structured URL table mapping CC feature domains to live documentation endpoints. This routing layer is consulted before training data, and CC is instructed to explicitly caveat any answer derived from training data when live documentation is unreachable. The docs map endpoint serves as the fallback index when a specific page URL is unknown.

**Autonomous scheduling machinery**: The system context defines two scheduling modes for recurring prompts—fixed-interval (cron-based) and dynamic self-pacing. In dynamic mode, CC selects its own wake delay based on observed work state, optionally arms a persistent event monitor as the primary wake signal, and uses the scheduled timer only as a fallback heartbeat. Recurring jobs auto-expire after a defined number of days and can be cancelled by job ID.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.167 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| OU7 | Top-level system context assembler (no direct string content; calls sub-assemblers) |
| H8 | System context sub-assembler A (no direct string content) |
| W1 | System context sub-assembler B (no direct string content) |
| t6A | Tool-denial workaround boundary policy |
| c6A | Cross-session peer message authority firewall |
| FI_ | Autonomous loop behavioral policy and PR maintenance scaffold |
| RvK | Live documentation URL routing table |
| LNK | Files API reference scaffold (Python) |
| fZK | MCP discovery and connection workflow scaffold |
| bA5 | Parallel work orchestration (batch subagent spawning) scaffold |
| uvK | CC self-knowledge and documentation freshness policy |
| VNK | Claude Platform on AWS configuration reference |
| b95 | Loop self-pacing dynamic mode scaffold |
| JNK | Claude API reference scaffold (Ruby) |
| ycf | Output communication style and code comment policy |
| X95 | Stuck/frozen session diagnostic skill |
| JVq | Browser automation behavioral guidelines (instance A) |
| Gs_ | Browser automation behavioral guidelines (instance B) |
| tvK | Browser-driven web app dev-server skill example |
| AIK | TUI/interactive terminal app tmux pattern skill example |
| vxq | Memory consolidation reflective pass (dream) skill |
| R95 | Loop fixed-interval scheduling scaffold |
| HIK | Web server/API lifecycle skill example |
| Bcf | Reversibility and blast-radius action confirmation policy |
| YvK | Message Batches API reference scaffold (TypeScript) |
| wvK | Files API reference scaffold (TypeScript) |
| bvK | Recently changed surfaces and stale terminology reference |
| avK | Library/SDK run skill example |
| QV9 | Advisor tool consultation policy |
| vVK | Server/API change verification pattern skill |