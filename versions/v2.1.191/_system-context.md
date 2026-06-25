---
type: system-context
command: _system-context
cc_version: "2.1.191"
updated: "2026-06-25"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.191 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.191 System Context

> Analysis basis: CC v2.1.191 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The system context layer in CC v2.1.191 is assembled by combining the outputs of multiple distinct functions, each responsible for a different domain of behavioral policy. Together they cover: security and permission policy, role and identity declaration, tool invocation behavior, git and SCM workflow guidance, subagent and delegation mechanics, autonomous loop operation, proxy and network trust configuration, and live documentation routing. This layer is injected before any user instructions or CLAUDE.md content and therefore establishes the baseline from which all user-level customization is relative. Some policies are absolute regardless of what CLAUDE.md or runtime instructions request; others are defaults that user-facing configuration can shift within defined limits.

---

## Hardcoded Constraints

- **Denied-tool fallback behavior**: When a tool invocation is denied by the permission system, CC is instructed to seek alternative tools that accomplish the same legitimate goal through normal means. It is prohibited from circumventing the intent of the denial — for example, repurposing a test-runner to execute arbitrary non-test code is explicitly out of scope. If no reasonable alternative exists, CC must halt and explain to the user what it was attempting and why the denied capability is necessary, then defer the decision to the user. This constraint is absolute and cannot be overridden by task instruction.

- **Git destructive-operation guard**: A set of git operations classified as destructive (force operations against protected branches, hard resets, wholesale restore/clean operations, hook-skipping flags) are blocked unless the user provides an explicit, direct request for that specific operation. The prohibition on force-pushing to main or master branches carries an additional warning obligation even when explicitly requested. This applies regardless of autonomous-mode or task-driven context.

- **Commit gating**: CC will not create git commits unless the user has explicitly asked for one. This is not a soft preference — it is described as critically important to avoid unwanted proactive commits. The constraint survives autonomous-loop invocations.

- **Secrets exclusion from commits**: Files that are likely to contain credentials or secrets are excluded from staging by default, with an obligation to warn the user if they explicitly request committing such files. This is an absolute behavior; no task instruction overrides silent inclusion.

- **Pre-commit hook failure handling**: When a pre-commit hook fails, CC is required to treat the commit as not having occurred and to create a new commit after remediation rather than amending the previous one. Using `--amend` after hook failure is classified as a potential cause of data loss and is prohibited in this scenario.

- **Proxy and TLS integrity**: CC must not disable TLS verification and must not unset the proxy environment variable that routes traffic through the policy-enforcing egress layer. When a destination is denied by organization policy (HTTP 403/407 class responses), CC must report the block rather than retry or attempt to route around it. These constraints apply to all tool use that makes outbound network connections.

- **Tool identity in PR/commit workflows**: During pull request creation and git commit workflows, certain tool types are explicitly prohibited. CC may not use file-editor or notebook-style tools in these workflows — only shell/bash-based git commands via the designated tool are permitted.

- **Subagent prompt completeness requirement**: When delegating to a subagent that starts without shared conversation context (non-fork types), CC is required to include full briefing in the prompt — file paths, line numbers, prior findings, specific objectives. Delegating synthesis or understanding to the agent ("based on your findings, do X") is explicitly prohibited. This is a hardcoded quality constraint on delegation behavior.

- **Autonomous loop scope restriction**: During timer-driven autonomous operation, CC is constrained to act only on work already established in the conversation or directly visible in the current branch's pull/merge request state. Inventing new work, initiating new workstreams, or making irreversible changes without clear prior authorization from the conversation transcript are prohibited. The loop is defined as a steward role, not an initiator role.

---

## Default Behaviors

- **Response style and length**: By default CC calibrates response length and format to the apparent complexity of the task. This default can be shifted by user instructions (e.g., requesting brief summaries, structured output, or specific word limits), and CLAUDE.md can set persistent style preferences.

- **Parallel tool execution**: CC defaults to running independent tool calls in parallel when multiple pieces of information are needed simultaneously and all calls are likely to succeed. Users can request sequential operation if order-dependency is a concern, but parallel execution is the baseline for efficiency.

- **Git status inspection before commits**: Before staging and committing, CC defaults to running a parallel set of inspection commands (status, diff, log) to understand the current repository state and match the repository's existing commit message style. Users cannot suppress this inspection phase without explicitly restructuring the request.

