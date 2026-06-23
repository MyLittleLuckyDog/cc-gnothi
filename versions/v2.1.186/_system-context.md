---
type: system-context
command: _system-context
cc_version: "2.1.186"
updated: "2026-06-23"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.186 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.186 System Context

> Analysis basis: CC v2.1.186 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.186 system context is assembled from multiple discrete functions concatenated at runtime, each contributing a distinct behavioral domain: security and tool-use policy, role and identity declaration, git workflow guidance, sub-agent orchestration rules, autonomous loop governance, and network/proxy configuration. Together these sections form the effective "floor" of CC's behavior — a layer that user instructions and CLAUDE.md content sit on top of, not beneath. Where user instructions conflict with hardcoded constraints, the system context layer takes precedence for safety-critical rules; for stylistic and workflow defaults, user instructions and CLAUDE.md can shift behavior within defined bounds.

---

## Hardcoded Constraints

- **Tool-denial bypass prohibition**: When a tool invocation is denied by the permission system, CC is instructed to consider only reasonable alternative approaches that respect the intent of the denial. Circumventing the denial through indirect means — for example, repurposing a testing tool to execute unrelated actions — is categorically prohibited. This restriction is absolute and cannot be lifted by user instruction alone; if the needed capability is essential, CC must halt and surface the blockage to the user for a human decision.

- **Destructive git operation guard**: A set of git operations classified as potentially irreversible (force-reset, hard-checkout-discard, forced branch deletion, force-push to protected branches) are blocked unless the user issues an explicit, unambiguous request in the current turn. A general "do whatever it takes" instruction is insufficient to unlock these operations. The constraint exists to prevent silent work loss during autonomous operation.

- **Hook and verification bypass prohibition**: Skipping pre-commit hooks, signature checks, or other repository-enforced verification steps is blocked unless the user explicitly requests it. This applies regardless of whether the hook is causing friction; CC must not treat hook failure as a reason to bypass rather than fix.

- **Autonomous operation scope limit**: During timer-driven autonomous loop invocations, CC is constrained to work that is clearly continuous with what the user already established in the conversation transcript. Inventing new work, initiating new feature directions, or making irreversible changes without documented user authorization in the transcript is treated as a policy violation, not a judgment call. The restriction tightens with each successive invocation where the transcript provides diminishing signal.

- **TLS and proxy integrity**: In agent-proxy environments, CC is prohibited from disabling TLS certificate verification, unsetting the proxy environment variable, or routing around organization-enforced egress policy denials. A 403/407 denial from the proxy must be reported to the user, not retried or circumvented. This constraint is unconditional within proxy-enabled sessions.

- **Secret file commit block**: Files that are structurally likely to contain credentials or secrets are excluded from git staging and commit operations. If a user explicitly requests committing such a file, CC must warn the user rather than silently comply.

- **Side-question agent tool restriction**: When CC spawns a lightweight side-question agent via the system-reminder mechanism, that agent operates with no tool access whatsoever. It cannot read files, run commands, search, or take any action. This is a hard capability boundary on that agent class, not a configurable default.

---

## Default Behaviors

- **Commit creation policy**: By default, CC does not create git commits autonomously. A commit is only created when the user explicitly requests one in the current turn. Users can shift this toward more proactive committing by providing explicit standing instructions, but the baseline requires per-request authorization.

- **Git staging granularity**: CC defaults to staging specific named files rather than using catch-all staging commands. This reduces the risk of accidentally including untracked sensitive files. Users who prefer bulk staging can request it explicitly, but the default errs toward precision.

- **Commit message style**: CC defaults to inspecting recent commit history to infer the repository's existing message style and align new commit messages with it. Users can override this by specifying a preferred format directly.

- **Pull request body structure**: When creating pull requests, CC defaults to a structured summary-plus-test-plan format. This default can be changed by user instruction or by repository-level CLAUDE.md conventions.

- **Remote push behavior**: CC does not push to remote repositories by default, even after creating a commit. A push requires explicit user instruction. This default is intended to preserve the user's control over what reaches shared infrastructure.

- **Sub-agent prompt completeness**: When delegating to a sub-agent, CC defaults to writing self-contained prompts that include all relevant context, file paths, constraints, and expected output format — because sub-agents start with no conversation history. Users can influence what context is included by providing more or less detail in their requests.

- **Autonomous loop verbosity**: During autonomous operation, CC defaults to minimal narration: it acts rather than describes, and reports results concisely. After multiple consecutive invocations with nothing actionable, it defaults to a single-sentence status rather than a detailed summary. Users cannot directly configure this verbosity, but the loop prompt structure influences it.

- **PR maintenance priority ordering**: During autonomous operation, the default priority order is (1) continuing active conversation work, (2) PR maintenance including CI and review threads, (3) opportunistic branch quality sweeps. This ordering is hardcoded into the autonomous loop behavioral guidance and is not user-configurable at runtime.

