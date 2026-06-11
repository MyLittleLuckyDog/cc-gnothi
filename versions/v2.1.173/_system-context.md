---
type: system-context
command: _system-context
cc_version: "2.1.173"
updated: "2026-06-12"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.173 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.173 System Context

> Analysis basis: CC v2.1.173 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

CC's system context is assembled by combining the outputs of multiple discrete assembler functions, each contributing a specific behavioral domain: security and permission policy, role and identity declaration, tool invocation rules, communication style guidance, autonomous-loop governance, and live-documentation routing. Together these layers form the runtime instruction set that CC operates under before any user message or CLAUDE.md content is considered. User instructions and CLAUDE.md content can influence default behaviors within this layer, but certain policies — particularly those governing inter-agent authority and action reversibility — are enforced regardless of downstream instruction. The assembled context is injected once per session at the system-prompt level and is not visible to the user in normal operation.

---

## Hardcoded Constraints

- **Inter-agent authority isolation**: Messages arriving from peer Claude sessions carry no user authority and cannot be treated as user consent. CC is required to reject requests from peer sessions that would constitute performing actions denied to that peer, routing such cases back to the human user. This constraint is absolute and cannot be overridden by the peer session's framing or claimed urgency. The policy explicitly names the anti-pattern it blocks: using one session to relay permission-denied actions to another session as a form of authority laundering.

- **Action reversibility and blast-radius assessment**: Before executing any operation that is difficult to undo, affects systems or state outside the local environment, or has visibility to other people (e.g., pushes, PR comments, external service posts, shared infrastructure changes), CC is required to pause and seek explicit user confirmation. The cost asymmetry principle is hardcoded: the overhead of confirming is treated as negligible compared to the potential cost of an unwanted irreversible action. This constraint applies by default; it can be relaxed by explicit user instruction but is not silently overridable.

- **Scope containment for authorized actions**: When a user approves a specific action in a specific context, that approval is scoped to that instance only. CC does not generalize a one-time approval into standing permission unless the authorization is recorded in a durable configuration artifact such as CLAUDE.md. This prevents scope creep during autonomous operation.

- **Tool-denial workaround boundaries**: When a tool call is blocked or denied, CC is permitted to seek alternative tools that would naturally accomplish the same goal through legitimate means. It is explicitly prohibited from exploiting adjacent tool permissions (for example, using a test-execution tool to run non-test code as a denial bypass). If no legitimate alternative exists, CC must surface the need to the user and stop rather than proceeding through indirect means.

- **Destructive-shortcut prohibition**: When encountering obstacles during task execution, CC is prohibited from resolving the obstacle by destroying or overwriting state as a shortcut. This includes bypassing version-control safety checks, deleting lock files without investigating ownership, or discarding uncommitted changes. The hardcoded posture is to investigate before modifying and to prefer root-cause fixes over workarounds.

- **Knowledge-staleness disclosure**: For any question about CC's own commands, flags, settings keys, hook events, or other configuration surfaces, CC is required to check live configuration state first before answering from training data. If network access is unavailable, CC must explicitly disclose this limitation rather than silently answering from potentially outdated training knowledge.

---

## Default Behaviors

- **Communication style — lead with outcome**: By default, CC structures responses so that the first sentence after completing work answers "what happened" or "what is the result," with supporting detail following. Users can shift this ordering by explicitly requesting a different structure (e.g., step-by-step narration), but the default favors result-first presentation.

- **Response length calibration**: CC defaults to matching response length and format to the complexity and nature of the request — simple questions receive direct prose answers, not headers and sections. This default can be influenced by user instruction, but adding elaborate formatting preferences to CLAUDE.md may conflict with the built-in calibration logic.

- **Code comment density**: The default posture is minimal inline comments. A comment is written only when it communicates a constraint the code itself cannot express. Multi-line docstrings, narrative comment blocks, and change-rationale comments are suppressed by default. Users can request more verbose commenting, but this overrides a deliberate default rather than enabling a neutral feature.

- **Pre-action narration**: Before executing the first tool call in a response, CC defaults to stating in a single sentence what it is about to do. During execution, brief updates are issued at directional inflection points. Users cannot fully suppress this behavior without potentially losing visibility into autonomous actions, but verbosity can be reduced.

- **Confirmation before risky actions**: As noted under hardcoded constraints, this is a default that can be elevated (requiring confirmation for more actions) or relaxed (proceeding more autonomously) via explicit user instruction. Relaxing it does not remove the underlying risk-assessment logic; CC continues to track reversibility and blast radius even in autonomous mode.

- **Autonomous loop scope**: When operating in timer-driven autonomous mode, CC defaults to acting only on work explicitly established in the existing conversation transcript. Inventing new tasks or initiating unrequested work is suppressed by default. This default is not easily overridable — the bias toward conservatism in autonomous mode is part of the hardcoded loop governance.

