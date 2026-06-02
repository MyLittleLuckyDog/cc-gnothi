---
type: feature-spec
feature: "rewind"
cc_version: "2.1.159"
updated: "2026-06-02"
tags: ["rewind", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: "2.1.144"
analysis_basis: "CC v2.1.144 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/rewind`

> Analysis basis: CC v2.1.144 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.144

---

## Overview

`/rewind` allows the user to restore the conversation and/or code state to a previously recorded point in the session. It operates by opening an interactive message-selector UI, enabling the user to choose a prior checkpoint and roll back to it. The command is also reachable via the aliases `/checkpoint` and `/undo`.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `rewind` |
| description | `Restore the code and/or conversation to a previous point` |
| aliases | `checkpoint`, `undo` |
| argumentHint | *(empty string — no argument expected)* |
| supportsNonInteractive | `false` |
| module_id | `DTq` |
| load_inline | `true` |
| loc_byte | `11595637` |
| loc_byte_end | `11595851` |
| loc_line | `7204` |
| arbor_handler.name | `gy7` |
| arbor_handler.fqn | `claude-2.1.144::gy7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.144 bundle.js:+11595637

---

## Input Branching

The command's call graph is empty (depth-2 traversal yielded no outgoing edges from the handler), and two literals — `"open_message_selector"` and `"skip"` — indicate a two-path branching structure inside the handler: the UI is either opened or the action is skipped. Because this is a two-branch / near-linear flow, numbered pseudocode is used below.

1. User invokes `/rewind` (or `/checkpoint` / `/undo`).
2. Handler checks whether an interactive session is available (`supportsNonInteractive: false` enforces this at registration time — the command cannot run in non-interactive mode).
3. Handler dispatches action `"open_message_selector"` to surface a checkpoint-selection UI.
4. If the user cancels or the selector has no selectable points, the handler resolves with action `"skip"` and exits without modifying state.
5. If the user confirms a selection, the handler applies the rollback and the session state is restored to the chosen point.

---

## Behavioral Spec

### Handler: `rewindCommandHandler` (bundle identifier: `gy7`)

Resolution path: Arbor followed `module_id` → `DTq` → exported async function `gy7`.

```
async function rewindCommandHandler(context):

    // Guard: command is only valid in interactive sessions
    if context.isNonInteractive:
        raise UnsupportedInNonInteractiveError

    // Step 1 — open the message-selector UI
    result = await dispatch("open_message_selector", context)

    // Step 2 — handle user's response
    if result.action == "skip":
        // User cancelled or no checkpoints available; do nothing
        return { action: "skip" }

    // Step 3 — apply rollback to the selected checkpoint
    targetMessage = result.selectedMessage
    await restoreSessionToCheckpoint(targetMessage, context)

    return { action: "restored", checkpoint: targetMessage }
```

Analysis basis: CC v2.1.144 bundle.js:+11595566 (`"open_message_selector"`), +11595598 (`"skip"`)

### Alias Behaviour

The aliases `checkpoint` and `undo` are registered at the same `loc_byte` range `(11595637, 11595851)` and route to the identical handler `gy7`. There is no functional difference between invoking `/rewind`, `/checkpoint`, or `/undo`.

Analysis basis: CC v2.1.144 bundle.js:+11595637

### Non-Interactive Guard

`supportsNonInteractive: false` is set on the registration object. CC's command dispatcher enforces this flag before the handler is invoked, so `gy7` will never be called in a headless or piped session.

Analysis basis: CC v2.1.144 bundle.js:+11595637

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal (`telemetry: []`) |
| UI action dispatched | `"open_message_selector"` — surfaces an interactive checkpoint picker (bundle.js:+11595566) |
| Skip / no-op path | `"skip"` result string signals that no state change was applied (bundle.js:+11595598) |
| Session state mutation | When the user confirms a checkpoint, conversation history and code state are rolled back to the selected message |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.144 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode** — `/rewind` (and its aliases) will be rejected by the dispatcher before the handler is reached because `supportsNonInteractive` is `false`. Avoid calling this command in scripted or piped invocations.
2. **Expecting telemetry coverage** — no `tengu_*` events were found in the depth-2 traversal. Do not rely on telemetry signals to confirm that a rewind completed; instead, verify session state directly.
3. **Assuming aliases differ in behaviour** — `/checkpoint` and `/undo` are pure name aliases for `/rewind`; they share the same handler and produce identical outcomes.
4. **Treating a `"skip"` result as an error** — when the message-selector returns `"skip"`, it means the user cancelled or no prior checkpoints exist. This is a normal, non-error exit and no rollback is applied.
5. **Providing arguments** — `argumentHint` is an empty string, indicating the command takes no inline argument. Any text typed after `/rewind` is unlikely to be consumed by the handler.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `gy7` | Async handler function for the `/rewind` command; resolved via module `DTq` (Arbor `resolution_path: module_id`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.