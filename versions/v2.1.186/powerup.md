---
type: feature-spec
feature: "powerup"
cc_version: 2.1.186
updated: "2026-06-11"
tags: ["powerup", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.170
analysis_basis: "CC v2.1.170 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/powerup`

> Analysis basis: CC v2.1.170 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.170

---

## Overview

`/powerup` is an interactive lesson command that introduces users to Claude Code features through short, guided discovery experiences. It renders a JSX-based UI component and delivers a system-role message to the agent, with a randomized timing mechanism controlling the pacing of the lesson presentation.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `powerup` |
| description | `Discover Claude Code features through quick interactive lessons` |
| module_id | `u6K` |
| load_inline | `true` |
| loc_byte | `12168575` |
| loc_byte_end | `12168755` |
| arbor_handler.name | `JCf` |
| arbor_handler.fqn | `claude-2.1.170::JCf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.170 bundle.js:+12168575

---

## Input Branching

The handler has a linear flow with one internal branch (randomized delay selection), so numbered pseudocode is appropriate here.

1. User invokes `/powerup`
2. Handler (`JCf`) is resolved via `module_id` → `u6K`
3. A JSX element is created (UI component rendered)
4. A system-role message is dispatched to the agent
5. The timing helper (`H`) is called, which:
   - Draws a random number via `Math.random()`
   - Selects a delay value (either `1` or `2`, numeric constants)
   - Schedules lesson pacing via `setTimeout`
6. The lesson content is delivered to the user

---

## Behavioral Spec

### Main Handler — PowerUp Lesson Launcher

```
async function powerUpHandler(context):
    // Step 1: Render the interactive lesson UI
    element = createElement(LessonUIComponent, props)

    // Step 2: Dispatch a system-scoped message to the agent
    sendMessage(role="system", content=lessonInstructions)

    // Step 3: Invoke the randomized timing scheduler
    scheduleLessonPacing()

    return element
```

Analysis basis: CC v2.1.170 bundle.js:+12168449, +12168484, +12168497

---

### Sub-feature: Randomized Lesson Pacing

The timing helper (resolved from identifier `H`) introduces non-deterministic pacing to the lesson delivery. It uses `Math.random()` to select between two numeric delay constants and then delegates to `setTimeout` to fire the next lesson step.

```
function scheduleLessonPacing():
    // Draw a random float in [0, 1)
    roll = Math.random()

    // Select delay: constants observed are 1 and 2 (units: seconds or ticks)
    if roll satisfies threshold condition:
        delay = 1     // bundle.js:+13939366
    else:
        delay = 2     // bundle.js:+13939350

    // Schedule the next lesson step
    setTimeout(nextLessonStep, delay)
```

- Delay constant `2`: CC v2.1.170 bundle.js:+13939350
- Delay constant `1`: CC v2.1.170 bundle.js:+13939366
- `Math.random` call: CC v2.1.170 bundle.js:+13939352
- `setTimeout` call: CC v2.1.170 bundle.js:+13939389

---

### Sub-feature: System Message Dispatch

The handler emits a message scoped to the `"system"` role (string literal found at bundle.js:+12168497). This causes the lesson instructions to be injected into the agent conversation context as a system-level directive rather than a user-visible turn, keeping the lesson framing authoritative and non-interruptible by the user mid-flow.

```
function dispatchSystemMessage(lessonContent):
    message = {
        role: "system",       // bundle.js:+12168497
        content: lessonContent
    }
    sendToAgent(message)
```

Analysis basis: CC v2.1.170 bundle.js:+12168497

---

### Sub-feature: JSX UI Rendering

The handler calls `YfA.createElement` (the React/Ink JSX factory) to mount an interactive lesson component. Because the command type is `local-jsx`, the rendered element is displayed directly in the CLI terminal UI rather than as plain text output.

```
function renderLessonUI(props):
    return createElement(LessonInteractiveComponent, props)
```

Analysis basis: CC v2.1.170 bundle.js:+12168449

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal (`telemetry: []`) |
| Hook registration | `load_inline: true` — handler is loaded inline via `Promise.resolve({call: JCf})` shape under module `u6K` |
| appState changes | System-role message injected into the agent conversation context |
| UI rendering | JSX element created via `YfA.createElement`; rendered in terminal UI (type: `local-jsx`) |
| Timing side effect | `setTimeout` scheduled by the pacing helper (`H`) with a random delay of `1` or `2` units |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.170 | Initial analysis |

---

## Common Mistakes

1. **Expecting plain-text output**: Because the command type is `local-jsx`, the result is a rendered JSX component in the terminal, not a conversational reply. Callers that scrape stdout for a text response will not find one in the expected format.
2. **Assuming deterministic timing**: The lesson pacing is intentionally randomized via `Math.random()`. Do not rely on a fixed delay between lesson steps in tests or automation scripts.
3. **Confusing the system message with a user turn**: The lesson content is injected as a `"system"` role message, not a `"user"` message. It will not appear as a user chat bubble and cannot be directly replied to by the human in the same turn.
4. **Treating `/powerup` as a one-shot query**: The command is designed as an interactive, multi-step lesson sequence paced by `setTimeout` callbacks — invoking it and immediately exiting the CLI will cut the lesson short.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `JCf` | Main async handler for the `/powerup` command; resolves lesson content, creates JSX element, dispatches system message, and initiates pacing |
| `H` | Randomized lesson-pacing scheduler; calls `Math.random()` and `setTimeout` to control lesson delivery timing |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.