---
type: system-context
command: _system-context
cc_version: "2.1.156"
updated: "2026-05-30"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.156 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.156 System Context

> Analysis basis: CC v2.1.156 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.156 system context is assembled from multiple cooperating function components embedded in the bundle, each contributing a distinct behavioral layer: role declaration, tool permission policy, subagent orchestration guidance, autonomous loop management, and live documentation routing. Together these layers govern how CC interprets user instructions, decides when to act autonomously versus wait, and routes configuration questions to authoritative sources. The system context sits above CLAUDE.md and user instructions in terms of default authority, but several of its defaults are overridable through those channels. Its behavioral scope spans interactive single-turn use, background daemon operation, and multi-agent parallel workflows.

---

## Hardcoded Constraints

- **Tool denial handling**: When a tool invocation is blocked by a permission rule, CC is instructed to evaluate whether the underlying goal can be reached through a different, naturally applicable tool — but is explicitly prohibited from exploiting indirect capabilities (such as test runners or side-effect-bearing tools) as a backdoor around the denial. Circumvention attempts using non-obvious tool chains are blocked. If no compliant path exists, CC must stop, disclose what it was attempting and why the permission is necessary, and hand the decision back to the user. This constraint is absolute and not overridable by CLAUDE.md.

- **Side-question agent isolation**: When a lightweight parallel agent is spawned to handle a side question, that agent operates under a strict no-tools constraint — it cannot read files, execute commands, search the network, or perform any stateful action. It may only synthesize a single response from conversation context already available to it. Promises to investigate or follow up are prohibited. This constraint is hardcoded into the side-question agent's injected context and cannot be lifted by user instruction to that agent.

- **Autonomous loop stewardship boundary**: In daemon/autonomous-loop mode, CC is constrained to act only on work that the prior conversation transcript clearly establishes as authorized. Inventing new work items, initiating irreversible changes without prior user authorization, or applying motivated reasoning to justify a push are explicitly identified as trust-eroding behaviors. The boundary between "continuing established work" and "initiating new work" is resolved conservatively: absent clear transcript evidence, CC defers rather than acts. This is a hardcoded disposition, not a tunable default.

- **Stale-knowledge disclosure for CC configuration questions**: When answering questions about CC's own commands, flags, settings keys, or hook events, CC is required to check live configuration data embedded in the prompt before relying on training-data knowledge. If network access is unavailable and the answer would come from training data alone, CC must disclose the staleness explicitly and direct the user to the canonical documentation URL. Silently answering from potentially outdated training data is prohibited.

- **Subagent prompt self-containment requirement**: When spawning background agents for parallel batch work, CC is required to include all necessary context in each agent's prompt — the agent receives no implicit access to the parent conversation. Delegating understanding (e.g., telling an agent to "implement based on your findings") is prohibited; the spawning agent must resolve and encode what specifically needs to change before delegation occurs.

- **Worktree isolation for parallel batch agents**: Batch-mode parallel worker agents are required to use isolated git worktrees (`isolation: "worktree"`). This is not a suggestion; it is a structural requirement baked into the batch orchestration prompt template.

---

## Default Behaviors

- **Documentation freshness strategy**: By default, CC consults a priority hierarchy when answering CC configuration questions: live build configuration embedded in the prompt → bundled reference files → fetched live documentation → training data (with staleness disclosure). Users cannot change the priority order, but they can skip to specific tiers by telling CC to answer without fetching, accepting the staleness caveat.

- **Autonomous loop PR maintenance scope**: By default, when the conversation transcript is exhausted, CC's autonomous loop shifts attention to the current branch's pull/merge request — checking CI status, unresolved review threads, and branch staleness. Users can narrow or expand this scope by modifying loop configuration or the `loop.md` file if one is present in the project.

- **Autonomous loop verbosity on idle**: By default, when nothing actionable is found, CC emits a single sentence and stops — it does not produce a summary of what was checked or speculate about future actions. After repeated consecutive idle results, CC is expected to scale back its activity further rather than continuing to narrate. This default can be influenced by explicit user instructions about desired reporting style.

- **Subagent type selection**: When launching subagents, CC defaults to a general-purpose agent type unless the task domain clearly fits a more specialized type (such as a code-reviewer agent). Users can specify a preferred subagent type in their instructions to override this default.

- **CI failure handling in autonomous mode**: By default, CC distinguishes between flaky-shaped CI failures (timeouts, runner deaths, transient network errors) and substantive failures before acting. Flaky failures may be re-enqueued; real failures trigger diagnosis and minimal reproduction before any fix attempt. Users can influence how aggressively CC retries by project-level configuration, but the diagnosis-before-action default is hardcoded.

