---
type: feature-spec
feature: "workflows"
cc_version: 2.1.183
updated: "2026-06-02"
tags: ["workflows", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: "2.1.146"
analysis_basis: "CC v2.1.146 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/workflows`

> Analysis basis: CC v2.1.146 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.146

---

## Overview

The `/workflows` command opens a workflow history browser within the Claude Code CLI, presenting both currently running and previously completed workflows to the user. It is implemented as a local JSX component rendered through the React-compatible element creation pipeline. Its primary role is to give the user a structured, at-a-glance view of workflow lifecycle state without leaving the CLI session.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `workflows` |
| description | `Browse workflow history (running and completed)` |
| aliases | *(none)* |
| module_id | `mb1` |
| load_inline | `true` |
| loc_byte | `12379665` |
| loc_byte_end | `12379843` |
| arbor_handler.name | `Zc7` |
| arbor_handler.fqn | `claude-2.1.146::Zc7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.146 bundle.js:+12379665

---

## Input Branching

The call graph for `/workflows` contains a single primary call edge — from the handler into the JSX element factory — with no evidence of conditional input branching at depth ≤ 2. A simple linear pseudocode representation is therefore appropriate.

1. User enters `/workflows` in the CLI prompt.
2. CLI routes the command to its registered handler (`Zc7`) via the `load_inline` module path.
3. Handler asynchronously resolves the module `mb1` and invokes `Zc7`.
4. `Zc7` calls `sl_.createElement(...)` to construct a JSX component tree representing the workflow history view.
5. The rendered component is returned to the CLI rendering layer, which displays the workflow list in the terminal UI.

Analysis basis: CC v2.1.146 bundle.js:+12379495

---

## Behavioral Spec

### Workflow History Rendering

The handler is an `AsyncFunction` (Arbor kind: `AsyncFunction`), resolved via the `module_id` path from module `mb1`.

```
async function renderWorkflowHistory(context):
    // Resolve and load the inline module
    module = await resolveModule("mb1")

    // Build the JSX component tree for the workflow browser
    componentTree = createElement(WorkflowHistoryComponent, {
        // Props derived from current session context
        // including running and completed workflow records
    })

    // Return the component tree for terminal rendering
    return componentTree
```

Analysis basis: CC v2.1.146 bundle.js:+12379495 (call to `sl_.createElement`)

The handler constructs a JSX element tree via `sl_.createElement`, which is the React-compatible element factory present in the CC bundle. The component encapsulates both **running** and **completed** workflow entries, consistent with the registered description ("Browse workflow history (running and completed)").

Analysis basis: CC v2.1.146 bundle.js:+12379665

### Module Loading

Because `load_inline` is `true`, the command does not dynamically import a separate chunk at runtime. Instead, the handler (`Zc7`) is already present in the inline bundle under module identifier `mb1` and is resolved synchronously via `Promise.resolve` before the async handler body executes.

```
function resolveHandlerModule():
    // load_inline = true: no dynamic import
    return Promise.resolve({ call: WorkflowHistoryHandler })
```

Analysis basis: CC v2.1.146 bundle.js:+12379665–12379843

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | *(none detected at depth ≤ 2; no `tengu_*` events found)* |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | *(no sound literals found)* |
| JSX render side effect | Calls `sl_.createElement` to produce a terminal UI component tree (bundle.js:+12379495) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.146 | Initial analysis |

---

## Common Mistakes

1. **Expecting shell-level output**: `/workflows` renders an interactive JSX component inside the CLI terminal UI — it does not print plain text lines. Piping or redirecting the output may not capture the rendered view as expected.
2. **Assuming real-time updates**: Based on the depth-2 call graph, the component is constructed once per invocation. Real-time polling or live refresh behavior (if any) would be internal to the `WorkflowHistoryComponent` subtree and is not confirmed at this analysis depth.
3. **Conflating with `/run` or task-dispatch commands**: `/workflows` is a **read-only browser**; it displays workflow history but does not itself launch, cancel, or modify workflows.
4. **Missing async resolution**: Because the handler is `AsyncFunction`, callers or test harnesses that invoke `Zc7` synchronously will not receive the rendered component — they must `await` the result.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Zc7` | Async handler function for `/workflows`; constructs the workflow history JSX component tree (Arbor FQN: `claude-2.1.146::Zc7`, resolved via `module_id` from module `mb1`) |
| `sl_` | React-compatible element factory namespace; `sl_.createElement` is the JSX element creation call reached from `Zc7` (bundle.js:+12379495) |
| `mb1` | Inline module identifier containing the `/workflows` handler; loaded via `load_inline: true` without a separate dynamic import |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.