- **Commit message style**: CC defaults to drafting commit messages that emphasize the "why" over the "what," kept to one or two concise sentences, passed via heredoc to ensure formatting correctness. This style can be overridden by user instruction or CLAUDE.md conventions.

- **PR body format**: Pull request bodies default to a structured format with a summary section (short bullet points) and a test plan section (bulleted checklist). The title is kept under a character threshold. Users can provide alternate formats by instruction.

- **Staging specificity**: CC defaults to staging specific named files rather than using broad "add all" git commands, as a safeguard against accidentally including sensitive or binary files. Users can request broader staging explicitly.

- **Subagent delegation style**: When spawning subagents, CC defaults to writing prompts that are self-contained briefings including goals, constraints, relevant context, and a scoped response-length target. This default can be adjusted by user instruction but the completeness requirement for non-fork agents is fixed.

- **Autonomous loop verbosity**: When nothing actionable is found during autonomous operation, CC defaults to a single brief status sentence and stops. It does not produce summaries of what was checked or lists of future possibilities. After several consecutive idle results, scope narrows further to a minimal check. Users cannot currently override this toward more verbose idle reporting through CLAUDE.md alone.

- **CI failure handling in autonomous mode**: CC defaults to diagnosing failing CI jobs before acting — distinguishing transient/flaky failures (eligible for re-queue) from real failures (requiring reproduction and a minimal fix). This diagnostic-first approach is the default; CC does not immediately re-trigger failures without diagnosis.

- **Documentation lookup routing**: When bundled references do not cover a topic, CC defaults to fetching from live documentation endpoints at the canonical documentation host. Users can redirect or suppress this by instruction, but the default is to prefer live docs over hallucination.

- **Side-question handling**: When a lightweight side question arrives during an ongoing main task, a separate stateless agent instance is spawned by default to answer it without interrupting the main agent. This sub-instance has no tools available and produces a single response. Users cannot currently configure which questions trigger this pathway.

---

## CLAUDE.md Redundancy Warning

- **Commit creation policy**: The system context already enforces that commits are only created on explicit user request. Adding a CLAUDE.md instruction like "only commit when I ask" is fully redundant. A conflicting instruction such as "feel free to commit after each task" would create instruction conflict; the hardcoded constraint is likely to win for safety-critical cases but the interaction is not guaranteed to be clean.

- **Git destructive operation warnings**: The system context already blocks destructive git operations without explicit user request. Duplicating this in CLAUDE.md as "never force push" or "never reset --hard" is redundant for the protected cases. It is neutral to include, but does not add protection beyond what is already enforced.

- **Commit message style guidance**: The system context already establishes a "why over what, concise" commit message default. If CLAUDE.md specifies a conflicting style (e.g., verbose multi-paragraph messages, or a specific prefix convention), the CLAUDE.md instruction will likely override the default — which may be the intended behavior, but users should be aware the default already exists.

- **PR structure templates**: The system context already defines a default PR title length limit and body structure (summary + test plan). Adding a CLAUDE.md PR template that matches this structure is fully redundant. A CLAUDE.md template that diverges will override the default, which is intentional and non-conflicting as long as the user is aware.

- **Parallel tool execution preference**: The system context already defaults to parallel execution of independent commands. Instructing CC in CLAUDE.md to "run commands in parallel when possible" is redundant. Instructing it to "always run commands sequentially" will conflict with the default and may reduce performance.

- **Secrets exclusion**: The system context already instructs CC to avoid staging credential-containing files. A CLAUDE.md instruction reinforcing this is neutral but redundant. A CLAUDE.md instruction that appears to grant permission to include such files may create ambiguity — users should not rely on CLAUDE.md to override this constraint.

- **Response length defaults**: The system context establishes length calibration defaults. CLAUDE.md instructions about preferred response length or verbosity are a common and legitimate use — this is one area where CLAUDE.md customization is genuinely additive rather than redundant, since the system default is generic and project-specific preferences are meaningful here.

- **Subagent prompt quality guidance**: The system context already instructs CC on how to write effective subagent prompts (briefing completeness, scoped length targets, no delegated synthesis). CLAUDE.md instructions that restate general delegation quality advice are redundant. Project-specific context — such as which subagent types to prefer or domain-specific briefing content — is genuinely additive.