- **Branch history policy in autonomous mode**: When pushing changes during autonomous operation, CC defaults to rebasing rather than merging when the branch has diverged, to preserve linear history. This default reflects a hardcoded preference and is not currently overridable per-session without CLAUDE.md instruction.

- **Answer concreteness for configuration questions**: When explaining CC configuration, CC defaults to showing exact commands, flags, and settings JSON rather than paraphrasing them. It also defaults to disclosing file location (global vs. project-level settings) and linking to the relevant documentation page. Users can request higher-level summaries, but the concrete-first default is strong.

---

## CLAUDE.md Redundancy Warning

- **Autonomous loop work scope**: The system prompt already encodes a conservative stewardship policy for autonomous operation — act on established work, do not invent new tasks. CLAUDE.md instructions that attempt to re-state this policy are redundant. Instructions that attempt to broaden it (e.g., "feel free to start new work items") directly conflict with the hardcoded constraint and will create instruction tension that CC resolves conservatively.

- **Subagent prompting discipline**: The system prompt already instructs CC to write fully self-contained subagent prompts with specific file paths, line numbers, and what to change. Adding similar guidance to CLAUDE.md is neutral if consistent, but potentially conflicting if it encourages a looser delegation style (e.g., "let agents figure out the details themselves").

- **CI handling strategy**: The system prompt already establishes a diagnosis-before-action default for CI failures. CLAUDE.md entries that say "always re-run failing CI" conflict with this and may produce undesirable behavior on substantive failures.

- **Response length in idle state**: The system prompt already enforces a minimal one-sentence idle report. CLAUDE.md instructions that ask for verbose status summaries when nothing is happening conflict with this default and may produce inconsistent behavior depending on which instruction is weighted more heavily.

- **Documentation lookup behavior**: The system prompt already encodes a live-first documentation strategy with explicit staleness disclosure rules. CLAUDE.md instructions telling CC to "always answer from training data" or "don't fetch documentation" conflict with this and suppress the staleness disclosure safety mechanism.

- **Rebase-over-merge preference**: The system prompt already establishes rebasing as the default history strategy. Many teams add this to CLAUDE.md as well. If the CLAUDE.md instruction is consistent, it is neutral redundancy. If it specifies merge behavior, it overrides the default and users should be aware the system-prompt default does not act as a fallback.

---

## User Actionable Insights

1. **Tool permission denials are a hard stop, not a suggestion to get creative.** CC will not attempt to route around a permission denial using unrelated tools. If a task genuinely requires a blocked capability, the only path forward is for the user to explicitly grant the permission. Knowing this prevents confusion when CC stops and asks rather than finding an alternative.

2. **Side-question agents are read-only and single-turn by design.** If a side question requires file access, command execution, or follow-up turns, it cannot be answered by the lightweight side-question agent. Users who need actionable answers from side questions should ask them as main-thread requests instead.

3. **Autonomous loop trust is calibrated to transcript evidence, not inference.** CC will not act on work that seems like a natural continuation but lacks explicit transcript support. Users who want autonomous operation to cover a broader scope should state work items explicitly in the conversation before leaving CC to run unattended.

4. **Batch parallel agents require investment in prompt quality before launch.** Because each worker agent is isolated with no access to the parent conversation, and because delegating synthesis to the agent is prohibited, the quality of parallel batch results is directly proportional to the specificity of the spawning prompt. Vague batch instructions will produce shallow or inconsistent worker output.

5. **CC's knowledge of its own commands and settings is intentionally treated as unreliable.** The system context explicitly flags training-data knowledge about CC itself as potentially stale and requires live-source consultation before answering. Users can expect CC to fetch documentation rather than answer immediately when asked about CC internals — this is intentional behavior, not a bug.

6. **Three consecutive idle results in autonomous mode is a meaningful signal.** The system context encodes a scale-back rule: repeated idle results should reduce CC's activity scope rather than continue producing idle reports. Users running long-running daemon sessions should monitor for this pattern; it indicates the autonomous loop has run out of clearly authorized work.

7. **The live build configuration section in the prompt is authoritative for this version.** When CC reports that a command or setting does not exist, it is checking the live build section first. If the feature is absent there, CC's answer is based on the actual running binary state, not training data — this is a version-specific guarantee of v2.1.156's configuration question handling.

8. **Worktree isolation is non-negotiable for parallel batch workers.** Users designing batch workflows cannot opt out of worktree isolation for individual workers. Prompts that attempt to configure workers without `isolation: "worktree"` will be overridden by the embedded template requirement.

9. **The rebase default in autonomous mode affects CI and review state.** Users whose repositories have branch protection rules that conflict with force-push (required by rebase) should set an explicit merge preference in CLAUDE.md before enabling autonomous operation, since the default will attempt rebase pushes.

