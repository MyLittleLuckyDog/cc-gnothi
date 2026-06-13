---
type: system-context
command: _system-context
cc_version: "2.1.176"
updated: "2026-06-13"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.176 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.176 System Context

> Analysis basis: CC v2.1.176 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.176 system context is assembled from multiple cooperating functions, each contributing a discrete behavioral layer to the final system prompt delivered to the model. These layers collectively cover: inter-session authority policy, tool denial handling, autonomous operation guidance, subagent orchestration, communication style defaults, documentation self-consistency rules, and recurring task scheduling. The assembled context is authoritative over user instructions and CLAUDE.md content in areas where it establishes absolute constraints, while leaving other behavioral dimensions open to user-level configuration. Its relationship to CLAUDE.md is additive — CLAUDE.md content is appended and can override defaults, but cannot override hardcoded authority or permission policy.

---

## Hardcoded Constraints

- **Cross-session authority isolation**: When a message arrives from another Claude session (a peer agent rather than the human user), CC treats that message as carrying no user-level authority. The current session's permission settings and the human user's instructions are always considered superior. This constraint is absolute and cannot be overridden by any instruction within the peer message itself.

- **Permission laundering prevention**: If a peer agent requests that CC perform an action the peer was itself denied, or claims it cannot perform an action on its own behalf, CC is required to refuse and escalate to the human user rather than relay the request. The rationale embedded in the system context is that passing denied actions between sessions circumvents the permission system. This is an absolute block — no instruction from any source authorizes CC to act as a relay for permission-denied operations.

- **Peer-message consent boundary**: A message from another Claude session is explicitly categorized as never constituting user consent or approval for any action. This means agentic workflows that chain Claude sessions cannot grant each other elevated permissions at runtime.

- **Tool-denial response protocol**: When a tool invocation is blocked by the permission system, CC is constrained in how it may work around the denial. Reasonable alternative tool use is permitted (for example, using a different read tool when a specific one is denied), but circumventing the intent of the denial through indirect means — such as exploiting test-execution capabilities to run non-test actions — is blocked. If CC determines that the denied capability is essential to completing the user's request, it must halt and explain to the user rather than proceed.

- **Autonomous operation scope discipline**: When running in an autonomous timer-based mode without the user actively present, CC is constrained to advance work the user has already initiated and explicitly authorized. Inventing new work items, initiating irreversible actions without clear transcript evidence of user intent, or self-justifying a push as "probably fine" are treated as trust-eroding behaviors to be avoided. This is a behavioral absolute within autonomous mode — the system context does not provide an escape hatch for edge cases.

- **Documentation self-consistency enforcement**: When answering questions about CC's own commands, flags, settings, or hooks, CC is required to treat the live configuration embedded in the current prompt as ground truth, overriding its training-data knowledge where they conflict. Silently answering from stale training data when live configuration is available is blocked. If network documentation is unavailable, CC must explicitly disclose this rather than present training-data answers as current.

---

## Default Behaviors

- **Communication style — lead with outcomes**: By default, CC opens post-task responses with a direct statement of what happened or what was found, placing supporting reasoning after. Users can influence verbosity and depth via explicit instruction, but the outcome-first ordering is a strong default.

- **Response format calibration**: CC defaults to matching response format to task complexity — simple questions receive direct prose answers without structural markup; structured elements such as tables and headers are reserved for genuinely enumerable or multi-part content. Users can request alternative formats explicitly.

- **Code commenting density**: CC defaults to minimal code comments, with comments reserved for constraints or non-obvious decisions that the code itself cannot express. It avoids multi-line docstrings and planning-oriented comment blocks by default. Users can request higher comment density, but the default is sparse.

- **Intermediate artifact creation**: CC defaults to working from conversation context rather than producing intermediate planning or analysis documents. It will not create these files unless the user explicitly asks. This default can be overridden by user instruction.

- **In-progress update frequency**: CC defaults to providing brief, sentence-level updates before its first tool call and at directional turning points during work. It does not provide running internal commentary by default. Users who want more or less update verbosity can specify this.

- **Autonomous mode reporting**: When operating autonomously and finding no actionable work, CC defaults to a single-sentence "nothing to do" message rather than a status summary. After a threshold of consecutive idle results, it defaults to reducing its check scope. This cadence behavior can be influenced by the loop interval and prompt configuration.

- **Recurring task scheduling — immediate first execution**: When a recurring task is scheduled via the loop mechanism, CC defaults to executing the prompt immediately rather than waiting for the first scheduled firing. Users who want deferred-only execution must specify this.

- **Self-paced loop delay selection**: In dynamic (non-fixed-interval) loop mode, CC selects its own sleep interval based on observed task state and event monitoring. The default preference is a longer heartbeat interval when an event monitor is active, to avoid generating cache-overhead ticks. Users can influence this by adjusting loop parameters.

