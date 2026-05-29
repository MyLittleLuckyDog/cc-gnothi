---
type: feature-spec
feature: "memory"
cc_version: 2.1.153
updated: "2026-05-18"
tags: ["memory", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.143
analysis_basis: "CC v2.1.143 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/memory`

> Analysis basis: CC v2.1.143 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.143

---

## Overview

The `/memory` command provides a direct interface for viewing and editing Claude's persistent memory files within the CLI environment. It renders a JSX-based UI component that surfaces memory file contents and editing controls to the user. The command is classified as a local command, meaning its logic and rendering execute entirely on the client side without a round-trip to Anthropic's inference backend.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `memory` |
| description | `Edit Claude memory files` |
| module_id | `i5q` |
| loc_line | `5829` |

Analysis basis: CC v2.1.143 bundle.js:+10611915

---

## Input Branching

The depth-2 call graph for the `/memory` command shows a compact call structure: the command's root handler (`memoryCommandHandler`) calls a configuration or context retrieval function (`getContextOrConfig`), calls a secondary utility function (`bP`), and then invokes React's `createElement` to produce the rendered output. No string/number literals were extracted from the implementation, and no conditional branches were discovered at this traversal depth.

Because fewer than three distinct paths were identified in the call graph, a flowchart is not warranted. The linear execution path is described in pseudocode in the Behavioral Spec section below.

<!-- TODO: not found in depth-2 traversal; needs --depth 4 -->
Full branching logic for sub-actions (e.g., view vs. edit vs. create memory file) was not recovered at depth ≤ 2. Additional traversal depth is required to enumerate all conditional paths.

---

## Behavioral Spec

### Command Entry Point

```
function memoryCommandHandler(commandInput, appContext):
    config = getContextOrConfig(appContext)
    auxiliaryData = resolveAuxiliaryUtility(config)
    uiElement = createElement(MemoryEditorComponent, {
        config: config,
        aux: auxiliaryData,
        input: commandInput
    })
    return uiElement
```

Analysis basis: CC v2.1.143 bundle.js:+10611719, +10611730, +10611735

### Context / Configuration Resolution

The function mapped to `getContextOrConfig` (identifier `XT`) is called as the first operation inside the command handler. Based on its position in the call graph and its role as the first dependency resolved before element creation, it is responsible for reading the current application state or configuration needed to locate and present memory files.

```
function getContextOrConfig(appContext):
    // Retrieves memory-relevant configuration:
    // e.g., memory file paths, project scope, user scope
    return memoryConfig
```

Analysis basis: CC v2.1.143 bundle.js:+10611719

<!-- TODO: not found in depth-2 traversal; needs --depth 4 -->
The exact fields returned by `getContextOrConfig` (such as file paths, memory tiers, or scope flags) were not recoverable at depth ≤ 2.

### Auxiliary Utility Resolution

A second function (`bP`) is called immediately after context resolution and before element creation. Its precise role is not determinable from depth-2 traversal alone.

```
function resolveAuxiliaryUtility(config):
    // Role not fully determined at depth-2 traversal.
    // Likely performs one of:
    //   - file system access for memory file content
    //   - permission or existence checks on memory files
    //   - formatting/parsing of raw memory content
    return auxiliaryData
```

Analysis basis: CC v2.1.143 bundle.js:+10611730

<!-- TODO: not found in depth-2 traversal; needs --depth 4 -->

### JSX Component Rendering

The command returns a JSX element produced by `Gv.createElement` (React's `createElement` bound to the local React instance `Gv`). This is consistent with the `local-jsx` command type declared in registration, confirming that `/memory` renders an interactive UI component rather than emitting plain text output.

```
function renderMemoryUI(config, auxiliaryData, commandInput):
    return createElement(
        MemoryEditorComponent,
        props(config, auxiliaryData, commandInput)
    )
```

Analysis basis: CC v2.1.143 bundle.js:+10611735

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected at depth ≤ 2 traversal. <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | Not detected at depth ≤ 2 traversal. <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | Not determinable at depth ≤ 2 traversal. <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | Not detected at depth ≤ 2 traversal. <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Render type | `local-jsx` — renders a React component in the CLI UI pane; no LLM inference call is made by the command dispatcher itself |
| File I/O | Likely involves reading and/or writing memory files on the local filesystem, inferred from command description ("Edit Claude memory files") and presence of auxiliary utility call prior to rendering |

---

## Version History

| Version | Change |
|---|---|
| v2.1.143 | Initial analysis. Command registered as `local-jsx` type at bundle.js:+10611915 |

---

## Common Mistakes

1. **Assuming `/memory` triggers an LLM call.** The `local-jsx` type means the command is handled entirely on the client. No prompt is sent to Claude's inference API when the command is invoked; it is a local file management UI.
2. **Expecting telemetry confirmation for memory edits.** No `tengu_*` telemetry events were found in the depth-2 traversal. Do not rely on telemetry signals to confirm that a memory file was modified.
3. **Treating the command as stateless.** The command reads configuration and auxiliary data before rendering, implying it depends on existing application state (such as an active project or initialized memory store). Invoking `/memory` in an environment where no memory files have been configured may yield an empty or error state.
4. **Confusing `/memory` with in-context conversation memory.** This command edits persistent memory *files* on disk, not the in-context message history of the current session.
5. **Assuming full behavioral coverage from this spec.** The call graph was traversed to depth ≤ 2 only. Sub-features such as creating new memory entries, deleting entries, scoping to project vs. user memory, and conflict resolution are not covered and require a depth-4 traversal to document fully.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `HP7` | Memory command handler — root function registered as the `/memory` command handler; calls context resolver, auxiliary utility, and React `createElement` |
| `XT` | Context / configuration resolver — first callee inside the command handler; retrieves memory-relevant app state or configuration before rendering |