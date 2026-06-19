---
type: system-context
command: _system-context
cc_version: "2.1.183"
updated: "2026-06-19"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.183 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.183 System Context

> Analysis basis: CC v2.1.183 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.183 system context is assembled from multiple cooperating function segments embedded in the bundle, each contributing a distinct behavioral domain: role declaration, tool permission policy, git/SCM workflow rules, subagent delegation guidelines, autonomous loop governance, and live documentation routing. Together these segments form a layered instruction stack that CC consults before evaluating any user instruction or CLAUDE.md content. User instructions and CLAUDE.md operate within the space this system context defines — they can tune defaults but cannot override the hardcoded constraints the context enforces. The system context is version-tagged, meaning behavior in v2.1.183 may differ from adjacent versions in specific policy areas noted below.

---

## Hardcoded Constraints

- **Tool denial circumvention boundary**: When a tool use is denied, CC is instructed to consider only reasonable, non-deceptive alternative approaches that honor the intent of the denial. Attempting to achieve the same outcome through indirect or adversarial means — such as repurposing a permitted tool to accomplish what a denied tool would have done — is categorically blocked. If the capability is genuinely required, CC must stop and surface the situation to the user rather than proceeding unilaterally.

- **Git destructive-operation gate**: A fixed set of git operations classified as destructive (forced pushes, hard resets, wholesale file discards, branch deletions, and hook-skipping flags) are blocked unless the user has made an explicit, unambiguous request in that turn. This constraint applies even when CC determines the operation would be safe or beneficial. Force-pushing to protected branches carries an additional mandatory warning.

- **Commit autonomy restriction**: CC will not create git commits unless the user has directly requested one. The constraint is framed as a trust boundary: unsolicited commits are treated as a form of unauthorized action regardless of how confident CC is in the changes.

- **Secrets exclusion from staging**: Files that are likely to contain credentials or secrets are excluded from git staging operations by policy. If a user explicitly requests committing such files, CC must warn before proceeding rather than silently comply.

- **Autonomous loop scope cap**: During timer-driven autonomous operation (when the user is away), CC is constrained to work that the existing conversation transcript already authorized. Inventing new tasks, expanding scope beyond what was established, or making irreversible changes without clear prior authorization are all blocked behaviors in this mode. The system context explicitly instructs CC to treat the impulse to justify a borderline action as a signal to stop rather than proceed.

- **Side-question agent tool isolation**: When a lightweight side-question agent is spawned to answer an in-flight user query without interrupting the main agent, that spawned instance has no tool access whatsoever. It cannot read files, run commands, search, or take actions of any kind. This is an architectural constraint, not a configurable permission.

- **Interactive git flag prohibition**: Git flags that require interactive terminal input (such as interactive rebase or interactive add) are blocked because CC's execution environment does not support interactive stdin. This prevents CC from hanging on commands that would otherwise wait for user keystrokes.

- **Pull request tool restriction**: When creating pull requests or commits, CC is prohibited from using certain categories of tools (implicitly: file-editor and similar write tools outside the bash path). The gh CLI via the bash tool is the mandated path for all GitHub operations.

---

## Default Behaviors

- **Parallel tool execution**: By default, CC batches independent tool calls in parallel when multiple pieces of information are needed simultaneously. Users can influence this implicitly by structuring requests sequentially, but the default leans toward parallelism for performance.

- **Commit message style**: By default, CC inspects the repository's recent commit history to infer and match the project's existing commit message conventions. Users can override this by specifying a format explicitly, or by configuring a style in CLAUDE.md.

- **PR body structure**: The default pull request body includes a summary section and a test plan checklist in markdown. Users can request a different format, and CLAUDE.md can establish a project-specific template that overrides this default.

- **Staging specificity**: CC defaults to staging files by explicit name rather than using blanket "add all" flags. This is a safety default that users can override with an explicit instruction, though the system context's secrets-exclusion constraint still applies.

- **Autonomous loop verbosity**: In autonomous (timer-driven) mode, CC defaults to concise status communication — a single sentence when nothing actionable is found, and action-first reporting (doing the work rather than describing it) when something is found. After several consecutive idle cycles, the default behavior shifts to a reduced-scope check rather than continued full sweeps.