---

## User Actionable Insights

1. **The commit gate is not a suggestion.** CC will not commit without being asked, and this behavior is enforced at the system level. You do not need to instruct CC to hold commits; the constraint is already active. Conversely, if you want CC to commit freely, you will need to give that instruction explicitly and repeatedly — it is not a single-configuration toggle.

2. **Destructive git operations require explicit per-operation permission.** Force operations, hard resets, and branch deletions are blocked by default. If your workflow genuinely requires these (e.g., interactive rebase cleanup), you must ask for them directly in the relevant turn. A CLAUDE.md blanket permission for these operations may not be sufficient given the hardcoded guard.

3. **Hook bypass flags are also blocked.** If your repository has pre-commit hooks that are slow or sometimes incorrect, you cannot instruct CC to skip them with `--no-verify` or equivalent flags without explicit per-request authorization. Plan for hook remediation as part of your workflow rather than suppression.

4. **The side-question agent has no tools.** When CC spawns a lightweight instance to answer a side question during a running task, that instance cannot read files, run commands, or search anything. Answers are limited to what is already in the conversation context. Do not ask side questions that require file inspection or command execution — those require interrupting the main task.

5. **Non-fork subagents start with zero context.** When CC delegates to a non-fork subagent type, that agent has no access to the conversation history. The quality of its output depends entirely on what CC includes in the prompt. If subagent results seem shallow or miss context, the issue is usually insufficient briefing in the delegated prompt — you can instruct CC to provide more detail in delegation prompts.

6. **Autonomous loop mode is conservative by design.** When CC is running on a timer while you are away, it is constrained to work only on what you were already building together. It will not start new features, open new issues, or make broad architectural changes. If you want it to act on a specific task while you are away, make sure that task is explicitly established in the conversation before you step away.

7. **TLS and proxy settings are immutable from the task layer.** In environments where CC runs through an organizational egress proxy, disabling TLS verification or bypassing the proxy is not something you can authorize through instructions or CLAUDE.md. If a tool fails due to certificate issues, the correct resolution path is the proxy CA configuration — not disabling verification.

8. **Live documentation is fetched at runtime when bundled docs are insufficient.** CC will consult live documentation endpoints rather than guess about behavior not covered by bundled references. This means answers about CC features are generally current, but also that network-isolated environments may see degraded documentation quality for edge-case topics.

9. **CLAUDE.md is most valuable for style, domain context, and project conventions.** The system context already handles safety constraints, git behavior, and delegation quality. The highest-value uses of CLAUDE.md are things the system context cannot know: your project's domain terminology, preferred code style, testing conventions, which branches are protected, and what "done" means for your workflow.

10. **Version-specific note (v2.1.191):** This version includes an autonomous loop scheduler with configurable delay windows and a persistent monitor (watcher) mechanism for event-gated wakeups. The scheduler distinguishes between a primary event-based wake signal and a fallback heartbeat delay. If you use autonomous mode, the loop will arm a watcher for CI or PR events and use a longer fallback delay when a watcher is active. This behavior is new relative to earlier loop implementations and means autonomous mode is more efficient at low activity — it does not poll aggressively when waiting for CI.

---

## Tool & Permission Layer

### Permission Model

CC's permission layer operates in two modes: auto-allow and prompt-to-allow. In auto-allow mode, tools whose operations fall within the pre-approved permission set are invoked without user confirmation. In prompt-to-allow mode, CC surfaces the requested operation to the user before proceeding. Which mode applies to a given tool invocation depends on the permission rules configured for the session, which can be set via the `.claude/` directory configuration, CLI flags, or operator-level settings.

When a tool invocation is denied — whether by rule or by the user declining a prompt — CC enters a defined fallback behavior: seek a reasonable alternative, and if none exists, halt and explain. Circumventing the denial by repurposing other tools is explicitly out of scope.

### Hook Event Integration

The system context acknowledges a hook event layer that fires at defined lifecycle points. Hooks can be configured to run before or after specific tool types execute, allowing the user to inject validation, logging, or side effects. CC is aware of this layer and treats hook outcomes as meaningful signals — a hook failure during a commit operation, for example, is treated as a commit failure requiring remediation rather than a noise event to skip.

