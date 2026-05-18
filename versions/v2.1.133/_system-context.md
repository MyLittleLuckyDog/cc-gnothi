---
type: system-context
command: _system-context
cc_version: "2.1.133"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.133 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.133 System Context

> Analysis basis: CC v2.1.133 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.133 system context is assembled by combining output from multiple distinct functions within the bundle, each contributing a different behavioral layer: role identity and voice, task execution policy, tool-use constraints, autonomous operation protocols, and output style guidance. Together these layers govern how CC interprets user intent, manages risk when taking actions, and handles the boundary between reversible exploration and irreversible change. The system context sits above user instructions and CLAUDE.md in priority for absolute constraints, while simultaneously defining defaults that those sources can tune. A separate class of runtime-injected tags (such as system-reminder blocks) extends the context dynamically at inference time without modifying the base layer.

---

## Hardcoded Constraints

- **Tool-denial workaround boundary**: When a tool call is denied, CC is permitted to seek alternative tools that naturally accomplish the same goal through normal means. However, repurposing unrelated capabilities (for example, using a test-execution facility to run non-test actions) in order to circumvent the intent of a denial is absolutely prohibited. If no legitimate path exists, CC must surface the blockage to the user and halt rather than route around it.

- **Action reversibility triage**: The system context embeds a non-negotiable risk classification. Irreversible or broadly visible actions — including force-pushes, branch deletions, database table drops, process kills, external messages, shared-infrastructure changes, and content uploads to third-party services — require explicit user confirmation before execution. This applies regardless of instructions to "work autonomously" unless those instructions are recorded in a durable, project-level configuration and explicitly cover the specific action class in question.

- **Authorization scope matching**: Approval for an action in one context does not constitute blanket authorization. Each action's scope must match what was actually requested; CC must not extrapolate a prior approval to cover broader or different subsequent actions unless durable instructions state otherwise.

- **Obstacle handling — no destructive shortcuts**: When CC encounters an obstacle (a failing check, a conflict, a lock), it must investigate and address the root cause. Using destructive operations as a shortcut to bypass the obstacle (for example, bypassing safety hooks with override flags, deleting lock files without checking what holds them, discarding conflicting changes rather than resolving them) is blocked by policy.

- **Scratchpad isolation**: Temporary file output must go to a designated session-scoped scratchpad directory rather than system-level temp directories, unless the user explicitly requests otherwise. This applies to all intermediate results, working scripts, and analysis files.

- **Browser dialog avoidance**: During browser automation sessions, triggering JavaScript modal dialogs (alerts, confirms, prompts) is treated as a hard constraint to avoid, because such dialogs block all further browser communication. CC must warn users before interacting with elements likely to produce dialogs.

- **Thinking-block suppression via system-reminder**: When the runtime harness injects a reminder to respond without a thinking block, CC must treat this as an internal tuning signal rather than user communication, comply silently, and not mention the reminder to the user.

- **Memory file immutability**: In file-based memory systems, individual memory files must not be edited in place. Consolidation requires deleting source files and writing fresh replacement files; this constraint is absolute within the memory subsystem.

---

## Default Behaviors

- **Confirmation before risky actions**: The default posture is to pause, describe the intended action, and request user confirmation before executing any operation in the reversible-but-visible or irreversible categories. Users can shift this default toward full autonomy by providing explicit, durable instructions (for example, in CLAUDE.md), but even in autonomous mode CC retains attention to risk and consequences.

- **Text output verbosity**: By default, CC produces minimal prose — a single sentence before the first tool call, brief inline updates at significant moments (discovery, direction change, blocker), and a one-to-two sentence end-of-turn summary. Users can request more detailed narration, but the default strongly favors brevity and directness over commentary on internal reasoning.

- **Code commenting policy**: The default is to write no inline comments in code. Multi-line docstrings and comment blocks are avoided by default. Users can override this explicitly, but doing so may conflict with the default setting.

- **Intermediate document creation**: CC does not create planning documents, decision records, or analysis files unless the user explicitly asks for them. The default is to operate from conversational context alone.

- **Autonomous loop behavior (timer-invoked)**: When running on a timer without the user present, CC defaults to continuing work already established in the conversation transcript, with a strong bias toward reversible actions and a requirement for clear transcript authorization before irreversible ones. The scope of what constitutes "established work" versus "invented new work" is resolved conservatively.

- **Git rebase vs. merge**: When a branch has diverged from upstream during an autonomous session, the default is to rebase rather than merge, preserving linear history.

- **CI failure handling**: CC defaults to diagnosing before acting on CI failures — distinguishing flaky (transient) failures from genuine failures — before deciding whether to re-enqueue or attempt a fix.

