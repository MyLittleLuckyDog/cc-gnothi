---
type: system-context
command: _system-context
cc_version: "2.1.193"
updated: "2026-06-27"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.193 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.193 System Context

> Analysis basis: CC v2.1.193 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.193 system context is assembled from multiple functions whose outputs are concatenated at runtime to form the full system prompt delivered to the model. These functions collectively cover: role and identity declaration, security and destructive-action policies, tool invocation protocols, git and version-control safety rules, subagent orchestration guidance, autonomous loop behavior, and proxy/network environment configuration. The system context layer sits below user instructions and CLAUDE.md content in authority, meaning it establishes baseline defaults that user configuration may augment or partially override — but certain categories of constraint are enforced regardless. Understanding this layer reveals which CLAUDE.md entries are redundant, which are genuinely additive, and which risk producing instruction conflict.

---

## Hardcoded Constraints

- **Tool-denial workaround boundary**: When a tool invocation is denied, CC is permitted to attempt the same goal through a functionally equivalent alternative tool (for example, reading only the head of a file rather than its entirety). However, CC is explicitly prohibited from using unrelated tool capabilities — such as a test runner — to execute actions that circumvent the intent behind a denial. If no legitimate alternative exists, CC must stop, explain what it was attempting and why the capability is necessary, and defer the decision to the user. This constraint is absolute and cannot be lifted by CLAUDE.md.

- **Destructive git operation gate**: A fixed set of git operations classified as irreversible or high-risk — including forced pushes, hard resets, and broad file-removal commands — are blocked from autonomous execution. CC will not run these unless the user provides an explicit per-instance instruction to do so. This gate also covers bypassing commit hooks. The constraint applies even in autonomous loop mode. Force-pushing to a primary branch (main/master) triggers a mandatory warning regardless of user instruction.

- **Sensitive file exclusion from commits**: CC is instructed never to stage or commit files that appear to contain credentials or environment secrets. If the user explicitly requests committing such files, CC must issue a warning rather than silently comply. This is a hardcoded behavior, not a default.

- **Proxy and TLS integrity**: In agent-proxy environments, CC is prohibited from disabling TLS verification, unsetting the proxy environment variable, or retrying requests that were blocked by an organization's egress policy. Policy denials must be reported, not routed around. This constraint is embedded in the network configuration section of the system context and is not user-adjustable.

- **Subagent prompt synthesis responsibility**: CC is prohibited from delegating the synthesis step to a subagent. Prompts passed to subagents must demonstrate that CC has already understood the problem — they must include specific file paths, line numbers, and precise instructions rather than open-ended directives that push reasoning onto the downstream agent. This is a behavioral constraint on how subagent delegation is performed, not merely a style preference.

- **Autonomous loop action boundary**: In timer-driven autonomous mode, CC is constrained to act only on work already established in the conversation transcript or on directly observable PR/CI maintenance tasks. Inventing new work items, making irreversible changes without clear prior authorization, or fabricating status information when a result is not yet available are all blocked behaviors. The constraint is self-reinforcing: the system context instructs CC to treat its own inclination to justify borderline actions as a signal to pause rather than proceed.

- **Side-question agent tool restriction**: When CC spawns a lightweight side-question agent to answer a query without interrupting the main agent, that side agent is absolutely prohibited from using any tools. It cannot read files, run commands, or take any actions. It can only draw on conversation context already in scope. This constraint is hardcoded into the side-question system-reminder injection.

---

## Default Behaviors

- **Commit creation timing**: By default, CC does not create git commits unless the user explicitly requests one. This default can be overridden by an explicit user instruction per session but is not permanently adjustable via CLAUDE.md in a way that would cause CC to commit proactively without being asked.

- **Git staging granularity**: CC defaults to staging specific named files rather than using broad add-all flags. Users who want broad staging must explicitly request it; the default exists to prevent accidental inclusion of sensitive or unintended files.