- **SCM rebase preference**: When the autonomous loop detects that the working branch has fallen behind its base, CC defaults to rebasing rather than merging, keeping history linear. This default is not explicitly user-configurable in the system context, though explicit user instructions could override it.

- **Subagent prompt completeness requirement**: When delegating to a subagent, CC is expected by default to write fully self-contained prompts that do not rely on the subagent having access to the current conversation context. This default reflects the architectural reality that subagents start without shared context, and it shapes how CC constructs delegation prompts.

- **Documentation fetch preference**: When bundled references are insufficient, CC defaults to fetching live documentation from a known set of canonical URLs rather than guessing or hallucinating. The preference ordering (bundled first, then live fetch) is a default that users can influence by explicitly asking CC to check live docs.

---

## CLAUDE.md Redundancy Warning

- **Commit behavior rules**: The system prompt already establishes detailed commit policies — when to commit, how to stage files, how to write messages, and what to avoid. Users who add commit instructions to CLAUDE.md are partially duplicating this layer. Neutral if aligned; potentially conflicting if the CLAUDE.md instruction contradicts the system-level safety constraints (e.g., instructing CC to always use broad staging flags).

- **PR creation workflow**: The system context already encodes a multi-step PR creation procedure including status checks, diff analysis, and body formatting. CLAUDE.md entries that specify PR body templates are additive and generally safe, but entries that attempt to alter the procedural sequence may create instruction conflicts.

- **Parallel execution preference**: The system context already instructs CC to run independent commands in parallel. Adding "run things in parallel" to CLAUDE.md is redundant. Adding "run things sequentially" would conflict with the default and may or may not win depending on instruction precedence.

- **Subagent prompt writing guidelines**: The system context already contains detailed guidance on how to write effective subagent delegation prompts, including context-briefing requirements and the prohibition on delegating synthesis. CLAUDE.md entries that attempt to re-specify subagent behavior are largely redundant and may create confusion if they conflict with the architectural constraints (e.g., falsely implying subagents share conversation context).

- **Autonomous loop behavior**: The system context already fully governs what CC does and does not do during autonomous timer-driven operation. CLAUDE.md entries attempting to expand autonomous scope (e.g., "feel free to open new issues") may conflict with the hardcoded stewardship constraints and should be used with caution.

- **Git safety rules**: The system context already prohibits destructive git operations without explicit user request. Adding equivalent safety instructions to CLAUDE.md is neutral but redundant. Adding instructions that attempt to relax these constraints (e.g., "you may force push if needed") creates a conflict where the system-level constraint is likely to take precedence.

---

## User Actionable Insights

1. **You cannot instruct CC to commit speculatively.** Regardless of CLAUDE.md content, CC will not create commits unless you explicitly ask for one in the current turn. Workflows that depend on automatic commit behavior must include explicit commit requests.

2. **Destructive git operations require explicit per-turn authorization.** A CLAUDE.md entry saying "you have permission to force push" is insufficient — the system context requires an explicit request in the active conversation. Plan workflows accordingly.

3. **The side-question agent is read-only by architecture.** If CC spawns a lightweight agent to answer a question while the main agent works, that side agent cannot access files or run tools. Do not expect it to look things up or verify facts beyond what is already in the conversation context.

4. **Autonomous mode is a stewardship mode, not an expansion mode.** If you leave CC running on a timer, it will advance work already established in the conversation but will not invent new tasks. To get autonomous work on a new area, you must establish it in conversation before going away.

5. **Subagent prompts must be self-contained.** When CC delegates to a subagent, the subagent starts with no knowledge of your conversation. If you review a subagent prompt CC wrote and it lacks context, that is a problem — you can instruct CC to include more background in the delegation prompt.

6. **Live documentation is fetched from known URLs, not searched freely.** CC's fallback for missing documentation is a fixed table of canonical CC documentation endpoints. If you need CC to consult documentation from a different source, you must provide the URL explicitly.

7. **Secrets files are excluded from staging by default.** If your workflow legitimately requires committing a file that pattern-matches credentials (e.g., a test fixture named `credentials.json`), expect CC to warn and require explicit confirmation rather than staging it silently.

8. **CLAUDE.md cannot override the tool-denial circumvention constraint.** If a tool is denied, no instruction — including CLAUDE.md — can instruct CC to achieve the same outcome through a deceptive workaround. CC will surface the denial to you instead.