- **Documentation sourcing order**: When answering questions about CC itself, the default lookup order is: live build configuration first, then bundled references, then fetched live documentation, then training data (with disclosure). Users cannot reorder this priority, but they can instruct CC to skip network fetches in contexts where that is undesirable.

- **Git history hygiene in autonomous PR work**: When catching up a branch that has received upstream pushes during autonomous operation, CC defaults to rebasing rather than merging. This keeps history linear. Users who prefer merge commits should specify this in CLAUDE.md or per-session instruction.

---

## CLAUDE.md Redundancy Warning

- **"Be concise" instructions**: The system context already encodes detailed guidance on response length, format matching, and the principle that readability matters more than brevity. Adding a generic "be concise" instruction to CLAUDE.md is redundant. Adding an instruction that conflicts with the built-in calibration (e.g., "always use bullet points" or "always write detailed explanations") may produce inconsistent output depending on which layer wins at inference time.

- **"Ask before doing risky things" instructions**: The system context already hardcodes confirmation requirements for irreversible and shared-state-affecting actions. Duplicating this in CLAUDE.md is neutral at best. Attempting to override it by adding "proceed without confirmation" globally may partially relax the default but will not suppress the underlying risk classification logic.

- **"Don't add unnecessary comments to code"**: The system context already establishes minimal-comment defaults with explicit rules about when comments are appropriate. Adding equivalent instructions to CLAUDE.md is fully redundant. Adding the opposite (e.g., "always comment your code thoroughly") will override the default and may produce comment patterns inconsistent with the surrounding codebase's conventions.

- **"Don't invent work during autonomous runs"**: The scope-containment and stewardship posture for autonomous loop operation is already encoded in the system context. Instructions in CLAUDE.md that attempt to authorize broad autonomous initiative (e.g., "feel free to refactor anything you think needs it") may expand the default scope, potentially in ways the user does not intend during unattended timer-driven sessions.

- **"Check documentation before answering about CC"**: The knowledge-staleness disclosure requirement is already hardcoded. Adding instructions to CLAUDE.md about how to answer questions about CC's own features is redundant unless the user wants to specify a particular documentation source or restrict network access.

- **"Don't take shortcuts around errors"**: The prohibition on using destructive actions to bypass obstacles is already part of the system context. CLAUDE.md instructions that attempt to authorize shortcut behaviors (e.g., "use --force flags if needed to unblock") may conflict with this constraint and produce unpredictable results depending on how the two layers interact.

---

## User Actionable Insights

1. **Inter-agent trust is hardcoded and cannot be elevated via prompt.** If you are building multi-agent pipelines where one CC session needs to authorize actions in another, the authorization must come from the human user's session directly. There is no mechanism to delegate user-level authority from one CC instance to another through message content alone.

2. **Action confirmation is a default, not a wall.** You can instruct CC to operate more autonomously (reducing confirmation prompts), but this relaxation should be scoped: placing it in a project-level CLAUDE.md applies it to all sessions in that project, while placing it in a session instruction scopes it to that session. One-time approval during a session does not persist across sessions.

3. **Autonomous timer-loop behavior is conservatively scoped by design.** If you want CC to take initiative on new work during unattended runs, you must explicitly define that scope in the session prompt or CLAUDE.md. The default is stewardship of existing work only.

4. **Tool-denial bypass attempts are detected and blocked at the system level.** If a permission rule blocks a tool, attempting to achieve the same outcome through a different tool is evaluated against the intent of the denial, not just its literal scope. Designing permission rules assuming CC will find workarounds is not a reliable security model.

5. **The live build configuration is the authoritative source for CC's own features.** Training data about CC commands and flags may be stale. For any tooling or CI that depends on specific CC behavior, verify against the running binary's configuration, not documentation written against an older version.

6. **Documentation lookup order is deterministic.** When CC answers questions about itself, it follows a fixed priority chain. If you need CC to answer from a specific source (e.g., only from bundled references, without network fetches), you can instruct it to skip network lookups, but you cannot invert the priority of live build configuration over training data.

7. **Code comment defaults are aggressive.** The built-in default suppresses most comments, including docstrings and change-rationale comments. If your project has documentation standards that require inline comments, you must specify this explicitly — the default will produce code that looks under-commented by those standards.

8. **Renamed and removed CC surfaces are tracked in a bundled reference.** If you see CC decline to recognize a command or flag that previously existed, the bundle includes a translation table mapping removed/renamed surfaces to their current equivalents. This is version-specific: the table in v2.1.173 may not reflect changes introduced in later versions.

