---
type: feature-spec
feature: "agents"
cc_version: "2.1.198"
updated: "2026-07-02"
tags: ["agents", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.198 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/agents`

> Analysis basis: CC v2.1.198 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.198

---

## Overview

The `/agents` command provides access to Claude Code's sub-agent management surface. It allows users to instruct Claude to create or manage subagents, and to directly navigate or edit the `.claude/agents/` directory where agent definitions are stored. The command is resolved through an inlined async handler (`Ptm`) and supports non-interactive execution.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `agents` |
| description | `(removed) Ask Claude to create/manage subagents, or edit .claude/agents/` |
| supportsNonInteractive | `true` |
| load_inline | `true` |
| load_ident | `Ptm` |
| loc_byte | `13084000` |
| loc_byte_end | `13084178` |
| loc_line | `8972` |
| arbor_handler.name | `Ptm` |
| arbor_handler.fqn | `claude-2.1.198::Ptm` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `load_ident` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.198 bundle.js:+13084000

The registration block spans bytes `(13084000, 13084178)`. The handler is inlined via `load: () => Promise.resolve({ call: Ptm })` — no separate `module_id` is used. Arbor resolved the handler through the `load_ident` path with zero additional hits, confirming `Ptm` is the unique entry point.

---

## Input Branching

The call graph for this command is empty (depth-2 traversal returned no edges from `Ptm`), and only two string literals were extracted from the surrounding registration block. The flow is therefore linear with a single documented output shape:

1. The user invokes `/agents` (optionally with trailing arguments).
2. The CLI resolves the handler `Ptm` via the inline `Promise.resolve` load path.
3. `Ptm` executes asynchronously and returns a `text`-typed result payload.
4. The documentation URL `https://code.claude.com/docs/en/sub-agents` is surfaced as part of the response (e.g., embedded in a help or prompt message directed at the agent).
5. Control returns to the CLI shell.

<!-- TODO: internal branching logic of Ptm not found in depth-2 traversal; needs --depth 4 -->

---

## Behavioral Spec

### Handler Resolution

```
async function agentsCommandHandler(userInput, context):
    # Handler is loaded inline; no module boundary is crossed.
    # Resolved by Arbor via load_ident path from registration at byte 13084000.
    result = await subAgentEntryPoint(userInput, context)
    return result
```

Analysis basis: CC v2.1.198 bundle.js:+13084000

### Output Typing

The handler produces a response typed as `"text"` (string literal confirmed at bundle offset).

```
function buildAgentsResponse(content):
    return {
        type: "text",      # literal confirmed: bundle.js:+13083643
        content: content
    }
```

Analysis basis: CC v2.1.198 bundle.js:+13083643

### Documentation Reference

A documentation URL is embedded within the handler's execution context, pointing users or the agent to the official sub-agents reference page.

```
DOCS_URL = "https://code.claude.com/docs/en/sub-agents"
# This URL is referenced at bundle.js:+13083924.
# It is included in the prompt or help surface returned by the handler.
```

Analysis basis: CC v2.1.198 bundle.js:+13083924

### Non-Interactive Support

The registration declares `supportsNonInteractive: true`, meaning the command may be invoked in headless or piped execution contexts (e.g., `claude --no-interactive /agents`) without requiring a TTY.

```
if context.isNonInteractive:
    # Command proceeds normally; no interactive prompt fallback is triggered.
    result = await subAgentEntryPoint(userInput, context)
    return result
```

Analysis basis: CC v2.1.198 bundle.js:+13084000

### Sub-Agent Directory

The description references `.claude/agents/` as the canonical on-disk location for agent definitions. The command may direct the model to read from or write to this path.

```
AGENTS_DIR = ".claude/agents/"
# The handler may instruct Claude to inspect, create, or modify
# YAML/JSON files under this directory representing subagent configurations.
```

<!-- TODO: exact file I/O calls within Ptm not found in depth-2 traversal; needs --depth 4 -->

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal (`telemetry: []`) |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| File system | May read/write files under `.claude/agents/` (inferred from description) |
| Docs URL surfaced | `https://code.claude.com/docs/en/sub-agents` (bundle.js:+13083924) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.198 | Initial analysis |

---

## Common Mistakes

1. **Expecting interactive-only behavior**: Because `supportsNonInteractive: true` is set, callers in CI or scripted pipelines can safely invoke `/agents` without a TTY — no special flag is needed to suppress interactive prompts.
2. **Editing agent files outside `.claude/agents/`**: The command targets the `.claude/agents/` directory specifically. Placing agent definition files elsewhere will not be recognized by the sub-agent system.
3. **Assuming rich telemetry is available**: No `tengu_*` telemetry events were found for this command. Observability tooling that relies on telemetry events from other commands will find no events to consume here.
4. **Treating the call graph as complete**: The depth-2 traversal returned an empty call graph (`callGraph: []`). Internal branching logic inside `Ptm` is not yet characterized and may involve additional sub-steps not documented in this spec.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Ptm` | Async handler function for the `/agents` command; resolved by Arbor via `load_ident` path from the inline `Promise.resolve({ call: Ptm })` registration shape. Entry point for all sub-agent creation and management logic. |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.