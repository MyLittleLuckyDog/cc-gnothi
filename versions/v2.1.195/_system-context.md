---
type: system-context
command: _system-context
cc_version: "2.1.195"
updated: "2026-06-27"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.195 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.195 System Context

> Analysis basis: CC v2.1.195 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

CC's system context layer is not a single monolithic prompt but rather an assembly of multiple specialized instruction segments that are composed at runtime. These segments collectively cover: security and permission policy, role and identity declaration, tool invocation behavior, task delegation guidance (subagents and forks), autonomous loop operation, git safety rules, proxy/network configuration awareness, and documentation self-service routing. The assembled context establishes CC's baseline posture before any user instruction or CLAUDE.md content is applied. User instructions and CLAUDE.md can influence many default behaviors within this layer, but a subset of constraints are structurally fixed and resist override.

---

## Hardcoded Constraints

- **Tool-denial compliance**: When a tool call is blocked by the permission layer, CC is instructed to treat the denial as a signal rather than an obstacle. It may attempt to accomplish the same goal through a reasonably equivalent tool (for example, substituting a read-limited utility for a broader file reader), but it is explicitly prohibited from using other capabilities — such as running test infrastructure — as a covert path to execute the denied action. This constraint is absolute: circumvention attempts that honor the letter but violate the intent of a denial are blocked.

- **Permission-denial transparency**: If CC determines that a blocked capability is genuinely necessary to complete a user request, it is required to stop, clearly explain what it was attempting and why the capability is needed, and defer the decision about how to proceed to the user. Silent workaround attempts are not permitted.

- **Git destructive-operation gate**: A class of git operations — force-push, hard reset, working-tree restore, branch deletion, and similar irreversible commands — are hardcoded as requiring explicit user authorization before execution. CC will not infer authorization from task context or convenience; the user must have directly requested the action. This applies even in autonomous loop operation.

- **Git hook bypass prohibition**: CC is prohibited from passing flags that skip commit hooks or signing requirements unless the user has explicitly requested this. This constraint protects repository integrity policies the user's organization may have enforced via hooks.

- **Commit-on-request-only**: Creating git commits is gated on explicit user instruction. CC will not commit opportunistically during task execution even if it judges a commit would be beneficial.

- **Credential and secrets exclusion**: CC will not stage or commit files that appear to contain secrets or credentials. If a user explicitly requests committing such a file, CC issues a warning rather than silently complying.

- **Autonomous loop scope boundary**: During timer-driven autonomous operation (when the user is away), CC is constrained to act only on work already established in the conversation transcript. Inventing new work, expanding scope, or making irreversible changes without traceable authorization from the transcript is prohibited. The constraint is described internally as a trust-preservation mechanism: unauthorized expansions erode the user's confidence in autonomous operation.

- **Proxy and TLS integrity**: In proxy-mediated environments, CC is instructed never to disable TLS certificate verification and never to unset the proxy environment variable. Additionally, when a destination host is blocked by organizational egress policy, CC is prohibited from retrying or routing around the block — it must report the blockage instead.

- **Side-question agent tool restriction**: The lightweight agent spawned to handle side questions during main-agent operation is hardcoded with no tool access. It cannot read files, run commands, search, or take actions of any kind. This is an architectural constraint, not a user-configurable one.

---

## Default Behaviors

- **PR creation workflow**: By default, CC follows a multi-step pull request preparation sequence — gathering git status, diff, branch tracking state, and full commit history before drafting title and body. The title length target and body structure (summary bullets plus test plan checklist) are defaults. Users can provide alternate PR templates or instruct CC to follow a different structure; the default activates when no such instruction exists.

- **Commit message style**: CC defaults to drafting commit messages that emphasize the "why" rather than the "what," using concise one-to-two sentence descriptions. It also defaults to inferring message style from the repository's existing log. Users can override this by specifying a commit message format or convention in CLAUDE.md.

- **Parallel tool execution**: CC defaults to batching independent tool calls — such as simultaneous git status and git diff — into parallel invocations for performance. This is a default; users with environments that require sequential execution can instruct CC to serialize calls.

- **Staging specificity**: CC defaults to staging files by name rather than using bulk-add commands, to avoid accidentally including sensitive files. This default can be loosened by explicit user instruction, though CC may warn about risks.

- **Subagent prompt briefing standard**: When delegating to a subagent, CC defaults to providing full context in the prompt (file paths, line numbers, background, what has already been tried, what form the answer should take). Thin or command-style prompts are discouraged by default. Users can adjust the verbosity of delegated prompts.

- **Autonomous loop idle behavior**: When no actionable work is found during an autonomous loop tick, CC defaults to emitting a single short status sentence and stopping — not summarizing what it checked or speculating about future actions. After several consecutive idle results, CC defaults to reducing its activity to a minimal CI check rather than continuing full scans.