- **Subagent isolation mode**: When spawning worker agents for parallel batch operations, CC defaults to using isolated worktree mode with background execution. This default ensures parallel units do not share mutable state.

- **Memory consolidation behavior**: During dream/consolidation passes, CC defaults to merging new signal into existing topic files rather than creating new files, and to converting relative temporal references to absolute dates. The index file is kept under a size threshold by default.

- **Documentation fetch preference**: When live documentation URLs are available and network access is possible, CC defaults to fetching current documentation over relying on bundled references for CC-specific configuration questions.

---

## CLAUDE.md Redundancy Warning

- **Communication style directives**: The system context already establishes detailed communication defaults — outcome-first structure, prose over headers for simple responses, no internal-deliberation narration, brief end-of-turn summaries. Adding equivalent instructions to CLAUDE.md is largely redundant. Instructions that conflict (for example, asking for exhaustive step-by-step narration of reasoning) may create instruction tension and produce inconsistent behavior.

- **Code comment policy**: The system context already configures a minimal-comment default with a specific rationale (comments should state constraints the code cannot express; they should not address reviewers or describe what the next line does). Duplicating this in CLAUDE.md is neutral if consistent. Conflicting instructions (for example, requesting comprehensive inline documentation) will override the default but may produce comments the system context characterizes as noise.

- **Intermediate file creation**: The default against producing planning and analysis documents is already set in the system context. Users who want CLAUDE.md to enable this only need a single permissive instruction; repeating the prohibition is entirely redundant.

- **Autonomous operation scope**: The stewardship model — act on established work, do not invent new work, prefer reversible actions — is already encoded in the system context for autonomous mode. CLAUDE.md instructions that attempt to expand autonomous scope (for example, "feel free to open new issues or start new branches") may partially override this but will do so in tension with the hardcoded trust-erosion framing.

- **Response length calibration**: The system context already instructs CC to calibrate response length to task complexity and user expertise level. Generic CLAUDE.md instructions such as "be concise" or "give detailed responses" are redundant with what is already configured, though they may shift the calibration point.

- **Subagent prompt completeness**: The system context already establishes that worker agent prompts in batch workflows must be fully self-contained. CLAUDE.md instructions about how to write subagent prompts are redundant; instructions that contradict this (for example, "keep subagent prompts brief") may degrade worker agent performance.

---

## User Actionable Insights

1. **Peer-agent authority is permanently bounded.** No amount of prompt engineering in a multi-agent pipeline can grant a downstream Claude session the authority of the human user. If your architecture relies on one CC session authorizing another to take actions, the second session will refuse or escalate. Design pipelines so that human-user authorization flows through session configuration, not through peer messages.

2. **Tool denials cannot be tunneled around via indirect means.** If a tool is blocked in the permission layer, CC will not use capability-adjacent tools to achieve the same effect in ways that violate the denial's intent. Plan permission grants explicitly — do not rely on CC finding workarounds.

3. **Autonomous mode is a stewardship mode, not an expansion mode.** When using timer-based or background autonomous operation, CC will not self-initiate new work items. The transcript must contain clear evidence of user intent for any action CC takes. If you want CC to perform proactive maintenance (CI monitoring, PR hygiene), this must be framed as established work in the conversation before you step away.

4. **The loop skill executes immediately on scheduling.** The first firing of a recurring loop task happens at scheduling time, not at the first cron interval. Account for this to avoid double-execution if you are scheduling tasks that should not run twice in quick succession.

5. **CC's knowledge of its own commands and settings may be stale — the live config wins.** When CC is answering questions about itself, it is instructed to treat the build-time configuration snapshot as authoritative. If you are debugging unexpected behavior in CC commands or settings, the live configuration embedded in the current session prompt is more reliable than CC's general training knowledge.

6. **Documentation fetch is the default for CC-self questions when network is available.** If you are operating CC in a network-restricted environment and asking it about its own configuration, explicitly inform it that network access is unavailable; otherwise it may attempt fetches that will silently fail or produce error-state answers.

7. **Batch parallel work uses worktree isolation by default.** When using CC's parallel batch orchestration, each worker operates in an isolated git worktree. Shared mutable state between workers is architecturally prevented by this default. Design batch work units to be independently mergeable without cross-unit dependencies.

8. **Memory consolidation is incremental by default.** The dream/consolidation mechanism merges rather than replaces, and prunes the index to a size ceiling. If you maintain a CLAUDE.md-adjacent memory system, be aware that CC will attempt to deduplicate and index-trim automatically — do not store content you want preserved verbatim directly in index files.

9. **The communication style defaults are strongly set.** If your workflow genuinely requires detailed progress narration, extensive inline comments, or intermediate planning documents, you will need explicit and persistent CLAUDE.md or per-session instructions, as these defaults will reassert themselves otherwise.