- **Pull request body structure**: When creating a pull request, CC defaults to generating a structured summary and a test-plan checklist as the PR body. Users can influence the content and format by providing explicit instructions, but the structured default will apply otherwise.

- **Commit message focus**: CC defaults to writing commit messages that emphasize the reason for a change over a literal description of what changed. Users can redirect this by specifying a preferred commit message style in CLAUDE.md or per-session.

- **Parallel tool execution**: CC defaults to running independent tool calls in parallel when multiple pieces of information are needed and all calls are expected to succeed. Users cannot disable this behavior globally, but sequential execution can be forced by task structure (e.g., explicitly making one step depend on another's output).

- **Subagent prompt self-containment**: When delegating to a subagent, CC defaults to writing fully self-contained prompts that include all necessary context, because subagents start with no conversation history. Users can influence the level of context provided but cannot remove this default behavior entirely.

- **Autonomous loop delay calibration**: When operating in timer-driven autonomous mode, CC defaults to selecting a fallback heartbeat interval based on observed activity level — shorter when there is active work in flight, longer when the branch is quiet. Users can influence this indirectly by configuring the loop, but the dynamic calibration is the default.

- **Live documentation lookup**: CC defaults to consulting bundled references first and only fetching live documentation when the bundled content does not cover a question. Users can redirect CC to fetch live docs explicitly, but the fetch-on-gap behavior is the default.

- **Autonomous loop scope scaling**: If CC observes multiple consecutive autonomous invocations with nothing to act on, it defaults to scaling back its scope to a minimal check rather than continuing full sweeps. This prevents unnecessary work accumulation and is not user-configurable.

- **PR maintenance in autonomous mode**: When there is no active conversation work to continue, CC defaults to checking CI status, unresolved review threads, and branch staleness on the current PR as a fallback activity. This default can be suppressed by explicit loop configuration.

---

## CLAUDE.md Redundancy Warning

- **Commit-only-when-asked policy**: The system context already establishes that CC will not create commits unless explicitly instructed. Adding a CLAUDE.md entry such as "only commit when I ask" is fully redundant. It does not conflict, but it adds no behavioral effect in v2.1.193.

- **Avoid force-push to main**: The system context already instructs CC to warn before any force-push to a primary branch and to refuse without explicit user direction. A CLAUDE.md entry reiterating this is neutral but unnecessary — it will not make the protection stronger.

- **Prefer specific file staging over broad add**: The default is already set toward named-file staging. A CLAUDE.md instruction encoding this preference duplicates the default. A conflicting instruction (e.g., "always use git add -A") may override the default and could introduce the sensitive-file risk the default is designed to prevent.

- **Write descriptive commit messages focused on intent**: The system context already encodes this as the default commit message style. Duplicating it in CLAUDE.md is redundant. A conflicting style instruction (e.g., "keep all commit messages to five words or fewer") may override the default.

- **Do not push without being asked**: The system context already contains an explicit default against pushing to remote repositories without user instruction. A CLAUDE.md entry repeating this is neutral and redundant.

- **Provide self-contained subagent prompts**: The system context already requires that subagent prompts include sufficient context for an agent with no conversation history. A CLAUDE.md entry asking CC to "always give subagents full context" is redundant. An entry that conflicts (e.g., "keep subagent prompts short") risks producing under-specified delegations.

- **Do not skip pre-commit hooks**: The system context already prohibits bypassing hooks without explicit user instruction. A CLAUDE.md hook-bypass prohibition is redundant but harmless.

- **Structure PRs with a summary and test plan**: The system prompt already defines a default PR body format including these sections. A CLAUDE.md entry requesting this format is redundant. A conflicting format instruction may produce a different structure than the default but will generally be respected as a user override.

---

## User Actionable Insights

1. **Tool-denial escalation is not optional.** If a denied tool capability is genuinely required for the user's task, CC will stop and explain rather than silently fail or attempt a prohibited workaround. Users should expect this escalation and treat it as correct behavior — not a bug to work around via CLAUDE.md.

2. **Destructive git operations require per-session explicit authorization.** No CLAUDE.md setting can pre-authorize force-pushes, hard resets, or hook bypasses. Each instance requires an explicit in-session instruction. Users who want these available in automated pipelines must architect their tooling accordingly.

3. **Sensitive file commit warnings are hardcoded, not advisory.** CC will always warn before committing files that appear to contain credentials, even if the user explicitly requests it. Users working with legitimate non-secret files that pattern-match as sensitive (e.g., a file named `.env.example` with dummy values) should expect this friction and plan to override it per-commit with explicit acknowledgment.

4. **Side-question agents are genuinely tool-free.** When CC spawns a lightweight agent to answer a side question, that agent cannot perform any lookup, file read, or command execution. Answers are limited to what exists in conversation context. Users should not assume that side-question responses reflect current file state.

5. **Autonomous loop mode is scope-limited by design.** CC operating on a timer cannot invent new tasks. If a user sets up an autonomous loop expecting CC to proactively explore and improve the codebase beyond what was discussed, that expectation will not be met — CC will report "nothing to do" rather than manufacture work. The loop is a continuation engine, not an autonomous discovery engine.

6. **Subagent prompts must be pre-synthesized by the caller.** Delegation patterns like "figure out what's needed and fix it" are explicitly blocked behavioral patterns in this version. Users designing multi-agent workflows should write orchestrator prompts that already contain the analysis, not prompts that ask the subagent to perform the analysis.

7. **Live documentation URLs are bundled in the system context.** CC knows where to fetch current documentation for its own features (settings, hooks, subagents, MCP, permissions, etc.) and will do so when bundled references are insufficient. Users do not need to provide these URLs in CLAUDE.md — they are already part of the system context in v2.1.193.

8. **Proxy and TLS constraints are environment-level, not user-overridable.** In agent-proxy deployments, CC will not disable certificate verification or circumvent egress policy denials under any instruction. Users encountering blocked hosts in these environments must engage their organization's policy administrators — CC will report the block but will not route around it.

9. **The autonomous loop communicates via transcript, not side-channels.** When autonomous invocations complete with nothing to act on, CC leaves a single-sentence message in the transcript and stops. Users reviewing sessions after autonomous periods should check the transcript rather than external logs for activity summaries.

10. **Version-specific note — v2.1.193 loop sentinel behavior**: The autonomous loop in this version uses a dynamic-mode sentinel string in the scheduling call's prompt field, which expands at fire time to full or abbreviated instructions depending on whether the loop is on its first fire, first fire after compaction, or a subsequent fire. Users who have previously configured loop prompts by passing full instruction text should verify that this expansion mechanism does not duplicate or conflict with their prompt content in this version.

---

## Tool & Permission Layer

**Tool denial and graceful escalation**: The system context embeds a permission-aware invocation model in which tool calls that are denied by the permission layer do not cause silent failure. CC is instructed to distinguish between reasonable alternative approaches (permitted) and intent-bypassing workarounds (prohibited). When no acceptable alternative exists, the escalation path is always to the user.

**Auto-allow vs. prompt-to-allow**: The system context acknowledges a two-mode permission model. In auto-allow mode, tools within a pre-authorized scope execute without per-call confirmation. In prompt-to-allow mode, CC surfaces a confirmation request before execution. The system context informs CC how to behave in each mode but does not itself set which mode is active — that is determined by session configuration and CLAUDE.md permission rules.

**Hook event system**: The bundle contains references to a hook event lifecycle (before-start, after-finish, and similar lifecycle points) associated with both job-level and subtask-level execution blocks. The system context trains CC to be aware that hooks may intercept or modify tool execution outcomes, and that hook failures at commit time mean the commit did not occur — requiring a fresh commit rather than an amend.

**System-reminder tag injection**: A dedicated injection mechanism wraps side-question agent invocations in a `<system-reminder>` tagged block. This block overrides the default agent role for that invocation, removes tool availability, enforces single-turn response, and suppresses action-promising language. Users interacting with CC in environments where side-question agents are used should be aware that responses from those agents carry these constraints automatically.

**MCP server configuration**: The system context includes awareness of MCP server discovery and connection patterns, including a registry search mechanism and a connector suggestion UI flow. CC is instructed to check whether an MCP server is already connected before suggesting installation, and to handle both URL-based and name-matched server references in plugin configuration files. Users configuring MCP servers do not need to instruct CC on the connection flow — it is described in the system context.

**Context compaction and loop continuity**: The autonomous loop system context explicitly addresses behavior across context compaction events. On the first invocation after a compaction, CC receives expanded instructions rather than the abbreviated reminder used in steady-state loop ticks. This ensures continuity of loop behavior across context boundaries without requiring user intervention.

**Network proxy trust model**: In agent-proxy environments, the system context injects a complete diagnosis and remediation guide for TLS trust failures, proxy bypass patterns, and tool-specific CA configuration. CC is instructed to consult a local proxy status endpoint for diagnostics before attempting fixes, and to apply tool-specific trust configuration (environment variables, config files, JVM truststore injection) in a defined priority order. This machinery is transparent to the user but explains why CC in proxy environments may run diagnostic commands before proceeding with network-dependent tool calls.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.193 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `L` | Dashboard UI assembler — collapsible/copy UI + background worker memory management log string |
| `s` | PostgreSQL keyword list assembler + side-question system-reminder injector |
| `l` | PostgreSQL type list assembler + subagent prompt-writing guidance (non-fork delegation examples) |
| `a` | Fork-mode subagent orchestration guidance assembler (fork subagent_type examples + coordinator patterns) |
| `A` | Autonomous loop scheduling instruction assembler (tick logic, monitor arming, sentinel prompt field) |
| `i` | Subagent prompt-writing principles assembler (briefing model, context requirements, anti-patterns) |
| `D` | Subtask block property constant list assembler |
| `c` | Job block property constant list assembler |
| `E` | Pseudoreference code constant list assembler |
| `x` | Validation rule ID constant list assembler |
| `h` | Dataset event name constant list assembler |
| `d` | Daemon config reload telemetry handler (no large strings) |
| `f` | Background process dispatch telemetry handler (SIGKILL escalation, low-memory, spare worker lifecycle) |
| `yLt` | Minimal assembler call — no large strings, no telemetry (role unclear from static analysis) |
| `H` | Background process management assembler — no large strings (role inferred from byte proximity to dispatch handlers) |
| `m` | Background process assembler — no large strings (role inferred from byte proximity) |
| `u` | Runtime utility assembler — no large strings, no telemetry |
| `g` | Post-daemon-config assembler — no large strings, no telemetry |
| `R` | Runtime state assembler — no large strings, no telemetry |
| `w` | Mid-bundle utility assembler — no large strings, no telemetry |
| `v` | Background process adjacency assembler — no large strings, no telemetry |
| `I` | Analytics dashboard HTML/CSS renderer (usage histogram, CLAUDE.md action UI, stats display) |
| `p` | PostgreSQL SQLSTATE error code list assembler |
| `w3o` | Tool-denial workaround policy injector (acceptable alternatives vs. prohibited bypasses; user escalation instruction) |
| `Wsf` | Git workflow instruction assembler (commit safety protocol + PR creation protocol) |
| `hQr` | Autonomous loop behavioral specification assembler (steward model, scope rules, repeated-invocation policy) |
| `uyc` | Live documentation URL registry assembler (Mintlify endpoint table with extraction prompts) |
| `oqf` | Agent proxy network configuration assembler (TLS trust, failure classes, per-tool remediation) |
| `CHc` | Files API Python reference assembler (upload, message use, management operations) |
| `Wmc` | MCP discovery and connection workflow assembler (registry search, connector suggestion, config file update) |