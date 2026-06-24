---
type: system-context
command: _system-context
cc_version: "2.1.190"
updated: "2026-06-25"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.190 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.190 System Context

> Analysis basis: CC v2.1.190 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

CC's system context layer is assembled from multiple distinct functions that are concatenated or conditionally injected at runtime, each governing a different behavioral domain. The categories covered span: role and identity declaration, tool permission policy, git and version-control safety rules, sub-agent orchestration guidance, autonomous loop governance, and proxy/network trust configuration. This layer sits above user instructions and CLAUDE.md content in the authority hierarchy — it establishes defaults and hard limits before any user-supplied configuration is evaluated. Where user instructions can influence behavior, they do so by narrowing or adjusting within the bounds this layer defines, not by superseding it.

---

## Hardcoded Constraints

- **Tool denial handling**: When CC declines to use a specific tool for a given purpose, it is permitted to attempt alternative tools that could accomplish the same legitimate goal through reasonable means. However, it is prohibited from using any capability — including test execution infrastructure or other side-channels — to work around the intent of the denial. If no acceptable path exists, CC is required to stop and explain what it was attempting and why the blocked capability was needed, deferring the decision to the user.

- **Git destructive-operation guard**: A set of git operations classified as destructive (force operations, hard resets, wholesale discards, branch deletions) are blocked from autonomous execution. These operations require explicit user instruction before CC will run them. This constraint cannot be overridden by CLAUDE.md alone; it requires in-session explicit direction from the user.

- **Git configuration immutability**: CC is prohibited from modifying git configuration under any circumstance during a session. This is an absolute constraint with no authorization-based exception pathway described in the system layer.

- **Hook and verification bypass prohibition**: Skipping commit hooks, signature checks, or other repository integrity verification mechanisms is blocked unless the user explicitly requests it. The default is always to respect these hooks.

- **Force-push to protected branches**: Force-pushing to main or master branches is blocked. If a user requests it, CC surfaces a warning rather than silently complying.

- **Commit amendment safety rule**: Amending commits is blocked as a default recovery path after hook failures. The system encodes that a failed pre-commit hook means the commit did not occur, so amendment would modify unrelated prior history. Only explicit user instruction to amend unlocks this path.

- **Sensitive file staging guard**: Automatically staging all files (e.g., bulk-add commands) is discouraged in favor of explicit per-file staging, specifically to prevent accidental inclusion of credential files or large binaries. This is a behavioral default enforced by the system layer, not user preference.

- **Autonomous loop scope restriction**: When operating in a timer-driven autonomous mode without the user present, CC is constrained to act only on work already established in the conversation transcript. Inventing new work, initiating new tasks not grounded in the transcript, or making irreversible changes without clear prior authorization are all treated as out-of-scope behaviors. The system layer explicitly encodes that trust erosion from overreach is a more serious risk than under-delivery.

- **TLS verification inviolability**: In proxy-mediated session environments, disabling TLS certificate verification is an absolute prohibition. Similarly, unsetting the proxy environment variable or attempting to route around organization-level egress policy denials is blocked. Policy denials are to be reported, not circumvented.

- **Side-question agent tool restriction**: When CC spawns a lightweight agent instance to answer a side question, that instance is hardcoded to have no tool access. It cannot read files, execute commands, search, or take actions of any kind. This is not user-configurable for that agent class.

---

## Default Behaviors

- **Commit creation policy**: By default, CC does not create commits unless the user explicitly requests one. This default protects against unwanted history modification during exploratory or iterative work. Users can change this by explicitly asking for commits, but the system default is conservative.

- **Remote push policy**: CC does not push to remote repositories unless the user explicitly requests it. The default assumes local-only changes until told otherwise. Users can change this per-session with explicit instruction.

- **Pull request workflow steps**: CC follows a multi-step parallel workflow when creating pull requests — checking branch state, staged changes, and remote tracking status before drafting the PR. Users can influence the PR title, body structure, and target branch, but the underlying safety-check sequence is part of the default behavior.

- **Commit message style**: CC defaults to drafting concise, purpose-focused commit messages that emphasize the "why" over the "what," following repository conventions observed from recent git log output. Users can adjust style preferences via CLAUDE.md or explicit instruction.

- **Sub-agent prompt construction**: When delegating to sub-agents, CC defaults to writing self-contained prompts that include full context, because sub-agents start with no awareness of the parent conversation. Users can influence the level of detail by adjusting how they frame delegation requests.

- **Autonomous loop pacing**: When operating in autonomous loop mode, CC selects a delay interval based on observed activity level — quieter states produce longer delays, active states produce shorter ones. A monitor-armed session uses a longer fallback heartbeat. Users can influence this through loop configuration parameters.