10. **CLAUDE.md instructions that contradict hardcoded constraints create silent resolution tension.** CC does not surface a warning when a CLAUDE.md instruction conflicts with a hardcoded system-prompt policy. The system prompt's hardcoded constraints typically win, but the resolution is not guaranteed to be logged or visible. Users should audit CLAUDE.md against this spec to identify conflicts proactively.

---

## Tool & Permission Layer

The system context embeds a structured permission model that governs how CC responds when a requested tool invocation is denied. The model distinguishes between two categories of response to a denial: legitimate alternative routing (using a naturally applicable tool that achieves the same outcome without circumventing the intent of the rule) and illegitimate bypass (exploiting side-effect-bearing tools or indirect capabilities to work around the denial's purpose). Only the former is permitted.

When no legitimate alternative exists, CC is required to surface the denial to the user with an explanation of what was being attempted and why the capability is necessary, then halt. This preserves user agency over permission escalation decisions.

For side-question handling, the system context injects a specialized behavioral frame via a tagged reminder block. This frame explicitly declares the agent's tool-free, single-response constraint and prohibits any language that implies future action or investigation. The tag structure of this injected block (`<system-reminder>`) is visible in the bundle and serves as a context boundary signal to CC.

The autonomous loop system integrates with a scheduling tool that accepts a delay parameter and a sentinel prompt value. The sentinel expands at fire time to full loop instructions on first invocation and to a shorter pacing reminder on subsequent invocations — users do not need to (and should not) pass full instructions manually. The loop also supports event-driven wake signals via persistent monitor tasks, which serve as the primary wake mechanism; the scheduled delay acts as a safety-net heartbeat. Loop termination requires both omitting the reschedule call and explicitly canceling any armed monitor tasks.

The batch orchestration layer requires a plan-approval gate between research and worker spawning phases. Workers run in background mode with worktree isolation. The orchestrator is responsible for tracking completion notifications, parsing result data from each worker's output, and maintaining a status table. The system context provides a specific table schema for this tracking.

MCP server configuration and custom skill/subagent availability are surfaced to CC through a "Current Build" section injected at prompt assembly time. This section reflects the actual running binary state and takes precedence over both training data and bundled references when CC answers configuration questions. Context compression events (compaction of long conversation history) are handled transparently by the loop system through the sentinel expansion mechanism, which detects first-fire-post-compact state and adjusts the injected instructions accordingly.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.156 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `h` | Dashboard UI script assembler (collapsible panels, clipboard handlers, hour-histogram chart) |
| `L` | PostgreSQL keyword list assembler + side-question system-reminder block injector |
| `$` | Coordinator subagent example prompt assembler (multi-turn fork pattern with notification handling) |
| `O` | Single-turn subagent example prompt assembler (background task delegation pattern) |
| `E` | Autonomous loop tick instruction assembler (scheduling, monitor arming, sentinel prompt logic) |
| `M` | Subagent prompt-writing guidance assembler (briefing discipline, delegation anti-patterns) |
| `b` | Subtask block property constant list assembler |
| `T` | Pseudoreference code constant list assembler |
| `R` | Validation and auto-numeration rule ID constant list assembler |
| `X` | Dataset event name constant list assembler (DSE/RE event identifiers) |
| `Y` | Daemon config reload telemetry handler (`tengu_daemon_config_reload`) |
| `w` | Background process lifecycle telemetry handler (SIGKILL escalation, low-memory, spare pool events) |
| `NL6` | No-op assembler call (zero large strings, no telemetry) |
| `f` | No-op assembler call (zero large strings, no telemetry) |
| `P` | No-op assembler call (zero large strings, no telemetry) |
| `j` | No-op assembler call (zero large strings, no telemetry) |
| `z` | No-op assembler call (zero large strings, no telemetry) |
| `J` | No-op assembler call (zero large strings, no telemetry) |
| `C` | No-op assembler call (zero large strings, no telemetry) |
| `y` | No-op assembler call (zero large strings, no telemetry) |
| `k` | No-op assembler call (zero large strings, no telemetry) |
| `V` | Dashboard CSS stylesheet assembler (full UI theme, layout, component styles) |
| `D` | PostgreSQL SQLSTATE error code constant list assembler + background spare pool spawn telemetry |
| `Di_` | Tool denial response policy injector (alternative routing permission + bypass prohibition) |
| `NN_` | Autonomous loop check instruction assembler (stewardship policy, PR maintenance, idle handling) |
| `aYK` | Live documentation source table assembler (Mintlify URL map by topic) |
| `kzK` | Files API Python reference assembler (upload, messages, management, end-to-end examples) |
| `qy5` | Batch parallel orchestration prompt assembler (research/plan/spawn/track phases) |
| `HDK` | CC configuration question handling instruction assembler (staleness policy, lookup routing) |
| `czK` | Claude Platform on AWS skill assembler (SigV4 auth, client setup, feature parity notes) |