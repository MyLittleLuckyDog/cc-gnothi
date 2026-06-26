```
---
type: feature-spec
feature: "powerup"
cc_version: "2.1.193"
updated: "2026-06-26"
tags: ["powerup", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.193 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/powerup`

> Analysis basis: CC v2.1.193 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.193

---

## Overview

`/powerup` is an interactive onboarding and discovery command that presents users with quick, guided lessons about Claude Code features. When invoked, it renders a JSX-based interactive UI component and applies a randomised timing mechanism (via `Math.random` and `setTimeout`) to sequence or animate the lesson experience. The command is registered as a `local-jsx` type, meaning its output is rendered directly as a React component tree rather than as plain text.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `powerup` |
| description | `Discover Claude Code features through quick interactive lessons` |
| loc_byte | `12267584` |
| loc_byte_end | `12267764` |
| loc_line | `8214` |
| module_id | `F1l` |
| load_inline | `true` |
| arbor_handler.name | `Svf` |
| arbor_handler.fqn | `claude-2.1.193::Svf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.193 bundle.js:+12267584

---

## Input Branching

The command has a relatively linear dispatch flow, but includes a randomised branching step within the timing helper. Two distinct cases are visible in the call graph (random-based delay selection and the `setTimeout` callback execution), making numbered pseudocode appropriate here.

1. User invokes `/powerup` in the CLI.
2. The CLI resolves the `local-jsx` registration at `module_id` `F1l` and calls the async handler (`Svf`).
3. The handler calls the JSX renderer (`renderPowerupComponent`) to construct the interactive lesson UI.
4. The handler calls the timing utility (`scheduledDelay`) to determine when to progress or animate a lesson step.
5. Inside `scheduledDelay`:
   - Generates a random float via `Math.random()`.
   - Applies arithmetic using constants `2` and `1` (Analysis basis: CC v2.1.193 bundle.js:+14343445, +14343461) to compute a delay value within a defined range.
   - Schedules the next action via `setTimeout` with the computed delay (Analysis basis: CC v2.1.193 bundle.js:+14343484).
6. The rendered JSX component is returned to the CLI shell for display.
7. A `"system"` role context value is passed at some point during construction (Analysis basis: CC v2.1.193 bundle.js:+12267507).

---

## Behavioral Spec

### Handler Dispatch (`Svf`)

The Arbor-resolved handler `Svf` (FQN: `claude-2.1.193::Svf`) is an `AsyncFunction` reached via `module_id` resolution from module `F1l`.

```
async function powerupCommandHandler(context):
    # Step 1: Render the interactive powerup JSX component
    uiElement = renderPowerupComponent(context, role="system")

    # Step 2: Schedule any timed transitions within the lesson UI
    scheduledDelay()

    return uiElement
```

Analysis basis: CC v2.1.193 bundle.js:+12267469, +12267494, +12267507

---

### JSX Component Rendering (`renderPowerupComponent`)

The call edge from `Svf` to the JSX builder (`B1l.jsx`) indicates that the primary visual output is a React/JSX component assembled inline. The `"system"` role literal (Analysis basis: CC v2.1.193 bundle.js:+12267507) suggests the component may pass a system-role message or context object into its props or an internal message structure, possibly to frame the lesson content as a Claude system instruction.

```
function renderPowerupComponent(context, role):
    props = buildProps(context, role=role)
    return JSX_Component(props)
```

Analysis basis: CC v2.1.193 bundle.js:+12267469

---

### Randomised Delay Scheduling (`scheduledDelay`)

The timing utility `e` (mapped to `scheduledDelay` in this spec) uses `Math.random()` combined with integer constants `2` and `1` to produce a bounded random delay. The pattern `Math.random() * 2 + 1` — or an arithmetic variant thereof — is a common idiom for a delay in the range [1, 3) (seconds or a similar time unit), though the exact unit is <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->.

```
function scheduledDelay(callback):
    # Compute a random delay bounded by constants 2 and 1
    delayValue = computeRandomDelay(Math.random(), multiplier=2, offset=1)

    # Schedule the callback after the computed delay
    setTimeout(callback, delayValue)
```

Analysis basis: CC v2.1.193 bundle.js:+14343447, +14343461, +14343484, +14343445

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal (`telemetry: []`) |
| Hook registration | None identified in depth-2 call graph |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Timer side effect | `setTimeout` is scheduled during handler execution (Analysis basis: CC v2.1.193 bundle.js:+14343484) |
| Role context | `"system"` role string is set during component construction (Analysis basis: CC v2.1.193 bundle.js:+12267507) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.193 | Initial analysis |

---

## Common Mistakes

1. **Assuming text output**: `/powerup` is a `local-jsx` command; it renders a React component tree, not plain text. Tooling or tests that expect a plain-text response will not capture its output correctly.
2. **Expecting deterministic timing**: The lesson step sequencing uses `Math.random()` internally, so the pacing of lesson transitions is non-deterministic and will vary between invocations.
3. **Treating it as a prompt command**: `/powerup` has no `prompt_body` and is not a `prompt`-type command. It does not submit a text prompt to the Claude model as its primary action; instead it surfaces a UI-driven feature discovery experience.
4. **Missing the `"system"` role context**: The handler explicitly sets a `"system"` role value during construction. Downstream integrations that inspect message role fields should account for this non-`"user"` role appearing in the output stream.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Svf` | Async handler function for the `/powerup` command; resolved via `module_id` `F1l` (arbor_handler) |
| `e` | Randomised delay scheduling utility; calls `Math.random()` and `setTimeout` to compute and apply a bounded random delay |
```