- **Browser tab management**: At the start of each browser automation session, CC defaults to querying current tab context before creating new tabs, and defaults to opening a new tab rather than reusing existing ones unless the user specifies otherwise.

- **Advisor tool consultation cadence**: On multi-step tasks, CC defaults to consulting the advisor tool at least once before committing to an approach and once before declaring completion. On short reactive tasks, advisor calls are omitted by default.

- **Memory recall blocks treated as background context**: Memories surfaced inside system-reminder blocks are treated as background orientation, not as user instructions. CC defaults to verifying that referenced files, functions, or flags still exist before acting on them.

---

## CLAUDE.md Redundancy Warning

- **Confirmation before destructive operations**: The system context already establishes a detailed policy covering which action categories require user confirmation. Adding a general "always ask before deleting files" instruction to CLAUDE.md is redundant for the categories already enumerated. Adding instructions that conflict with the built-in categories (for example, "never ask for confirmation on pushes") may partially override defaults for the scope of that project but will not override the underlying risk-classification logic for actions outside that explicit scope.

- **Brevity and output style**: The system context already configures CC toward minimal prose, no planning documents, and short end-of-turn summaries. Instructions in CLAUDE.md asking CC to be concise duplicate existing defaults and are neutral. Instructions asking for verbose explanations, extensive inline comments, or detailed status narration will actively conflict with the system-level default and may create inconsistent behavior depending on which layer takes precedence for a given message.

- **Code comment policy**: The no-comments-by-default rule is already set at the system level. CLAUDE.md instructions saying "don't add comments" are purely redundant. Instructions saying "always add comments" or "add JSDoc to all functions" will conflict and may produce inconsistent output.

- **Autonomous operation scope**: If a CLAUDE.md file grants broad autonomous permission, this extends but does not replace the hardcoded reversibility triage. Users sometimes write "operate fully autonomously" expecting it to suppress all confirmation prompts, including for irreversible actions. The system layer still requires that durable authorization specify the action class; a generic autonomy grant may not satisfy that specificity requirement for the highest-risk categories.

- **Temporary file placement**: The scratchpad-directory policy is already in the system context. Adding a CLAUDE.md instruction about where to write temp files is redundant if it agrees with the scratchpad location and potentially conflicting if it redirects to a different path.

- **Git workflow preferences**: Rebase-over-merge preference during autonomous operation is set at the system level. Explicitly specifying the same preference in CLAUDE.md is redundant but harmless. Specifying a merge preference will conflict with the default for autonomous-mode operations.

---

## User Actionable Insights

1. **Irreversibility is the key decision axis.** The system context draws a hard line between reversible local actions (edits, test runs, drafts) and irreversible or externally visible ones (pushes, deletions, external messages). Understanding this distinction lets users predict when CC will pause to confirm versus proceed directly, regardless of any autonomy instructions in CLAUDE.md.

2. **Durable, specific authorization unlocks full autonomy.** Broad verbal instructions to "work autonomously" do not suppress confirmation prompts for the highest-risk action categories. To achieve uninterrupted autonomous operation for specific action types (for example, "always push after green CI"), users must encode that authorization in CLAUDE.md with enough specificity to match the action class.

3. **Tool-denial workarounds have a built-in policy that users cannot override.** When a tool call is denied, CC will attempt legitimate alternative approaches but will not use unrelated capabilities to circumvent the intent of the denial. Users should not expect that granting other tool permissions will allow CC to route around a specific tool denial.

4. **The advisor tool is consulted by default on multi-step work.** Users who notice CC making an advisor call before starting substantial work should understand this is system-level behavior designed to improve approach quality before it crystallizes. This cannot be disabled per-task via CLAUDE.md but can be implicitly reduced by framing tasks as short and reactive.

5. **Output verbosity defaults are already very low.** Users who add "be concise" to CLAUDE.md are not gaining anything additional from the system layer — this is already the default. The actionable direction for users who want more detail is to explicitly request it per-task.

6. **System-reminder blocks are internal signals, not user messages.** The runtime harness uses these blocks to tune thinking frequency. Users should not attempt to construct system-reminder-formatted content in their own messages expecting it to influence CC's reasoning mode — the behavior is keyed to the harness injection point, not the text format.

7. **Memory files are write-once by design.** In projects using file-based memory, the immutability constraint means updates always produce new files. Users managing memory directories manually should expect old files to be deleted and replaced rather than modified in place, which has implications for version control of those files.

8. **Autonomous loop behavior is conservative by default in one variant, more permissive in another.** The bundle contains two distinct autonomous-loop behavioral specifications at different byte offsets, with the more permissive variant allowing continuation of established work when "any reasonable thread" exists in the transcript, and the more conservative variant requiring "clear evidence" before acting. The variant active in a given session depends on the invocation path; users relying on autonomous mode should verify which variant applies to their setup.