### System-Reminder Tag Handling

A `<system-reminder>` tag mechanism exists for injecting structured context into specific agent instances without that context appearing in the main conversation. This is used by the side-question agent pathway: a spawned lightweight instance receives a system-reminder block that scopes its behavior (no tools, single response, no follow-up) independently of the main conversation flow. Users do not directly author system-reminder content; it is generated by the CC runtime.

### MCP Server Integration

MCP servers are treated as first-class tool providers. The system context supports discovery of MCP connectors via a registry search capability and connection management via a suggest-connectors mechanism. MCP configuration lives in a dedicated configuration file (`.mcp.json` or a path specified in `plugin.json`) and uses a standardized format that supports HTTP and SSE transport types with optional header-based authentication. Server names in configuration can match directory entries by name when no static URL is available, allowing dynamic-endpoint servers to be referenced by identity.

### Context Compression Notice

The system context includes awareness of context window compression events. When context is compacted during a long session, certain behavioral reminders are re-injected or reconstructed so that CC's operating constraints survive the compression boundary. This is relevant in autonomous loop mode: the loop prompt mechanism is designed to inject the full behavioral instructions on first fire or first fire after compaction, and a shorter reminder on subsequent fires.

### Agent Proxy Trust Layer

In environments that route outbound HTTPS through a local policy-enforcing egress proxy, the system context includes detailed diagnostic and remediation guidance for the most common failure classes: certificate verification failures (tool-specific CA configuration), HTTP method errors (non-CONNECT requests from outdated clients), policy denials (which must be reported, not retried), tools that ignore the proxy environment entirely, git remote rewriting conflicts, and container network isolation. This guidance is directed at CC itself — it informs how CC should diagnose and resolve tool connectivity failures without requiring the user to understand the proxy topology.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.191 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `L` | Dashboard UI assembler — collapsible/copy UI, hour-histogram chart, background memory management telemetry |
| `s` | PostgreSQL keyword list provider + side-question system-reminder tag generator |
| `l` | PostgreSQL type keyword list provider + non-fork subagent delegation example set |
| `a` | Fork-type subagent delegation example set (coordinator/notification pattern) |
| `A` | Autonomous loop scheduler instruction block (delay selection, watcher arming, sentinel prompt) |
| `i` | Subagent prompt-writing guidance block (briefing completeness, delegation anti-patterns) |
| `D` | Subtask block property/event constant list (workflow automation schema) |
| `c` | Job block property/event constant list (workflow automation schema) |
| `E` | Pseudo-reference code constant list (access types, components, privileges) |
| `x` | Validation rule ID constant list (auto-numeration, requisite checks, firm context) |
| `h` | Dataset event name constant list (dse*/re* event identifiers, route selection events) |
| `d` | Daemon config reload telemetry emitter |
| `f` | Background process dispatch telemetry emitter (sigkill escalation, low-memory, spare worker lifecycle) |
| `Xvt` | Stub / empty assembler (no large strings, no telemetry) |
| `H` | Stub / empty assembler (no large strings, no telemetry) |
| `m` | Stub / empty assembler (no large strings, no telemetry) |
| `u` | Stub / empty assembler (no large strings, no telemetry) |
| `g` | Stub / empty assembler (no large strings, no telemetry) |
| `k` | Stub / empty assembler (no large strings, no telemetry) |
| `v` | Stub / empty assembler (no large strings, no telemetry) |
| `w` | Stub / empty assembler (no large strings, no telemetry) |
| `I` | Dashboard CSS/HTML renderer (stats layout, CLAUDE.md action cards, friction category display) |
| `p` | PostgreSQL SQLSTATE / error code constant list |
| `Y$o` | Denied-tool fallback behavior policy block |
| `btf` | Git commit and pull request workflow instruction block |
| `aXr` | Autonomous loop behavioral policy block (steward role, PR maintenance, CI triage) |
| `Ogc` | Live documentation URL routing table (Mintlify endpoints by topic category) |
| `SGf` | Agent proxy trust and TLS failure diagnosis block |
| `Qfc` | Files API reference documentation block (Python SDK, upload/use/manage pattern) |
| `hdc` | MCP discovery and connection workflow block (registry search, config format, plugin integration) |