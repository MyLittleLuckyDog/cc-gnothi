# Claude Code Feature-Spec Analysis Prompt

You are a technical documentation engineer writing verified behavioral specs for Claude Code CLI.

## Task

Write a complete feature-spec for the `/{COMMAND}` slash command in **CC v{VERSION}**.

**DO NOT use any tools.** All data you need is in the JSON block at the end of this prompt.
Written entirely in English.

---

## Source Data

The JSON block below was extracted deterministically from the CC v{VERSION} bundle via AST analysis.
It contains:
- `registration` — exact field values from the command registration object
- `callGraph` — call edges from the command's implementation (depth ≤ 2)
- `telemetry` — all `tengu_*` event strings found in the implementation
- `literals` — string/number constants found in the implementation
- `identifiers` — obfuscated function identifiers reached during traversal
- `_arbor_fallback` (when `true`) — index was built via the Arbor
  tree-sitter fallback (Babel tripped on this bundle). **REQUIRED**: add a
  one-line footnote near the bottom of the spec: "Note: index built via
  Arbor fallback; some signals (telemetry, literals) may be missing — see
  arbor-fallback.js."

The following six fields **MUST appear as rows in the Registration table**
whenever they are present in the input JSON. Do not omit any of them as
"optional" — they are the indexer's primary disambiguation evidence and a
downstream automatic patch backfills missing rows, so omitting them just
loses the LLM-grounded prose you would have written around them.

- `registration.loc_byte_end` — registration object's closing brace
  offset (inclusive). Use `(loc_byte, loc_byte_end)` to cite the full
  registration block.
- `registration.prompt_body` (`prompt`-type only) — actual text the
  command sends to the agent. Add rows for `prompt_body.length` and
  `prompt_body.trace`. Ground the Behavioral Spec in what is really
  instructed. **Never quote verbatim** beyond short citation fragments
  (≤30 chars) — the body is © Anthropic PBC.
- `registration.handler_method` — when set (currently
  `"getPromptForCommand"`), the handler lives inline as an ObjectMethod
  on the registration object. callGraph then starts at the synthetic
  entry `__handler_<command>`; treat it as the command's main handler in
  the Behavioral Spec.
- `registration.load_ident` — when set, the handler ident was inlined
  into a `load:()=>Promise.resolve({call: IDENT})` shape (no `module_id`).
  callGraph entry says `via:"load_ident"`. Reference this ident as the
  handler.
- `registration.dynamic_name: true` — the registration `name` is built
  at runtime (currently the `mcp__` prefix class). Describe the command
  as a **prefix-class** (one entry covering many instantiations), not as
  a single fixed name.
- `registration.arbor_handler` (present when Arbor was available) — the
  unambiguous handler resolved against the Arbor symbol graph. Add rows
  for `arbor_handler.name`, `arbor_handler.kind`,
  `arbor_handler.resolution_path`, `arbor_handler.fqn`, and
  `arbor_handler.n_hits`. Use `arbor_handler.name` in pseudocode and the
  Appendix mapping table.
    - `resolution_path` says how Arbor reached the handler: `direct`
      (symbol fell inside the registration byte range), `module_id`
      (followed module_id → moduleExports → name lookup), `load_ident`
      (followed the inline `Promise.resolve({call:I})` ident).
    - When `arbor_handler` disagrees with `callGraph[0].from` (e.g.
      Arbor says `RZ4` but callGraph starts at the synthetic
      `__handler_<cmd>`), **prefer `arbor_handler`**. The synthetic
      `__handler_*` is BFS bookkeeping, not a real bundle name.

Use these facts as your primary source. Do not guess. If something is not in the data, write
`<!-- TODO: not found in depth-2 traversal; needs --depth 4 -->`.

---

## Writing Rules

1. **NEVER quote bundle code** — any length, any snippet. Bundle is © Anthropic PBC.
2. **Pseudocode only** for algorithms. Write it fresh; do not copy-paste.
3. **Mermaid flowcharts** for branching logic with 3+ paths.
4. **Every behavioral claim** must cite the `loc_byte` from the JSON as:
   `Analysis basis: CC v{VERSION} bundle.js:+{loc_byte}`
5. **Obfuscated identifiers** (`mw8`, `QI7`, etc.) — ONLY in the **Appendix — Identifier Mapping**
   table. Replace every mangled name with a descriptive English name in pseudocode.
6. **Constants and limits**: state as facts with citation. Example:
   "Maximum condition length: 4000 characters (bundle.js:+{loc_byte})"
7. **Language**: all prose, section headings, table headers, and pseudocode in **English**.

---

## Output Format

Print the complete markdown below. Nothing before or after — no preamble, no trailing note.

```
---
type: feature-spec
feature: "{COMMAND}"
cc_version: "{VERSION}"
updated: "{TODAY}"
tags: ["{COMMAND}", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v{VERSION} bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/{COMMAND}`

> Analysis basis: CC v{VERSION} bundle.js (AST extraction + Claude interpretation)
> Minimum version: v{VERSION}

---

## Overview

[1–3 sentences. What this command does and its core mechanism.]

## Registration

| Field | Value |
|---|---|
| type | `...` |
| name | `{COMMAND}` |
| description | ... |
[Add rows for each non-null field in registration JSON]

Analysis basis: CC v{VERSION} bundle.js:+{loc_byte from registration}

## Input Branching

Use the rule below to choose representation:

- **3+ distinct branches** (counted by examining the literals + callGraph
  for separate input cases or state transitions) — **MUST use a Mermaid
  flowchart**. Pseudocode in this case is harder to scan and loses the
  branching shape.
- **1-2 branches or a simple linear flow** — numbered pseudocode is
  acceptable.

```mermaid
flowchart TD
    ...
```

## Behavioral Spec

[Pseudocode per sub-feature. Use descriptive names, not obfuscated IDs.]

### [Sub-feature derived from callGraph]

```
function descriptiveName(input):
    ...
```

Analysis basis: CC v{VERSION} bundle.js:+{loc_byte}

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | [list events from telemetry array] |
| Hook registration | ... |
| appState changes | ... |
| Sound | ... |

## Version History

| Version | Change |
|---|---|
| v{VERSION} | Initial analysis |

## Common Mistakes

1. ...

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
[Row per entry in identifiers array that is obfuscated (short, non-English name)]
```

---

## Pre-Extracted AST Data

```json
{AST_JSON}
```

{PROMPT_BODY}

{ARBOR_CONTEXT}