- **Documentation self-service via live fetch**: CC defaults to consulting its bundled references first, and falls back to fetching live documentation from canonical URLs when bundled content does not cover the question. Users can suppress live fetches by instruction if network access is restricted.

- **Fork vs. delegate subagent selection**: CC defaults to choosing between a context-sharing fork and a fresh subagent based on whether the delegated task benefits from conversation history. Users can specify subagent type explicitly to override this default selection logic.

- **Autonomous loop wake signal priority**: When a monitoring watcher is active, CC defaults to treating the watcher's event as the primary wake signal and uses the scheduled timer as a fallback heartbeat. The default fallback delay range is tuned based on observed branch activity. Users operating the loop can adjust delay parameters.

---

## CLAUDE.md Redundancy Warning

- **Commit message conventions**: The system prompt already instructs CC to infer commit style from repository history and favor intent-focused messages. Adding a commit message format to CLAUDE.md is not harmful, but if the CLAUDE.md convention conflicts with what CC infers from history, the explicit instruction will win — which may be the desired outcome. Duplicating the general principle without specifics adds no value.

- **Git safety rules**: The prohibition on force-push, hard reset, and hook bypass is already embedded in the system context. Adding "never force push" to CLAUDE.md is redundant for the default case. However, if a project legitimately requires an exception (for example, a personal branch where force-push is acceptable), CLAUDE.md is the correct place to express that — it is not a redundant instruction in that scenario; it is an override.

- **PR body format**: The default PR structure (summary bullets, test plan checklist) is already defined in the system context. Teams that add a PR template to CLAUDE.md are effectively overriding the default, which is the correct use. Teams that add instructions matching the default format are adding noise without effect.

- **Parallel tool execution preference**: The system context already establishes parallel batching as the default. Instructing CC to "run commands in parallel when possible" in CLAUDE.md restates the existing default and has no additional effect unless the project also includes conflicting sequential-execution instructions elsewhere.

- **Subagent briefing quality**: The system context already specifies that delegated prompts must include full context. Adding "always give the subagent full context" to CLAUDE.md is redundant. The more useful CLAUDE.md entry is project-specific: listing which file paths, modules, or background facts should always appear in delegated prompts for this project.

- **Secrets exclusion from commits**: The prohibition on committing credential files is already active. Restating it in CLAUDE.md is neutral. However, project-specific patterns (e.g., a non-standard secrets file name) are genuinely useful additions to CLAUDE.md because the system default only catches common patterns.

---

## User Actionable Insights

1. **The tool-denial workaround boundary is enforced, not advisory.** If CC is denied a tool and you expect it to find an equivalent path, it will — but only if the alternative genuinely accomplishes the same goal through normal means. Do not rely on CC finding creative workarounds for permission denials that reflect intentional policy; it will stop and ask instead.

2. **Autonomous loop authorization must be explicit in the transcript.** If you want CC to take a specific action during an unattended loop tick, state it clearly in the conversation before leaving. CC will not infer authorization from vague context or convenience. The more specific the transcript instruction, the more confidently CC will act on it autonomously.

3. **Destructive git commands require explicit per-request authorization.** Saying "clean up the branch" is insufficient to authorize a force-push or hard reset. If you want CC to perform a destructive git operation, name the command explicitly. This is version-stable behavior, not a configuration choice.

4. **The side-question agent is toolless by design.** When CC spawns a lightweight responder to answer a question while the main agent continues working, that responder cannot look anything up. If your side question requires file access or command execution, you will need to wait for the main agent or ask in a new full turn. Knowing this saves time when you receive a "I don't have access to check that" response from a side-question agent.

5. **Proxy policy violations should be reported, not routed around.** In proxy-mediated environments, if CC reports that a host is blocked by organizational egress policy, the correct response is to contact the policy owner — not to instruct CC to bypass it. CC is hardcoded to refuse routing-around attempts.

6. **CLAUDE.md is most valuable for project-specific exceptions and additions, not restatements.** The system context already covers the most common behavioral defaults. Your CLAUDE.md investment pays off most when it captures things the system context cannot know: project-specific file naming conventions, non-standard secrets file patterns, which subagent types are available in your environment, and domain-specific commit or PR conventions that differ from the defaults.

7. **Subagent prompts should be self-contained.** The system context instructs CC to treat delegated agents as colleagues who have not seen the conversation. If you are orchestrating CC to delegate tasks, ensure your instructions to CC include enough background that the generated subagent prompt will be complete without the parent context. Thin prompts produce shallow results even when the parent conversation has rich context.

8. **Live documentation fetching is a fallback, not a first resort.** CC consults bundled references first. If you are working in an air-gapped or network-restricted environment, note that some self-service documentation behaviors will silently degrade. You can explicitly disable live fetch attempts in CLAUDE.md or by direct instruction.