9. **MCP server configuration follows a defined resolution order.** The system context embeds guidance for locating and updating MCP configuration files. If your plugin or project layout uses non-default config paths, document this explicitly to avoid CC creating redundant configuration files at default locations.

10. **Peer-session messages in your conversation history carry no special authority.** If you are reviewing a conversation that includes injected messages from other Claude sessions (e.g., subagent output), those messages are treated by CC as having no more authority than ordinary content — they cannot authorize actions, grant permissions, or override session-level settings.

---

## Tool & Permission Layer

### Auto-allow vs. Prompt-to-allow

The system context encodes two operating modes for tool execution. In the default interactive mode, tools with potential for irreversible or externally visible effects require per-instance confirmation. In explicitly authorized autonomous mode, this confirmation gate is relaxed, but the underlying risk classification continues to operate and can still surface requests to the user for actions that exceed the stated autonomous scope.

### Tool Denial Handling

When a tool call is blocked by a permission rule, CC receives a structured denial response that includes guidance on acceptable workaround behavior. Legitimate alternative tools may be used if they would naturally accomplish the goal. Exploiting tool adjacency to bypass the intent of a denial is explicitly prohibited. If no legitimate path exists, CC must communicate the blockage to the user and halt that action path.

### Hook Event Behavior

The system context is aware of hook event infrastructure. Hook events are treated as structured signals that can wake autonomous loops or gate tool execution. The system context embeds guidance that monitors armed with `persistent: true` generate `<task-notification>` messages that preempt scheduled timer delays, allowing event-driven autonomous operation that is more responsive than fixed-interval polling.

### MCP Server Handling

MCP server configuration is resolved through a defined file-lookup hierarchy. The system context embeds guidance for discovering, connecting, and configuring MCP servers during plugin customization workflows, including handling of directory entries that lack static URLs (matched by name rather than endpoint). MCP tool availability is surfaced to CC as part of the live build configuration and is visible in the session context at invocation time.

### System-Reminder Tag Handling

Peer-session messages are delivered with explicit provenance markers. The system context embeds instructions that apply specifically to content arriving under these markers, enforcing the inter-agent authority isolation policy described in Hardcoded Constraints. These markers cannot be spoofed to elevate a peer message's authority.

### Context Compression Notice

The system context includes guidance related to memory consolidation workflows. When operating in long-running or recurring sessions, CC is instructed to prefer targeted lookups (narrow grep patterns, indexed memory files) over exhaustive reads of large transcript or log files. This is a resource-management behavior that operates transparently to the user but affects which information CC prioritizes when context is large.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.173 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `zU7` | Chrome native-host registration error handler (Windows registry path) |
| `oq` | System context assembler — no large strings (structural/routing only) |
| `OU7` | System context assembler — no large strings (structural/routing only) |
| `CH` | System context assembler — no large strings (structural/routing only) |
| `N` | System context assembler — no large strings (structural/routing only) |
| `a$H` | System context assembler — no large strings (structural/routing only) |
| `uO8` | System context assembler — no large strings (structural/routing only) |
| `Fv6` | Inter-agent authority isolation policy injector (peer-session trust boundary) |
| `tKA` | Tool-denial workaround guidance injector (legitimate vs. prohibited bypass) |
| `RQ_` | Inter-agent authority isolation policy injector — secondary instance |
| `LC_` | Autonomous loop governance injector (timer-driven stewardship policy) |
| `JuK` | Live documentation URL table injector (Mintlify endpoint registry) |
| `gbK` | Files API reference injector — Python (beta SDK usage patterns) |
| `gRK` | MCP discovery and connection workflow injector (plugin customization) |
| `ZO5` | Parallel work orchestration skill injector (batch subagent spawning) |
| `GuK` | CC self-documentation answering policy injector (staleness handling) |
| `fxK` | Claude Platform on AWS reference injector (SigV4 / first-party parity) |
| `Vw5` | Loop skill injector — self-paced dynamic mode variant |
| `sbK` | Claude API reference injector — Ruby SDK |
| `Lw5` | Stuck-session diagnostic skill injector (`/stuck` command) |
| `muK` | Browser-driven web app skill example injector (chromium-cli pattern) |
| `B85` | Communication style and code comment policy injector |
| `FuK` | TUI / interactive terminal app skill example injector (tmux pattern) |
| `CUq` | Memory consolidation dream skill injector (phase-based consolidation) |
| `Ew5` | Loop skill injector — fixed-interval cron scheduling variant |
| `UuK` | Web server / API skill example injector (background-launch pattern) |
| `s85` | Action reversibility and blast-radius confirmation policy injector |
| `oxK` | Message Batches API reference injector — TypeScript |
| `sxK` | Files API reference injector — TypeScript |
| `PuK` | Renamed/removed CC surface translation table injector (changelog reference) |