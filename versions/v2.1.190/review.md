---
type: feature-spec
feature: "review"
cc_version: 2.1.190
updated: "2026-06-23"
tags: ["review", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.186
analysis_basis: "CC v2.1.186 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/review`

> Analysis basis: CC v2.1.186 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.186

---

## Overview

The `/review` command initiates a structured code review of a GitHub pull request identified by PR number. It constructs a prompt that instructs the agent to gather PR metadata and unified diff via the `gh` CLI, then analyze and present findings in a readable format ordered by severity. Unlike `/code-review`, which targets the local working-tree diff, `/review` is scoped exclusively to the remote PR's diff.

---

## Registration

| Field | Value |
|---|---|
| type | `prompt` |
| name | `review` |
| description | `Review a GitHub pull request; for your working diff use /code-review` |
| argumentHint | `[pr number]` |
| handler_method | `getPromptForCommand` |
| handler_method_start (byte) | `12387958` |
| handler_method_end (byte) | `12388116` |
| loc_byte | `12387729` |
| loc_byte_end | `12388117` |
| loc_line | `8249` |
| prompt_body.length | `824` characters |
| prompt_body.trace | `conditional; call→hmf(...) (1 literals); identifier→mmf (unresolved)` |
| arbor_handler.name | `getPromptForCommand` |
| arbor_handler.fqn | `claude-2.1.186::getPromptForCommand` |
| arbor_handler.kind | `Method` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `1` |
| `handler_method_start` | `12387958` |
| `handler_method_end` | `12388116` |

Analysis basis: CC v2.1.186 bundle.js:+12387729

---

## Input Branching

The handler has 3 distinct processing paths depending on argument state: (1) no argument supplied, (2) argument supplied and is a plain PR number, (3) argument supplied and contains characters requiring normalization. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/review invoked"]) --> B{Argument\nprovided?}
    B -- No --> C[PR identifier is empty string\nafter trim]
    B -- Yes --> D["Trim whitespace from argument\n(e.target.trim)"]
    D --> E{Contains characters\nneeding normalization?}
    E -- No --> F[Use trimmed value as PR ref directly]
    E -- Yes --> G["replaceAll: normalize special chars\n(t.replaceAll)"]
    G --> H[Build prompt lines array via formatHelper\n(hmf)]
    F --> H
    C --> H
    H --> I["Join lines into final prompt string\n(n.join)"]
    I --> J[Return prompt body with\ntype: 'text']
    J --> K([Agent receives prompt and begins review])
```

Analysis basis: CC v2.1.186 bundle.js:+12387958 – +12388116

---

## Behavioral Spec

### Prompt Construction (`getPromptForCommand`)

The handler method is resolved via Arbor as `getPromptForCommand`, a direct `Method` on the registration object (resolution_path: `direct`). The synthetic call-graph entry `__handler_review` is BFS bookkeeping; `getPromptForCommand` is the authoritative handler name.

```
function getPromptForCommand(userInput):
    # Step 1: Normalize the raw argument
    rawArg = userInput.trim()                    # e.trim  — strip surrounding whitespace
    normalizedArg = rawArg.replaceAll(...)       # t.replaceAll — sanitize special chars

    # Step 2: Build prompt line array
    promptLines = formatHelper(normalizedArg)    # hmf(...) with 1 literal param

    # Step 3: Assemble final prompt string
    promptText = promptLines.join(...)           # n.join — collapse array into one string

    # Step 4: Return prompt object for agent dispatch
    return { type: "text", content: promptText }
```

Analysis basis: CC v2.1.186 bundle.js:+12387964 (getPromptForCommand call), +12388002 (trim), +12388026 (replaceAll), +12388091 (hmf), +12388097 (join), +12388077 (type literal `"text"`)

---

### Prompt Content and Agent Instructions

The constructed prompt (824 characters total) instructs the agent to perform a multi-phase GitHub PR review. Based on the extracted prompt body:

**Phase 1 — PR identification**

The prompt embeds the user-supplied PR reference (the normalized argument from the handler) as the review target. The agent is directed to treat this as a GitHub pull request identifier.

**Phase 2 — Data gathering via `gh` CLI**

The agent is instructed to fetch PR data using two `gh` sub-commands in order:

1. `gh pr view <PR> --json title,body,author,baseRefName,headRefName,state,additions,deletions,changedFiles,labels` — retrieves structured metadata for context.
2. `gh pr diff <PR>` — retrieves the unified diff that forms the sole review scope.

The prompt explicitly prohibits using any local `git diff` output. Local working-tree changes are declared out of scope.

**Phase 3 — Contextual file reading**

When analysis of a finding requires surrounding code context, the agent is permitted to read files from the local checkout only if the checkout matches the PR's branch; otherwise it must fetch file contents through `gh`.

**Phase 4 — Finding presentation**

After completing its analysis phases (content elided; marked `...` in extraction), the agent must not return a raw JSON findings array. Instead it must present:

- A 2–3 sentence overview of what the PR accomplishes.
- Surviving findings listed most-severe-first, formatted as `file:line — summary (failure scenario)`.
- If no findings survive verification, a note stating so.

Analysis basis: CC v2.1.186 bundle.js:+12387729 (prompt_body start)

---

### Format Helper (`hmf`)

The call-graph shows `__handler_review` calling `hmf` at byte `+12388091`. The `prompt_body.trace` records this as `call→hmf(...) (1 literals)`, meaning `hmf` receives exactly one resolved literal argument alongside the PR reference. Its role is to assemble the prompt lines array that is later joined into the final string.

```
function formatHelper(prRef, literal):
    lines = []
    lines.append(buildHeader(prRef))       # embeds PR identifier into preamble
    lines.append(buildInstructions(literal))  # uses the 1 resolved literal
    return lines
```

Note: the identifier `mmf` referenced in `prompt_body.trace` as `identifier→mmf (unresolved)` could not be resolved within the depth-2 traversal. It likely contributes additional prompt segments.

Analysis basis: CC v2.1.186 bundle.js:+12388091

<!-- TODO: mmf identifier unresolved; needs --depth 4 -->

---

### String Normalization (`t.replaceAll`)

Before the PR reference is embedded in the prompt, it passes through a `replaceAll` call. This prevents injection of characters that could disrupt the prompt template or `gh` CLI argument parsing.

```
function normalizeArg(rawInput):
    trimmed = rawInput.trim()
    safe = trimmed.replaceAll(<pattern>, <replacement>)  # pattern not resolved in depth-2
    return safe
```

Analysis basis: CC v2.1.186 bundle.js:+12388026

---

### Line Joining (`n.join`)

After `hmf` returns the lines array, the handler collapses it into a single string via `n.join`. The separator is not resolved in the depth-2 traversal.

```
function assemblePrompt(lines):
    return lines.join(<separator>)   # separator: <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->
```

Analysis basis: CC v2.1.186 bundle.js:+12388097

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal (telemetry array is empty) |
| Hook registration | None detected in depth-2 traversal |
| appState changes | None detected in depth-2 traversal |
| Sound | None detected in depth-2 traversal |
| `gh` CLI dependency | Agent is instructed to call `gh pr view` and `gh pr diff`; requires `gh` authenticated and in PATH |
| Local filesystem reads | Agent may read files from local checkout when it matches the PR's branch |
| Return type | `{ type: "text", content: <string> }` (literal `"text"` at bundle.js:+12388077) |
| Error path (process.exit) | Depth-2 traversal reaches `process.exit` via `Ts → process.exit` (bundle.js:+13194106); this is in the `cli_error` branch (literal at +13194093), not the normal review path |
| Buffer limit (downstream) | `1024` literal found at bundle.js:+17055094 in the streaming/IO layer reached via deep call edges — possibly a read-buffer size; not directly part of prompt construction |

---

## Version History

| Version | Change |
|---|---|
| v2.1.186 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/review` without a PR number** — the argument is optional in the registration (`argumentHint: [pr number]` uses brackets), but without a PR number the embedded reference in the prompt will be empty, causing the agent to be unable to identify a target. Always supply the PR number: `/review 1234`.
2. **Confusing `/review` with `/code-review`** — `/review` targets a remote GitHub PR (requires `gh` CLI). `/code-review` targets the local working-tree diff. Using the wrong command produces irrelevant output.
3. **Missing or unauthenticated `gh` CLI** — the prompt instructs the agent to run `gh pr view` and `gh pr diff`. If `gh` is not installed or not authenticated, both data-gathering steps will fail silently or with CLI errors.
4. **Expecting raw JSON output** — the prompt explicitly prohibits the agent from returning its internal findings array as raw JSON. The output is always a human-readable review. Downstream tooling that parses JSON from this command's output will break.
5. **Assuming local changes are included** — the review scope is the PR diff only. Uncommitted local changes, staged files, and unstaged modifications are all explicitly out of scope as stated in the prompt.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `__handler_review` | Synthetic BFS entry point for the `/review` handler; maps to `getPromptForCommand` (prefer Arbor name) |
| `e` | Raw user input argument object passed to the handler; `.trim()` is called on it |
| `t` | Trimmed string value of the PR argument; `.replaceAll()` is called on it for normalization |
| `hmf` | Format helper function; builds the prompt lines array from the normalized PR reference and 1 resolved literal |
| `n` | Prompt lines array returned by `hmf`; `.join()` collapses it into the final prompt string; also appears in a separate context where `.toLowerCase()` is called (bundle.js:+17185444) |
| `i` | IO/stream handle used in deeper call edges; `.finally()` called on it for cleanup |
| `r` | Resource/set tracking structure; `.add()` and `.delete()` called for lifecycle management |
| `Ts` | CLI error/exit utility; calls `process.exit` on `cli_error` path (bundle.js:+13194106) |
| `s` | Promise/task wrapper; orchestrates `r.add`, `i.finally`, and `r.delete` in the IO layer |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.