9. **The autonomous loop's idle behavior is intentionally minimal.** If you return to find CC has stopped with a single sentence saying there was nothing to do, that is correct behavior — not a malfunction. Three consecutive idle results trigger an even more minimal mode. If you expected work to be found, the issue is likely in what was established in the transcript before you left.

10. **Version-specific note (v2.1.195):** The subagent delegation layer now distinguishes between fork-type delegates (which share conversation context) and fresh-start delegates (which begin with no history). The prompt construction guidance for each type is embedded in the system context. If you are upgrading from an earlier version and notice different subagent behavior, this architectural split is the likely cause.

---

## Tool & Permission Layer

The system context embeds a multi-mode permission model that governs how CC handles tool invocations. Two broad modes are described: an auto-allow mode, in which approved tools execute without prompting the user, and a prompt-to-allow mode, in which CC requests user confirmation before proceeding. The boundary between these modes is determined by a combination of tool identity, action reversibility, and any allow/deny rules configured by the user or operator.

Hook events are recognized as a first-class part of the permission architecture. The system context describes hooks as firing at defined lifecycle points — before and after tool execution among others — and instructs CC to respect hook outcomes as authoritative signals about whether to proceed.

The `<system-reminder>` XML tag is a recognized injection point in the system context. Content delivered under this tag is treated as high-priority runtime context — for example, the side-question agent's constraints are delivered via this mechanism. CC is instructed to honor system-reminder content as part of its active operating context, not as user input.

MCP servers are treated as external tool providers whose capabilities become available to CC after connection. The system context includes guidance on discovering MCP servers (via registry search), connecting them, and updating the MCP configuration files that govern which servers are active for a session. The permission model for MCP-provided tools follows the same auto-allow/prompt-to-allow logic as native tools.

Context compression is acknowledged in the system context: CC is aware that long conversations may be compacted, and the autonomous loop's prompt design explicitly accounts for the possibility that a given loop tick may be a first fire after compaction. The dynamic sentinel value in loop prompts expands differently depending on whether the context is fresh, post-compaction, or a routine subsequent fire — allowing CC to calibrate its orientation step accordingly.

The egress proxy layer (present in certain deployment environments) is treated by the system context as a policy-enforcing infrastructure component, not a network detail. CC is instructed to diagnose proxy failures using a defined classification scheme (certificate errors, method errors, policy denials, tool-level proxy ignorance, git-specific issues, container isolation) and apply corresponding fixes — except for policy denials, which are to be reported rather than resolved.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.195 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `L` | UI analytics dashboard script assembler (collapsible sections, clipboard copy, timezone histogram) |
| `s` | SQL keyword list assembler (PostgreSQL reserved words + side-question system-reminder injector) |
| `l` | PostgreSQL type keyword list assembler + subagent delegation prompt examples (task tool) |
| `a` | Fork-type subagent delegation prompt examples assembler |
| `A` | Autonomous loop tick instruction assembler (run/arm/confirm/schedule/stop cycle) |
| `i` | Subagent prompt-writing guidance assembler (briefing quality and context requirements) |
| `M` | Authentication/verification error message assembler (cross-site block, expired code, wrong browser) |
| `D` | Subtask block property and event name constant assembler |
| `c` | Job block property and event name constant assembler |
| `E` | Pseudoreference code constant assembler (access types, components, privileges, groups) |
| `x` | Business rule ID constant assembler (autonumeration, validation, firm-context rules) |
| `h` | Dataset event name constant assembler + background process telemetry (sigkill, low-mem, spare pool) |
| `d` | Daemon config reload telemetry event assembler |
| `wRt` | No-string assembler (structural/glue role, zero large strings) |
| `H` | No-string assembler (structural/glue role, zero large strings) |
| `m` | No-string assembler (structural/glue role, zero large strings) |
| `u` | No-string assembler (structural/glue role, zero large strings) |
| `g` | No-string assembler (structural/glue role, zero large strings) |
| `f` | No-string assembler (structural/glue role, zero large strings) |
| `w` | No-string assembler (structural/glue role, zero large strings) |
| `v` | No-string assembler (structural/glue role, zero large strings) |
| `I` | Analytics dashboard CSS stylesheet assembler (layout, stat cards, friction categories, CLAUDE.md UI) |
| `p` | PostgreSQL SQLSTATE error code constant assembler |
| `ejo` | Tool-denial workaround policy instruction assembler |
| `Hbf` | Git operation instruction assembler (PR creation workflow + commit safety protocol) |
| `xoo` | Autonomous loop behavioral policy assembler (scope, actions, repeated invocation, idle behavior) |
| `CLc` | Live documentation URL index assembler (Mintlify endpoint table for self-service doc fetching) |
| `ncm` | Agent proxy configuration and failure diagnosis instruction assembler |
| `Gvc` | Files API Python reference assembler (upload, use in messages, manage, end-to-end example) |
| `iIc` | MCP discovery and connection workflow assembler (registry search, connector suggestion, config format) |