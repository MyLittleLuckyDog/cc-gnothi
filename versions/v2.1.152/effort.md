---
type: feature-spec
feature: "effort"
cc_version: 2.1.152
updated: "2026-05-19"
tags: ["effort", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.144
analysis_basis: "CC v2.1.144 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/effort`

> Analysis basis: CC v2.1.144 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.144

---

## Overview

The `/effort` command allows users to set the effort level that governs how much compute the underlying model applies to a given task. It accepts one of a fixed set of named levels (`low`, `medium`, `high`, `xhigh`, `max`, or `auto`) and communicates the selection to the thin client via a `control-request` dispatch mechanism rather than executing locally.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `effort` |
| description | `Set effort level for model usage` |
| argumentHint | `[low\|medium\|high\|xhigh\|max\|auto]` |
| thinClientDispatch | `control-request` |
| module_id | `aZq` |

Analysis basis: CC v2.1.144 bundle.js:+11714131

---

## Input Branching

Because the AST traversal returned an empty call graph for module `aZq`, the branching logic below is derived exclusively from the registration fields (`argumentHint`, `thinClientDispatch`, and `type`) extracted at the registration site. No deeper behavioral paths were observable at depth ≤ 2.

```mermaid
flowchart TD
    A([User types /effort]) --> B{Argument provided?}
    B -- No argument --> C[Display usage hint:\n low | medium | high | xhigh | max | auto]
    B -- Argument present --> D{Argument is a valid level?}
    D -- Invalid value --> E[Show error / re-display hint]
    D -- Valid value:\nlow | medium | high | xhigh | max | auto --> F[Package as control-request payload]
    F --> G[Dispatch via thinClientDispatch:\ncontrol-request]
    G --> H([Thin client receives and applies effort level])
```

Analysis basis: CC v2.1.144 bundle.js:+11714131 (registration fields `argumentHint` and `thinClientDispatch`)

---

## Behavioral Spec

### Argument Validation and Dispatch

Because module `aZq` yielded no resolvable entry functions during depth-2 traversal, the pseudocode below is reconstructed from the registration contract. It represents the expected behavior consistent with the `local-jsx` command type and the `thinClientDispatch: "control-request"` field.

```
function handleEffortCommand(rawArgument):

    VALID_LEVELS = ["low", "medium", "high", "xhigh", "max", "auto"]

    normalized = trim(lowercase(rawArgument))

    if normalized is empty:
        display_usage_hint("[low|medium|high|xhigh|max|auto]")
        return

    if normalized not in VALID_LEVELS:
        display_error("Unknown effort level: " + normalized)
        display_usage_hint("[low|medium|high|xhigh|max|auto]")
        return

    payload = build_control_request(
        command  = "effort",
        argument = normalized
    )

    dispatch_to_thin_client(
        channel = "control-request",
        payload = payload
    )
```

Analysis basis: CC v2.1.144 bundle.js:+11714131

> **Note:** The internal implementation body for module `aZq` was not reachable at traversal depth ≤ 2. The pseudocode above reflects the behavioral contract implied by the registration object. Actual validation order, error message text, and payload structure require a deeper traversal.
> <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->

### Thin-Client Dispatch Contract

The `thinClientDispatch` field is set to `"control-request"`, indicating that this command does **not** execute its primary effect in the local CLI process. Instead, it serializes the chosen effort level and forwards it to the connected thin-client host over the `control-request` channel. The thin client is then responsible for applying the effort setting to subsequent model invocations.

Analysis basis: CC v2.1.144 bundle.js:+11714131 (field `thinClientDispatch`)

### Render Type

The command is registered as `local-jsx`, meaning its UI surface (argument hint display, validation feedback) is rendered as a JSX component within the CLI's local React-based terminal UI layer rather than as plain text output.

Analysis basis: CC v2.1.144 bundle.js:+11714131 (field `type`)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected at depth ≤ 2 traversal <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | None detected at depth ≤ 2 traversal <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | Effort level propagated to thin client via `control-request`; local appState mutation not confirmed at depth ≤ 2 <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | None detected |
| Dispatch channel | `control-request` (thin-client side effect) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.144 | Initial analysis; command registered with six effort levels (`low`, `medium`, `high`, `xhigh`, `max`, `auto`) and `thinClientDispatch: "control-request"` |

---

## Common Mistakes

1. **Omitting the argument entirely.** Running `/effort` with no argument does not preserve the current setting; it is expected to display the usage hint and take no action.
2. **Using an unlisted level name.** Values such as `ultra`, `minimal`, or numeric strings (e.g., `3`) are not among the six enumerated valid levels and will likely be rejected. The exact error behavior requires deeper traversal to confirm.
3. **Expecting immediate local effect.** Because dispatch is routed through `control-request` to the thin client, the effort level change takes effect on the thin-client side and may not be reflected instantly in local CLI state.
4. **Case sensitivity.** The argument hint is expressed in lowercase. While normalization to lowercase is the most probable behavior, it is not confirmed by the depth-2 traversal data. Using uppercase (e.g., `HIGH`) may or may not be accepted.
5. **Confusing `/effort` with model selection.** This command controls the compute effort tier applied to requests, not which underlying model is used. Model selection is a separate concern.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|

> No obfuscated identifiers were returned by the depth-2 AST traversal for module `aZq`. If mangled names are needed, re-run extraction with `--depth 4` targeting module `aZq`.
> <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->