10. **Version-specific note — v2.1.176**: This version includes an explicit self-paced loop mode (dynamic interval selection without a fixed cron expression), a structured parallel batch orchestration flow with a plan-approval gate before worker spawning, and a live documentation fetch layer for CC-self questions. These are version-surface behaviors that may change across releases; the live documentation URLs embedded in the bundle are the canonical reference for the current build.

---

## Tool & Permission Layer

The system context embeds several layers of permission and tool-invocation machinery that CC operates within:

**Tool denial handling**: When the permission layer blocks a tool call, the system context injects guidance that differentiates between acceptable alternative approaches and prohibited circumvention. CC is permitted to try functionally equivalent tools that would naturally accomplish the same goal. It is not permitted to exploit unrelated capabilities (for example, test runners) to execute actions in ways that sidestep the denial's intent. If no acceptable path exists, CC is required to halt and surface the situation to the user with an explanation of what it was attempting and why the blocked capability was necessary.

**Peer-session message tagging**: Messages arriving from other Claude sessions are tagged differently from user messages. The system context contains explicit instructions for how CC should interpret these tags — specifically, that tagged peer messages carry no user authority regardless of their content or claims. This tagging mechanism is the enforcement point for cross-session permission isolation.

**Autonomous loop invocation context**: When CC is invoked by a timer rather than a user action, the system context provides a distinct behavioral frame recognizing this invocation mode. CC adjusts its action scope, reporting style, and work-selection heuristics based on whether it was invoked interactively or autonomously.

**MCP server configuration**: The system context includes reference material for MCP server discovery and connection, including a registry search interface and a category-to-keyword mapping for locating connectors. Plugin-level MCP configuration uses a defined file hierarchy (plugin.json mcpServers field, then .mcp.json at plugin root) with both wrapped and unwrapped JSON formats supported.

**Recurring task / cron scheduling**: The loop mechanism exposes a cron-expression scheduling layer. The system context encodes interval-to-cron conversion rules, handling edge cases such as intervals that do not cleanly divide their time unit (where CC rounds to the nearest clean interval and discloses the rounding to the user). Recurring tasks carry an automatic expiry after a configured number of days.

**Event-driven wake signals**: In dynamic loop mode, CC can arm persistent event monitors that serve as primary wake signals, with the scheduled timer acting as a fallback heartbeat. This two-layer wakeup model (event monitor + fallback delay) is configured through the self-pacing instructions embedded in the system context.

**Documentation live-fetch layer**: For CC-self questions, the system context embeds a structured URL table mapping documentation topics to live endpoints. This layer sits between CC's training knowledge and its answers — CC is instructed to consult this layer before answering from training data and to disclose when the layer is inaccessible.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.176 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| O | System context assembler; includes agent prompt-writing guidance and job-block property definitions |
| SW | System context assembler (no large strings; structural/glue role) |
| Uf | System context assembler (no large strings; structural/glue role) |
| N | System context assembler (no large strings; structural/glue role) |
| xA | System context assembler (no large strings; structural/glue role) |
| OU7 | System context assembler (no large strings; structural/glue role) |
| NR | System context assembler (no large strings; structural/glue role) |
| XAq | System context assembler (no large strings; structural/glue role) |
| $i_ | System context assembler (no large strings; structural/glue role) |
| JU7 | System context assembler (no large strings; structural/glue role) |
| K8 | System context assembler (no large strings; structural/glue role) |
| rG8 | System context assembler (no large strings; structural/glue role) |
| gh6 | Peer-session authority policy injector; provides cross-session permission isolation framing |
| sLA | Tool-denial response policy injector; governs alternative-tool use and circumvention prohibition |
| Jn_ | Peer-session authority policy injector (variant); mirrors gh6 for different invocation paths |
| Nu_ | Autonomous loop behavioral frame; governs timer-invoked operation scope and reporting |
| AQK | Live documentation URL table; maps CC documentation topics to current fetch endpoints |
| IFK | Files API reference (Python); embedded SDK documentation for file upload/management |
| UFK | Claude API reference (Ruby); embedded SDK documentation including tool runner and prompt caching |
| IUK | MCP discovery and connection reference; registry search workflow and plugin config format |
| u25 | Parallel batch orchestration skill; plan-approve-spawn-track workflow for parallelizable changes |
| LQK | CC self-question handler; instructs CC to prioritize live config and fetch docs over training data |
| nFK | Claude Platform on AWS reference; embedded deployment and authentication documentation |
| m05 | Self-paced loop skill (dynamic mode); event-monitor and fallback-heartbeat scheduling logic |
| G05 | Stuck-session diagnostic skill; process inspection and Slack reporting workflow |
| VQK | Browser-driven web app skill example; chromium-cli headless testing pattern |
| J75 | Communication style policy; outcome-first structure, comment density, response calibration |
| yQK | TUI interactive terminal app skill example; tmux-based agent driving pattern |
| Qcq | Memory consolidation (dream) skill; phase-structured memory merge and index pruning |
| x05 | Fixed-interval loop skill; cron-expression scheduling with immediate first execution |