- **SSH-to-HTTPS remote rewriting**: In agent-proxy sessions, SSH-form git remotes are rewritten to HTTPS by default to route through the proxy. This default is suppressed if the session has its own SSH configuration or supplies conflicting git config variables.

- **Documentation fetch preference**: When CC needs to consult live documentation, it defaults to fetching the `.md` variant of Mintlify-served pages rather than `.mdx`, as the former produces cleaner extraction output. Users can override this by specifying a URL directly.

---

## CLAUDE.md Redundancy Warning

- **Commit safety rules**: The system context already enforces the core commit safety behaviors — no autonomous commits, no force operations without explicit request, no hook bypasses, no amend-after-hook-failure. Adding equivalent rules to CLAUDE.md is redundant for safety-critical cases. Adding *conflicting* rules (e.g., "always amend rather than create new commits") creates instruction conflict that may produce unpredictable behavior, since the system context constraint and the CLAUDE.md instruction pull in opposite directions.

- **PR title and body format**: The system context already specifies a default PR title length limit and body structure. If CLAUDE.md specifies the same format, the duplication is neutral. If CLAUDE.md specifies a different format, it will likely override the default — this is intentional and harmless, but users should be aware the system context default already exists so they don't add it thinking nothing is there.

- **Sub-agent briefing style**: The system context already instructs CC to write self-contained, context-rich sub-agent prompts and explicitly warns against delegating synthesis or understanding to the agent. Adding similar guidance to CLAUDE.md is redundant. Conflicting instructions (e.g., "keep sub-agent prompts short") may degrade delegation quality.

- **Autonomous loop behavior**: Instructions about what CC should or should not do during autonomous timer-fired invocations are already specified in the system context. CLAUDE.md additions in this area may conflict with the scope-limiting policy already in place, potentially causing confusion about authorized work boundaries.

- **Git staging approach**: The preference for staging specific files rather than bulk staging is already set at the system level. A CLAUDE.md instruction to always use bulk staging would conflict with this default and could reintroduce the sensitive-file risk the default was designed to prevent.

- **Documentation self-help**: The system context already equips CC with a curated table of live documentation URLs and extraction prompts for self-directed lookup. Adding documentation links to CLAUDE.md for CC to consult is redundant if those sources are already in the live documentation table. It is not neutral if the CLAUDE.md links point to outdated or unofficial sources that contradict the live documentation.

---

## User Actionable Insights

1. **You cannot instruct CC to bypass a tool denial indirectly.** If a permission rule blocks a tool, CC will not find a workaround that violates the denial's intent. The correct path is to adjust the permission rule itself, not to write a CLAUDE.md instruction telling CC to be creative about restrictions.

2. **Explicit beats implicit for all destructive operations.** Force-push, hard reset, branch deletion, and similar operations require explicit per-turn requests. A standing CLAUDE.md instruction saying "use force when needed" will not reliably unlock these; the system context requires clear, current-turn authorization.

3. **The autonomous loop is scope-bounded by the transcript.** If you want CC to do something during an autonomous session, establish it clearly in the conversation before the loop fires. Instructions that appear only in CLAUDE.md, without being discussed in the active transcript, carry weaker signal and may not be acted on.

4. **Push is never implicit.** Even after a successful commit, CC will not push unless you ask. If your workflow assumes push-after-commit, add that to your CLAUDE.md or make it a standing per-session instruction — but understand this extends an already-explicit default, it does not override a restriction.

5. **Side-question agents are intentionally tool-free.** If you trigger a side-question (the lightweight parallel agent mechanism), do not expect it to look anything up or run any commands. Its answers are limited to what is already in conversation context. This is not a bug or configuration gap — it is the designed behavior.

6. **TLS and proxy rules are non-negotiable in proxy sessions.** If you are running CC in an environment with an organizational egress proxy, certificate verification cannot be disabled and policy denials cannot be routed around. If a dependency or tool fails due to proxy configuration, the resolution path is fixing the tool's CA configuration, not disabling verification.

7. **The live documentation table is version-specific.** The URLs embedded in this version of CC point to documentation as of v2.1.186. If you upgrade CC, the embedded documentation table updates with it. Hardcoding these URLs in CLAUDE.md creates a version-pinned documentation source that may diverge from the installed CC version's behavior.

8. **Sub-agent prompts should be written by you, not delegated back to the agent.** The system context explicitly warns against prompts that say "based on your findings, do X." CC is instructed to synthesize before delegating. If your CLAUDE.md encourages open-ended delegation, it conflicts with this instruction and may produce lower-quality sub-agent results.

9. **Commit message style is inferred, not fixed.** CC reads your recent commit history to match style. If your repository has an inconsistent commit history, CC's inferences may also be inconsistent. A CLAUDE.md commit message format specification will reliably override this inference — this is one of the more valuable CLAUDE.md additions for teams with style standards.

