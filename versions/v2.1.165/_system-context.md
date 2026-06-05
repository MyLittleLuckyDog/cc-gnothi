---
type: system-context
command: _system-context
cc_version: "2.1.165"
updated: "2026-06-05"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.165 bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v2.1.165 System Context

> Analysis basis: CC v2.1.165 bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

The CC v2.1.165 system context is assembled from multiple cooperating functions that are combined at runtime to form the full system-level instruction layer. It spans several behavioral domains: role declaration and communication style, security and permission policy, autonomous loop operation, tool behavior and browser automation, multi-agent orchestration, and documentation self-awareness. This layer sits above user instructions and CLAUDE.md in the authority hierarchy for hardcoded constraints, but many of its defaults are addressable by user configuration. The system context also embeds live documentation routing logic, enabling CC to self-correct when its training-data knowledge of its own features is stale.

---

## Hardcoded Constraints

- **Tool denial compliance**: When a tool invocation is denied, CC is constrained to seek legitimate alternative tools that naturally accomplish the same goal. It is absolutely prohibited from using indirect capabilities (such as test runners) to execute actions the denial was intended to prevent. If no reasonable workaround exists, CC must halt and explain to the user what it was attempting and why the blocked permission is required, deferring the decision to the user. This constraint is absolute and cannot be overridden by CLAUDE.md.

- **Autonomous scope discipline**: In timer-driven or background autonomous operation, CC is prohibited from inventing new work, initiating irreversible changes without explicit prior authorization, or acting outside the scope established by the current conversation transcript. The prohibition on self-directed scope expansion is treated as a trust-preservation constraint, not a soft default.

- **Browser dialog safety**: During browser automation sessions, CC is absolutely prohibited from triggering JavaScript modal dialogs (alerts, confirms, prompts) that would block the browser extension's event loop. This is enforced as a hard constraint rather than a stylistic preference.

- **Browser session tab hygiene**: CC must never reuse tab identifiers from previous or separate sessions. At the start of any browser automation task, it is required to query live tab context before acting. This prevents stale-state corruption and is not user-configurable.

- **Diagnostic non-intervention**: When performing session diagnostics (e.g., investigating frozen processes), CC is prohibited from sending signals to or killing any processes. The constraint is absolute: diagnosis only, no remediation actions.

- **Shell snapshot fallback**: When shell configuration files cannot be located, CC falls back to a default-only snapshot rather than failing silently or fabricating configuration state. The telemetry path for this is instrumented and non-suppressible.

- **Knowledge staleness declaration**: When CC cannot verify a claim about its own features against the live build configuration or reachable documentation, it is required to explicitly state that the answer derives from training data and may be outdated. Silently answering from stale knowledge is prohibited.

---

## Default Behaviors

- **Communication style**: By default, CC leads responses with the outcome or finding, follows with supporting detail, writes in complete sentences, and avoids fragment chains, unexplained abbreviations, or jargon invented during the session. Users can request tighter or more expansive output styles; the default calibrates toward readable rather than maximally brief.

- **Code comment density**: The default is minimal to no inline comments. CC defaults to writing comments only when a constraint cannot be expressed in the code itself, and avoids multi-paragraph docstrings or multi-line comment blocks by default. Users can request higher comment density via CLAUDE.md or inline instruction, but the system default actively resists over-commenting.

- **Intermediate planning documents**: CC defaults to working from conversation context rather than creating planning, analysis, or decision files unless explicitly requested. Users who want persistent plan files should ask explicitly.

- **End-of-turn summary length**: The default end-of-turn summary is one to two sentences covering what changed and what comes next. Users can request more detailed summaries.

- **Autonomous loop scope**: When operating autonomously, CC defaults to prioritizing in-progress pull request maintenance (CI, review threads, merge conflicts) over lower-priority sweep tasks. The prioritization order is configurable via the loop prompt content but the default ranking is embedded in the system context.

- **Repeated autonomous invocation behavior**: After several consecutive iterations finding nothing to act on, CC defaults to scaling back to minimal checking rather than continuing full sweeps. This default cadence reduction is observable behavior that users can override by structuring loop prompts explicitly.

- **Documentation freshness strategy**: CC defaults to checking the live build configuration first, then bundled references, then fetched documentation, before falling back to training data. Users cannot suppress this ordering, but can direct CC to skip certain steps (e.g., "don't fetch docs, just use what you know").

- **GIF recording for browser automation**: During multi-step browser interactions, CC defaults to recording GIF captures for user review. Users can omit this by not requesting multi-step reviews, though the default behavior captures extra frames for smooth playback.

- **Parallel orchestration isolation**: When decomposing large changes into parallel work units, CC defaults to requiring worktree isolation per agent. Users can adjust decomposition granularity via the orchestration prompt but the isolation mode default is set by the system context.

