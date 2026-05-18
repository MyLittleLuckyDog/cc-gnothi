# Claude Code System Context Analysis Prompt

You are a technical documentation engineer writing a behavioral specification for the system-level
behavioral layer of Claude Code CLI.

## Task

Write a complete behavioral spec for the **CC v{VERSION} system context** — the hardcoded system
prompt sections, behavioral guidelines, and permission policies embedded in the CC bundle.

**DO NOT use any tools.** All data you need is in the JSON block at the end of this prompt.
Written entirely in English.

---

## CRITICAL LICENSE CONSTRAINT

The CC bundle is © Anthropic PBC. The JSON data below contains content extracted for analysis.
You MUST follow these rules — no exceptions:

1. **NEVER reproduce any extracted string content verbatim.** Not even short phrases (3+ words).
2. **Paraphrase and categorize** all behavioral policies: describe what they govern and what they
   imply for users, without quoting the original wording.
3. **Do not write**: "the prompt says...", "the exact wording is...", or "CC states...".
4. **Obfuscated identifiers** (e.g. `_d_`, `$U7`, `OU7`) go ONLY in the Appendix table.
   Never appear in section prose or behavioral descriptions.
5. All output must be in **English**. No Korean.

These constraints protect the license. Any verbatim reproduction renders the spec unlicensable.

---

## Writing Guidelines

### Hardcoded Constraints

List behavioral policies that CC enforces regardless of user instruction or CLAUDE.md content.
For each, write:
- **Category name**: brief description of the controlled domain
- What types of behavior are permitted vs. blocked
- Whether the restriction is absolute or has authorization-based exceptions

Example pattern (do NOT copy this — write fresh from the data):
```
- **Security testing scope**: Differentiates between authorized testing contexts (CTF,
  pentesting engagements, defensive security research) and destructive or mass-targeting
  operations. The former are permitted; the latter are blocked regardless of instruction.
```

### Default Behaviors

List behaviors that CC exhibits by default but that user instructions or CLAUDE.md can influence.
For each: what the default is, what aspect the user can change, and any observed limits.

### CLAUDE.md Redundancy Warning

Identify behavioral areas the system prompt already configures, which users often redundantly
specify in CLAUDE.md. Being in the system prompt does not mean it cannot be overridden — it
means the default is already set. Note:
- Whether the system prompt default matches common CLAUDE.md recommendations
- Whether duplicating it in CLAUDE.md is neutral or potentially conflicting

Example pattern:
```
- **Code quality defaults**: The system prompt already instructs CC to avoid over-engineering,
  unnecessary abstraction, and speculative features. Adding equivalent instructions to CLAUDE.md
  is redundant. Conflicting instructions (e.g., "always add extensive comments") may override
  the default or create instruction conflict.
```

### User Actionable Insights

Concrete takeaways — things a CC user gains from knowing this system context layer exists.
Number each insight. Focus on: what cannot be overridden, what can be tuned, what's version-specific.

---

## Output Format

Print the complete markdown below. Nothing before or after — no preamble, no trailing note.

```
---
type: system-context
command: _system-context
cc_version: "{VERSION}"
updated: "{TODAY}"
tags: ["system-prompt", "behavioral-guidelines", "cc-internals", "claude-md-guidance"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v{VERSION} bundle.js (large-string extraction + paraphrase analysis)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# CC v{VERSION} System Context

> Analysis basis: CC v{VERSION} bundle.js (large-string extraction + behavioral paraphrase)
> This document describes CC's hardcoded system-level behaviors — NOT their exact wording.
> Bundle content is © Anthropic PBC. All behavioral descriptions are paraphrase only.

---

## Overview

[2–4 sentences. Describe how the system context layer is assembled (multiple functions combined),
what categories it covers (security policy, role declaration, tool behavior, task guidance),
and its relationship to user instructions and CLAUDE.md.]

## Hardcoded Constraints

[Bullet list. Each bullet: bold category name + behavioral description. No verbatim quotes.
Cover: security policy, URL generation restriction, output style enforcement, any absolute blocks.]

## Default Behaviors

[Bullet list. Each bullet: bold category name + what the default is + how users can influence it.
Cover: response style, code quality defaults, comment policy, tool confirmation behavior,
git behavior, error handling defaults.]

## CLAUDE.md Redundancy Warning

[Bullet list. Each: bold category + brief note about the overlap and whether duplication is
neutral, redundant, or potentially conflicting. Focus on what users commonly put in CLAUDE.md
that the system prompt already handles.]

## User Actionable Insights

1. [Concrete numbered insights. What users learn, what they can/cannot change, version-specific notes.]

## Tool & Permission Layer

[Describe the tool permission model embedded in the system context: auto-allow vs prompt-to-allow
modes, hook event behavior, MCP server / system-reminder tag handling, context compression notice.
This section covers the "machinery" the system prompt explains to CC itself.]

## Version Notes

| Version | Change |
|---|---|
| v{VERSION} | Initial analysis |

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
[One row per function identifier from systemContextFunctions JSON. Short descriptive role name.]
```

---

## Pre-Extracted AST Data

The JSON below was extracted from CC v{VERSION} bundle via large-string detection (≥500 chars).
Fields:
- `identifier`: obfuscated function name — goes ONLY in the Appendix table
- `byteOffset`: bundle position for citation reference
- `totalStringChars`: total size of large string literals in this function
- `largeStrings[].content`: extracted string content **FOR ANALYSIS ONLY — DO NOT REPRODUCE VERBATIM**
- `largeStrings[].loc_byte`: bundle position for citation
- `telemetryEvents`: tengu_* instrumentation events found

```json
{AST_JSON}
```