- **PR maintenance priority ordering**: In autonomous mode, CC defaults to prioritizing active conversation work over PR maintenance, and PR maintenance over idle sweeping. Users cannot directly reconfigure this priority ordering within a session, but the scope is bounded by what the transcript establishes.

- **Context-aware documentation fetching**: CC defaults to consulting bundled references first, and only fetches live documentation when bundled content is insufficient or the user asks about behavior not covered by the local snapshot. Users can trigger live fetches explicitly.

- **Proxy trust configuration**: In proxy-mediated environments, CC defaults to following pre-configured CA trust settings and does not require per-tool manual configuration. However, when a tool is found to be bypassing the proxy or failing trust, CC will apply tool-specific fixes rather than disabling verification globally.

---

## CLAUDE.md Redundancy Warning

- **Commit safety defaults**: The system layer already encodes conservative commit behavior — no automatic commits, no automatic pushes, no force operations without explicit instruction. Adding CLAUDE.md instructions to "never commit automatically" or "always ask before pushing" duplicates existing defaults. These additions are neutral if worded consistently, but if worded more permissively they may create instruction conflict that loosens the default.

- **Git config protection**: The prohibition on modifying git configuration is hardcoded. A CLAUDE.md instruction saying "do not change git settings" is purely redundant. A CLAUDE.md instruction that attempts to grant permission to modify git config would conflict with the hardcoded constraint.

- **Commit message conventions**: The system layer already instructs CC to observe the repository's existing commit message style from log history. Adding commit message format instructions to CLAUDE.md is often redundant if the repo already has a consistent style. Conflicting CLAUDE.md instructions (e.g., enforcing a format that differs from repo history) may override the adaptive default in unpredictable ways.

- **Sub-agent briefing quality**: The system layer already instructs CC to write fully self-contained, context-rich sub-agent prompts. CLAUDE.md instructions to "always give agents full context" are redundant. Instructions that specify a different delegation style (e.g., terse prompts) would conflict with the default and potentially degrade sub-agent output quality.

- **PR body format**: The system layer defines a default PR body structure (summary bullets, test plan checklist). If CLAUDE.md specifies a different PR template, it will likely override this default. This is a case where CLAUDE.md customization is meaningful and intentional, not merely redundant — but users should be aware the system already has an opinionated default.

- **Autonomous loop behavior**: The system layer governs what CC acts on during autonomous operation. CLAUDE.md entries that attempt to expand autonomous scope (e.g., "feel free to start new tasks") may conflict with the hardcoded "steward not initiator" constraint. The system layer's framing is explicit that scope overreach erodes trust; CLAUDE.md cannot reliably relax this.

- **Staged file selection**: The default of preferring explicit per-file staging over bulk-add is system-layer encoded. A CLAUDE.md instruction to "use git add -A for convenience" would conflict with this default and potentially expose sensitive files to accidental commits.

---

## User Actionable Insights

1. **Destructive git operations require explicit in-session instruction.** No CLAUDE.md entry can pre-authorize force pushes, hard resets, or branch deletions. These must be requested explicitly at the time of use. Plan workflows accordingly — do not rely on CLAUDE.md to grant standing permission for these operations.

2. **Commits and pushes will not happen silently.** The system default is to never commit or push without explicit user direction. If CC appears to be "not committing," this is intended behavior, not a bug. Instruct it explicitly when you want a commit.

3. **Sub-agents in side-question mode have zero tool access.** If you spawn or trigger a side-question agent, it will answer based only on conversation context — it cannot read files or run commands. Do not expect it to investigate or verify anything. Frame side questions accordingly.

4. **Autonomous loop mode is scoped to established work only.** If you activate autonomous operation while away, CC will not invent new tasks. It will only act on work already discussed in the transcript. If you want it to handle additional areas autonomously, establish those areas explicitly in the conversation before leaving.

5. **TLS verification and proxy settings cannot be overridden by instruction.** In proxy-mediated environments (e.g., enterprise egress proxy sessions), CC will refuse to disable certificate verification or bypass the proxy. If tools are failing due to trust issues, the correct path is to configure the tool to use the provided CA bundle — not to ask CC to skip verification.

6. **The system layer already sets PR and commit workflow steps.** If your team has a specific PR format, specifying it in CLAUDE.md is worthwhile and will override the default. However, the underlying safety checks (branch state inspection, staged diff review, remote tracking check) run regardless of CLAUDE.md instructions.

7. **Hook skipping requires explicit per-session instruction.** If a repository has pre-commit hooks that fail and you need to bypass them temporarily, you must ask explicitly at that moment. CLAUDE.md cannot pre-grant hook bypass permission.

8. **Tool denial workarounds are constrained by intent, not just mechanism.** If CC declines to use a specific tool for a task, it may try a reasonable alternative — but it will not use other capabilities as covert workarounds. If no compliant path exists, it will stop and ask you. This means some blocked operations result in a full stop, not a silent failure.