- **SCM branch hygiene in autonomous mode**: When pushing changes autonomously, CC defaults to rebasing rather than merging when the branch has been updated by others. This is a default that reflects the system's embedded preference for clean history, though it can be overridden by explicit user instruction.

---

## CLAUDE.md Redundancy Warning

- **Minimal comment policy**: The system prompt already configures CC to default to sparse inline comments and prohibit multi-line comment blocks. Adding a CLAUDE.md instruction like "don't add unnecessary comments" is redundant. A conflicting instruction such as "always add detailed comments explaining each function" will override the default and may produce comment density the system context was designed to suppress.

- **Outcome-first communication**: The system context already instructs CC to lead with results and avoid narrating its own reasoning process in user-facing output. CLAUDE.md instructions to "be concise" or "lead with the answer" duplicate existing behavior. Instructions that conflict (e.g., "always explain your reasoning step by step before giving the answer") will override this default.

- **No intermediate planning files**: The system context already instructs CC not to create planning or analysis documents unless asked. A CLAUDE.md entry saying "don't create unnecessary files" is redundant. Conversely, a CLAUDE.md entry saying "always write a plan.md before starting" will override the default and cause persistent plan file creation.

- **End-of-turn summary brevity**: The default one-to-two-sentence summary behavior is already embedded. CLAUDE.md instructions requesting brief summaries are neutral duplicates. Instructions requesting longer summaries (e.g., "always end with a full status report") will override the default.

- **Autonomous scope conservatism**: The system context already configures CC to avoid inventing new work during autonomous operation. CLAUDE.md entries such as "don't do things I didn't ask for" are redundant for the autonomous loop context. They are not harmful but add no enforcement beyond what is already hardcoded.

- **Documentation self-check behavior**: The system context already instructs CC to verify its own feature knowledge against live build state before answering questions about CC itself. A CLAUDE.md instruction to "check the docs before answering questions about Claude Code" duplicates this behavior and is neutral.

---

## User Actionable Insights

1. **Tool denial workaround logic is hardcoded and cannot be loosened.** If you deny a tool and CC finds a reasonable alternative, it will use it. If you want to prevent all workarounds for a denied tool, you must deny all plausible alternatives as well, or explicitly instruct CC to stop if the primary tool is unavailable.

2. **Autonomous loop mode has a built-in trust model you cannot disable.** The system context embeds conservatism around scope expansion and irreversible changes as a non-negotiable constraint. If you need CC to take more initiative autonomously, you must encode explicit authorization in the loop prompt itself — the system will treat prompt-level authorization as the highest signal.

3. **Code comment density defaults to near-zero — set your preference explicitly.** If your project requires richer documentation or docstrings, specify this in CLAUDE.md. The system default actively works against comment-heavy output, so without an explicit override you will consistently receive sparse comments.

4. **CC's knowledge of its own features is version-gated and self-aware.** When you ask CC about its own commands, flags, or settings, it will check the live build configuration embedded in the running prompt before answering. This means answers about CC's own behavior are more reliable than answers from training data alone, but only for the features present in the current build.

5. **Browser automation has two absolute constraints worth knowing: no modal dialogs, no stale tab IDs.** If your automation workflow requires confirming a deletion or accepting a browser dialog, CC will warn you and refuse to trigger it autonomously. Plan UI automation flows to avoid dialog-triggering paths, or accept that CC will pause and require manual intervention.

6. **Parallel orchestration workers are isolated by design.** When CC decomposes a large change into parallel agents, each agent operates in its own git worktree. You cannot instruct CC to have workers share state — this isolation is embedded in the orchestration template. Design your work decomposition around independent, mergeable units.

7. **The autonomous loop's "nothing to do" behavior scales back automatically.** After repeated idle invocations, CC reduces sweep scope rather than continuing full checks. If you need sustained full checks even during idle periods, encode that explicitly in your loop prompt rather than relying on the default cadence.

8. **Documentation fetch routing is built into the system context as a URL table.** CC knows exactly where to fetch documentation for each topic area. If you are operating in an air-gapped or network-restricted environment, CC will explicitly declare this limitation rather than silently answering from stale data. Plan for this in offline deployment scenarios.

9. **SCM rebase-over-merge is the autonomous default.** In background mode, CC will rebase rather than merge when it detects upstream changes on a branch. If your project enforces merge commits, add an explicit instruction to your loop prompt or CLAUDE.md to override this behavior.

10. **Version-specific: v2.1.165 embeds a full live documentation URL table.** This table is bundled directly in the system context (not fetched at runtime). If documentation URLs change in a future version, older bundles will route to stale endpoints. This is a version-specific characteristic that will differ in future releases.