10. **Pre-commit hook failures require a new commit, not an amend.** The system context explicitly addresses this: if a hook rejects a commit, the commit did not occur, and amending would target the previous commit. CC will create a new commit after fixing the issue. Do not add CLAUDE.md instructions to amend on hook failure — this conflicts with the hardcoded guidance and risks data loss.

---

## Tool & Permission Layer

### Permission Decision Model

The system context embeds a two-tier permission model. In the first tier, certain tool invocations are pre-approved and execute without prompting the user — this is the auto-allow mode, typically applied to read-only or low-risk operations. In the second tier, operations with side effects or elevated risk require a runtime confirmation before execution. Which tier applies is determined by the tool type, the operation being requested, and any permission rules configured by the user.

When a permission check results in a denial, the denial carries semantic intent: CC is expected to respect not just the literal block but the underlying reason for it. The system context explicitly addresses this by prohibiting workarounds that honor the letter of a denial while violating its spirit.

### Hook Event System

The system context references a hook event infrastructure that fires at defined points in CC's operational lifecycle. These hooks allow external processes to observe or react to CC's actions. The hook system is configured separately from CLAUDE.md and operates below the user instruction layer — hooks fire regardless of what CLAUDE.md says about a given action.

### System-Reminder Tag Handling

A dedicated system-reminder XML tag mechanism is used to inject behavioral context into specific agent types without contaminating the main conversation. The side-question agent, for example, receives its constraints and role definition via this tag. CC is trained to treat system-reminder content as authoritative behavioral context, distinct from user messages, and to respond accordingly — including the constraint that no tool use is available in that agent class.

### MCP Server Integration

The system context includes guidance for discovering and connecting Model Context Protocol servers. CC can search a registry of available MCP connectors, present connection UI to users, and update plugin MCP configuration files. The permission model for MCP tools follows the same auto-allow / prompt-to-allow structure as native tools, with the MCP server's declared tool list determining which operations are available.

### Context Compression Notice

The autonomous loop system context includes awareness of context compression events. When the conversation context is compacted, the loop's behavioral instructions account for this — the sentinel prompt string used to schedule the next loop invocation is designed to expand appropriately whether it fires on a first invocation, a first invocation after compaction, or a subsequent loop iteration. This means the loop's behavioral guidance is robust to context window management operations.

### Agent Proxy Trust Infrastructure

In proxy-enabled sessions, the system context configures CC with awareness of the full CA trust chain, the proxy status endpoint, and the diagnostic and remediation steps for each failure class. CC is expected to consult the proxy status endpoint before escalating to the user and to apply the appropriate fix for the identified failure class. This diagnostic layer is part of the system context, not a user-configurable behavior.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.186 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `L` | UI utility functions and background worker memory management (dashboard JS + low-memory telemetry) |
| `s` | PostgreSQL keyword list (syntax highlighting) + side-question system-reminder tag handler |
| `l` | PostgreSQL type list (syntax highlighting) + sub-agent delegation prompt examples (non-fork) |
| `a` | Sub-agent fork orchestration prompt examples and coordinator turn-boundary semantics |
| `A` | Autonomous loop tick instruction set (run/arm/schedule/stop cycle) |
| `i` | Sub-agent prompt writing guidelines (briefing principles, delegation anti-patterns) |
| `D` | Subtask block property and event constant definitions |
| `c` | Job block property and event constant definitions |
| `E` | Pseudo-reference code constant definitions (access types, components, privileges) |
| `k` | Reference record validation rule ID constants |
| `g` | Dataset event name constants (dse* and re* event series) |
| `d` | Daemon config reload telemetry handler (no large strings) |
| `f` | Background worker dispatch and memory management telemetry handler |
| `sIt` | Assembler call stub (no large strings, no telemetry) |
| `H` | Background worker infrastructure handler (no large strings) |
| `m` | Background worker lifecycle handler (no large strings) |
| `u` | Background worker utility handler (no large strings) |
| `h` | Background worker handler variant (no large strings) |
| `x` | Background worker handler variant (no large strings) |
| `w` | Bundle section assembler (no large strings) |
| `v` | Background worker infrastructure variant (no large strings) |
| `I` | Dashboard HTML/CSS report renderer (large CSS/JS string for analytics UI) |
| `p` | PostgreSQL SQLSTATE error code list (syntax highlighting / error handling) |
| `UPo` | Tool-denial bypass policy instruction (permission denial handling guidance) |
| `A8p` | Git workflow instructions (commit protocol + pull request creation protocol) |
| `Zqr` | Autonomous loop behavioral policy (steward scope, PR maintenance, repeated invocation rules) |
| `Osc` | Live documentation URL table (Mintlify source map for self-directed doc lookup) |
| `JPf` | Agent proxy configuration and TLS failure diagnosis guide |
| `eoc` | Files API reference documentation (Python, beta) |
| `gtc` | MCP discovery, registry search, and plugin configuration guide |