9. **Live documentation fetching is available but not the default.** CC will fetch from live docs URLs (settings, permissions, hooks, MCP, CLI reference, etc.) when needed, but defaults to bundled references first. If you need the most current documentation for a feature, ask CC explicitly to fetch the live version.

10. **v2.1.190 is the first analyzed version.** Identifier mappings and byte offsets in the Appendix are specific to this bundle. Future versions will change obfuscated identifiers; behavioral paraphrases in this document may remain accurate across minor versions but should be re-verified on major bundle updates.

---

## Tool & Permission Layer

The system context embeds a structured description of how tool permissions are evaluated and communicated to CC itself. Two primary permission modes are described: an auto-allow mode in which pre-approved tool invocations proceed without prompting the user, and a prompt-to-allow mode in which CC surfaces the intended action for user confirmation before execution. The boundary between these modes is determined by the tool type, the scope of the operation, and any explicit rules established in session configuration.

Hook events are recognized as a distinct trigger class. The system context explains to CC that hook-fired invocations carry their own event context and should be handled as discrete events rather than continuations of prior turns. This affects how CC interprets the source and scope of an instruction when a hook fires.

The system-reminder XML tag is used to inject structured context into the conversation at specific points — most visibly in the side-question agent pattern, where a full behavioral briefing is injected via this tag to configure the lightweight agent instance. Users and operators can inject content via this mechanism, but the system layer's own use of it establishes baseline agent behavior that takes precedence.

MCP server configuration is handled through `.mcp.json` files at the plugin or project root, with a defined resolution order: explicit `mcpServers` field in `plugin.json` → referenced config file → default `.mcp.json`. The system context describes how CC should locate, read, and apply this configuration, including fallback behavior when directory entries lack explicit endpoint URLs.

Context compression is acknowledged in the system layer. When the context window approaches capacity, non-pinned background workers are shed first; pinned workers are retired only as a last resort. This behavior is instrumented with telemetry events and represents a system-managed process, not something user instructions can directly control. Users may observe mid-session behavioral changes attributable to compression without receiving explicit notification beyond what the system layer provides internally.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.190 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `L` | UI utility + background worker memory management (collapsible/copy UI helpers; low-memory pinned-worker retirement logic) |
| `s` | SQL keyword table (PostgreSQL) + side-question agent system-reminder injector |
| `l` | PostgreSQL type keyword table + sub-agent prompt construction examples (tool-based delegation) |
| `a` | Sub-agent fork orchestration examples (fork-mode async delegation with notification turn model) |
| `A` | Autonomous loop tick instruction block (timer-driven loop control, monitor arming, delay selection, stop condition) |
| `i` | Sub-agent prompt writing guidance (context-briefing principles, delegation anti-patterns) |
| `D` | Subtask block property constant table (workflow/BPM subtask schema identifiers) |
| `c` | Job block property constant table (workflow/BPM job schema identifiers) |
| `E` | Pseudoreference code constant table (access/component/privilege reference identifiers) |
| `k` | Validation rule ID constant table (reference record rules, numeration rules) |
| `g` | Dataset event name constant table (dse* and re* event identifiers, route selection events) |
| `d` | Daemon config reload telemetry handler (no string payload; emits tengu_daemon_config_reload) |
| `f` | Background process dispatch telemetry handler (SIGKILL escalation, low-mem, spare worker lifecycle) |
| `TIt` | Stub / zero-payload assembler call (no strings, no telemetry) |
| `H` | Stub / zero-payload assembler call (no strings, no telemetry) |
| `m` | Stub / zero-payload assembler call (no strings, no telemetry) |
| `u` | Stub / zero-payload assembler call (no strings, no telemetry) |
| `h` | Stub / zero-payload assembler call (no strings, no telemetry) |
| `x` | Stub / zero-payload assembler call (no strings, no telemetry) |
| `w` | Stub / zero-payload assembler call (no strings, no telemetry) |
| `v` | Stub / zero-payload assembler call (no strings, no telemetry) |
| `I` | Analytics dashboard UI stylesheet + histogram/timezone rendering logic |
| `p` | PostgreSQL SQLSTATE / error code constant table |
| `iOo` | Tool denial workaround policy injector (permitted alternative tool use vs. prohibited bypass framing) |
| `bWp` | Git workflow instruction block (commit safety protocol + PR creation workflow) |
| `LVr` | Autonomous loop behavioral specification (steward scope, PR maintenance priority, repeated-invocation scaling) |
| `Wsc` | Live documentation URL index (Mintlify-served CC docs map with per-topic extraction prompts) |
| `cPf` | Agent proxy trust configuration guide (TLS failure classes, fix procedures, proxy bypass prohibition) |
| `soc` | Files API reference — Python (beta file upload/use/management SDK examples) |
| `btc` | MCP discovery and connection guide (registry search, connector suggestion, plugin config update workflow) |