---

## Tool & Permission Layer

**Auto-allow vs. prompt-to-allow**: The system context describes a permission model in which tool invocations are categorized at runtime as either auto-allowed (proceeding without user confirmation) or requiring explicit user approval. The boundary between these categories is determined by the tool type, the current permission settings, and any rules defined in CLAUDE.md or the settings files. The system context itself does not expose a way to globally suppress prompting — it instructs CC on how to handle each category once the classification is made.

**Denied tool response protocol**: When a tool call is denied, the system context embeds a specific behavioral protocol: attempt a reasonable alternative if one exists and is not circumventing the denial's intent; if no legitimate alternative exists, stop and explain to the user what was needed and why. This protocol is part of the system context layer and applies regardless of user instruction.

**Hook event integration**: The system context anticipates hook events (such as task notifications from persistent monitors) as first-class wake signals in the autonomous loop. Hook events arriving as structured notification messages are handled within the loop's behavioral logic — they trigger immediate action rather than waiting for the next timer firing. The system context instructs CC on how to maintain the loop's safety net timer after a hook-driven wake.

**MCP server handling**: MCP server configuration and discovery is addressed at the system context level through embedded guidance on registry search, connector suggestion, and configuration file location resolution. The system context distinguishes between servers with static URLs and those with dynamic admin-provided endpoints, and instructs CC on how to handle each case when modifying plugin configuration.

**System-reminder and context injection**: The system context includes reference to a `<system-reminder>` tag mechanism used for injecting contextual updates (such as live build configuration snapshots) into the prompt at invocation time. This is the mechanism by which "Current Build" state is made available to CC at runtime, allowing it to ground answers about its own features in live rather than trained data.

**Context compression awareness**: The system context embeds awareness that conversation context may be compressed or truncated over long sessions. The autonomous loop guidance explicitly accounts for this by instructing CC to re-read the transcript at each invocation rather than assuming continuity from prior state.

**Shell environment snapshotting**: At session initialization, CC attempts to snapshot the user's shell configuration. If the shell config file is absent, a fallback snapshot using CC's own defaults is created. Failures in this process are instrumented via telemetry events. The snapshot is used to establish the shell environment for tool invocations during the session.

---

## Version Notes

| Version | Change |
|---|---|
| v2.1.165 | Initial analysis |

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| OU7 | Shell glob option normalization snippet (extglob/NO_EXTENDED_GLOB suppression) |
| LKq | Shell snapshot assembler with fallback-on-missing-config logic and telemetry instrumentation |
| hH | System context assembler (no large strings; structural combiner) |
| B58 | System context assembler (no large strings; structural combiner) |
| v | System context assembler (no large strings; structural combiner) |
| s6 | System context assembler (no large strings; structural combiner) |
| fKq | System context assembler (no large strings; structural combiner) |
| Wu | System context assembler (no large strings; structural combiner) |
| zKq | System context assembler (no large strings; structural combiner) |
| OKq | System context assembler (no large strings; structural combiner) |
| $Kq | System context assembler (no large strings; structural combiner) |
| qKq | System context assembler (no large strings; structural combiner) |
| vq | System context assembler (no large strings; structural combiner) |
| Px9 | System context assembler (no large strings; structural combiner) |
| eH | System context assembler (no large strings; structural combiner) |
| b08 | System context assembler (no large strings; structural combiner) |
| lj | System context assembler (no large strings; structural combiner) |
| bHA | Tool denial response protocol — behavioral instruction for handling blocked tool calls |
| Vv_ | Autonomous loop behavioral specification — stewardship scope, PR maintenance, idle handling, repeated-invocation scaling |
| bVK | Live documentation URL routing table — topic-to-URL mapping for self-referential doc fetches |
| MZK | Files API reference skill (Python) — upload, use, manage, download patterns |
| $EK | MCP discovery and connection workflow — registry search, connector suggestion, config file resolution |
| A85 | Batch parallel orchestration skill — research/plan/spawn/track phases for large parallelizable changes |
| pVK | Claude Code configuration self-help skill — knowledge staleness protocol, live config priority, answering style |
| vZK | Claude Platform on AWS reference skill — SigV4 auth, workspace ID, first-party API parity notes |
| AA5 | Loop scheduling skill — fixed-interval and dynamic self-paced loop parsing and execution |
| PZK | Claude API Ruby SDK reference skill — messages, streaming, tool use, prompt caching, stop details |
| HQf | Communication and output style guidelines — outcome-first writing, comment policy, response calibration |
| B_5 | Stuck session diagnostic skill — process inspection, state classification, Slack report protocol |
| xTq | Browser automation (Claude in Chrome) skill — GIF recording, console debugging, dialog avoidance, tab hygiene |