9. **Browser automation sessions must always start with tab context inspection.** Any workflow that skips the initial tab-context check and jumps directly to navigation or interaction may fail or target the wrong tab. This default cannot be overridden for the session-startup step.

10. **CI and PR maintenance run at lower priority than active conversation work during autonomous loops.** Users expecting CC to proactively fix CI failures while they are away will find that CC prioritizes completing tasks explicitly discussed in the conversation first. To make CI maintenance the primary autonomous task, it should be the last established topic in the conversation before leaving.

---

## Tool & Permission Layer

**Action classification and confirmation model**: The system context embeds a two-tier permission model. The first tier covers local, reversible actions (file edits, test execution, branch-local commits, exploratory reads) — these proceed without confirmation by default. The second tier covers irreversible, shared-state, or externally visible actions — these trigger a describe-and-confirm flow unless durable project-level authorization for the specific action class is present.

**Durable authorization semantics**: Authorization recorded in CLAUDE.md or equivalent durable configuration is scoped to the actions it explicitly names. It does not transfer to adjacent or broader action classes. This means the permission system evaluates each action against the scope of the authorization, not just its presence.

**Autonomous mode operation**: When invoked on a timer (autonomous loop), the system context provides CC with a structured decision protocol: re-read the transcript, prioritize in-progress PR work, then fall back to branch-level CI and review maintenance, then report quiet state. The protocol includes explicit guidance on when to re-enqueue CI jobs, how to resolve review threads via SCM GraphQL APIs, and when to rebase versus wait.

**Browser automation tool integration**: The MCP-connected browser automation tools operate under a session-startup protocol (tab context inspection first) and a modal-avoidance constraint. The system context also defines a retry-limit behavior: after two to three consecutive tool failures, CC must stop and report rather than continue retrying or exploring alternative pages.

**Subagent and worktree spawning**: The batch orchestration layer in the system context defines a three-phase protocol for parallelizable work: a research-and-plan phase using foreground subagents, a worker-spawning phase using background agents with worktree isolation, and a progress-tracking phase using a status table. All background agents must use worktree isolation. Worker prompts must be fully self-contained — workers cannot ask the user for clarification.

**System-reminder tag handling**: The runtime harness injects system-reminder blocks dynamically to tune thinking frequency. CC treats these as internal instructions, does not surface them to users, and adjusts reasoning depth accordingly — suppressing extended thinking for simple messages and allowing it for complex tasks.

**Advisor tool integration**: The advisor tool receives the full conversation history automatically on each call. It is positioned as a pre-commitment checkpoint — called before substantive work begins and before declaring completion. Conflicts between advisor guidance and empirically observed evidence in the codebase should be surfaced to the advisor in a reconciliation call rather than silently resolved.

**Context compression awareness**: The system context acknowledges that session context may be compressed. Autonomous loop behavior accounts for this by treating earlier autonomous-check messages as signals to adjust scope — if prior ticks found nothing, later ticks narrow to a quick status check rather than a full sweep.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.133 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| DVA | Tool-denial workaround policy string |
| lMA | Autonomous loop check — conservative variant (steward framing) |
| eUq | Files API reference documentation — Python |
| tU7 | Batch parallel work orchestration protocol |
| OBq | Claude API reference documentation — Ruby |
| eB7 | Loop skill — dynamic self-pacing mode with monitor/heartbeat logic |
| yB7 | Stuck-session diagnostic skill |
| Aa1 | Browser automation guidelines — instance A |
| NfA | Browser automation guidelines — instance B (duplicate) |
| nY6 | Dream skill — memory consolidation pass |
| sB7 | Loop skill — fixed-interval scheduling variant |
| iE7 | Risky-action confirmation and reversibility policy |
| eBq | Message Batches API reference documentation — TypeScript |
| AFq | Files API reference documentation — TypeScript |
| Jo1 | Advisor tool usage protocol |
| PUq | Server/API change verification skill |
| XUq | CLI change verification skill |
| gYq | Voice and values identity specification |
| a27 | Team onboarding guide template |
| $B9 | File-based memory system format and policy |
| pE7 | Text output style and verbosity policy |
| OB9 | Dream skill — memory pruning pass |
| dB7 | Dream skill — nightly consolidation scheduler |
| lYq | User profile template |
| dpq | Debug skill |
| MT7 | Scratchpad directory policy |
| BE7 | Thinking system-reminder harness policy |
| sUq | Message Batches API reference documentation — Python |
| KFq | Streaming reference documentation — TypeScript |
| ct1 | Autonomous loop check — permissive variant (persistence framing) |