9. **Commit message style is inferred from repo history by default.** If your project has inconsistent commit history, CC may infer an inconsistent style. A CLAUDE.md entry specifying the commit format is an effective way to make this deterministic.

10. **Version-specific note:** The autonomous loop's scheduled-task telemetry (`tengu_scheduled_task_missed`) and the background worker memory management behaviors (prewarm, low-memory retirement) are v2.1.183-specific instrumentation points. Behavior around loop timing and worker lifecycle may differ in earlier or later versions.

---

## Tool & Permission Layer

The system context encodes a tool permission model that CC uses to evaluate whether a given action should proceed automatically or require user confirmation. Two primary modes govern this: an auto-allow mode (where permitted tools execute without per-use confirmation) and a prompt-to-allow mode (where CC pauses and surfaces the pending action for user approval before executing).

The hook event system is described to CC as a mechanism by which certain lifecycle points in tool execution can trigger external handlers. CC is aware of hook events as part of its operational context and is expected to behave correctly even when hooks are active — this means CC should not assume its tool calls are unobserved or that hook side effects won't occur.

The `<system-reminder>` XML tag is a recognized structural signal in the context layer. Content appearing within this tag is treated as high-priority behavioral guidance injected at runtime, distinct from the base system prompt. The side-question agent architecture uses this tag to communicate role and constraint information to the spawned lightweight instance. CC is instructed to treat these reminders as authoritative operational context.

MCP (Model Context Protocol) servers are integrated into the permission model via a configuration file resolution chain. The system context describes how CC locates MCP configuration (checking plugin manifests, then falling back to default config file locations), how it resolves server endpoints (URL matching, then name matching for dynamic-endpoint servers), and how it presents connection options to users when an MCP server is not yet connected.

Context compression is acknowledged in the system context: when conversation history is compacted, certain behavioral anchors (such as the autonomous loop's full instruction set) are designed to re-expand at the next invocation. The dynamic-mode sentinel mechanism means CC does not need to carry the full loop instruction payload in every turn — it is reconstituted from the bundle at fire time.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.183 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `L` | UI rendering / dashboard JS + background worker memory management logging |
| `s` | SQL keyword / SQLSTATE vocabulary table + side-question agent system-reminder template |
| `l` | PostgreSQL type keyword vocabulary + subagent delegation prompt examples (task tool path) |
| `a` | Subagent fork/delegation prompt examples (fork subagent_type path) |
| `E` | Autonomous loop tick instruction block (scheduled invocation guidance) |
| `i` | Subagent prompt writing guidelines (context-briefing policy) |
| `M` | Subtask block property / event constant table |
| `c` | Job block property / event constant table |
| `y` | Pseudoreference code constant table |
| `x` | Numeration and validation rule ID constant table |
| `h` | Dataset event name constant table (dse* / re* / SELECTION_* events) |
| `d` | Daemon config reload telemetry handler (no large strings) |
| `f` | Background dispatch / spare worker telemetry handler (no large strings) |
| `JSt` | Assembler call stub (no large strings, no telemetry) |
| `g` | Assembler call stub (no large strings, no telemetry) |
| `m` | Assembler call stub (no large strings, no telemetry) |
| `u` | Assembler call stub (no large strings, no telemetry) |
| `A` | Assembler call stub (no large strings, no telemetry) |
| `k` | Assembler call stub (no large strings, no telemetry) |
| `w` | Assembler call stub (no large strings, no telemetry) |
| `v` | Assembler call stub (no large strings, no telemetry) |
| `I` | Analytics dashboard HTML/CSS renderer (large-string CSS block) |
| `p` | Extended PostgreSQL SQLSTATE error code vocabulary table |
| `j0o` | Tool denial message + circumvention policy handler |
| `B$p` | Git commit protocol + pull request creation workflow instruction block |
| `Q6r` | Autonomous loop behavioral governance block (stewardship policy, PR maintenance, CI handling) |
| `rJl` | Live documentation URL routing table (canonical CC docs endpoints) |
| `EYl` | Files API reference — Python SDK (beta) |
| `UKl` | MCP discovery, registry search, and plugin config resolution guide |
| `kYl` | Claude API reference — Ruby SDK |