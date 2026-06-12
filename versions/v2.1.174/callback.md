---
type: feature-spec
feature: "callback"
cc_version: 2.1.174
updated: "2026-06-11"
tags: ["callback", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.170
analysis_basis: "CC v2.1.170 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/callback`

> Analysis basis: CC v2.1.170 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.170

---

## Overview

The `/callback` command is an internal command type used by Claude Code to handle asynchronous callback completions from external or deferred sources. Rather than driving a user-facing interactive flow, it dispatches a mapped result set through a dedicated callback handler, enabling the runtime to resume or finalize in-flight operations initiated by other command types (e.g., `prompt`, `agent`, `http`, `mcp_tool`).

---

## Registration

| Field | Value |
|---|---|
| type | `callback` |
| name | `callback` |
| description | `null` |
| loc_byte | `13529718` |
| loc_byte_end | `13529751` |
| loc_line | `10758` |
| arbor_handler.name | `Dtf` |
| arbor_handler.fqn | `claude-2.1.170::Dtf` |
| arbor_handler.kind | `Function` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.170 bundle.js:+13529718

---

## Input Branching

The handler has three or more distinct behavioral paths determined by the type classification of each mapped input entry and by the stochastic retry path involving `Math.random` and `setTimeout`. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/callback invoked"]) --> B["Map over input collection H\n(bundle.js:+13529331)"]
    B --> C{"Entry type field\n(bundle.js:+13529362)"}
    C -->|"\"command\""| D["Dispatch as command callback\n(bundle.js:+13529362)"]
    C -->|"\"prompt\""| E["Dispatch as prompt callback\n(bundle.js:+12618530)"]
    C -->|"\"agent\""| F["Dispatch as agent callback\n(bundle.js:+12618559)"]
    C -->|"\"http\""| G["Dispatch as HTTP callback\n(bundle.js:+12618587)"]
    C -->|"\"mcp_tool\""| H2["Dispatch as MCP tool callback\n(bundle.js:+12618611)"]
    C -->|"\"callback\""| I["Dispatch as nested callback\n(bundle.js:+12618673)"]
    C -->|"\"unknown\" / unrecognised"| J["Fall through to unknown handler\n(bundle.js:+13529764)"]
    D & E & F & G & H2 & I --> K["Pass to callback executor h$H\n(bundle.js:+13529402)"]
    J --> K
    K --> L{"Retry required?\nMath.random (bundle.js:+13939352)"}
    L -->|"random value triggers delay\n(threshold: 2, weight: 1)"| M["setTimeout — schedule retry\n(bundle.js:+13939389)"]
    L -->|"No retry"| N([Return result])
    M --> N
```

---

## Behavioral Spec

### Top-level Handler: `callbackCommandHandler` (`Dtf`)

Analysis basis: CC v2.1.170 bundle.js:+13529718 (registration block), +13529331 (map call), +13529402 (executor call)

```
function callbackCommandHandler(inputCollection):
    # Map over every entry in the input collection
    # Analysis basis: CC v2.1.170 bundle.js:+13529331
    results = map(inputCollection, entry =>
        classifyAndRoute(entry)
    )
    # Pass routed results to the callback executor
    # Analysis basis: CC v2.1.170 bundle.js:+13529402
    return callbackExecutor(results)
```

### Entry Classification: `classifyAndRoute`

Analysis basis: CC v2.1.170 bundle.js:+13529362, +12618530, +12618559, +12618587, +12618611, +12618673, +13529764

```
function classifyAndRoute(entry):
    switch entry.type:
        case "command":    # bundle.js:+13529362
            return prepareCommandCallback(entry)
        case "prompt":     # bundle.js:+12618530
            return preparePromptCallback(entry)
        case "agent":      # bundle.js:+12618559
            return prepareAgentCallback(entry)
        case "http":       # bundle.js:+12618587
            return prepareHttpCallback(entry)
        case "mcp_tool":   # bundle.js:+12618611
            return prepareMcpToolCallback(entry)
        case "callback":   # bundle.js:+12618673
            return prepareNestedCallback(entry)
        default:           # "unknown" — bundle.js:+13529764
            return prepareUnknownCallback(entry)
```

### Callback Executor: `callbackExecutor` (`h$H`)

Analysis basis: CC v2.1.170 bundle.js:+13529402

```
function callbackExecutor(routedResults):
    # Executes or forwards each routed callback result.
    # Internal implementation details not fully resolvable
    # at depth-2 traversal.
    # <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->
    for each result in routedResults:
        execute(result)
```

### Stochastic Retry Scheduler: `retryScheduler` (`H`)

Analysis basis: CC v2.1.170 bundle.js:+13939350 (constant 2), +13939366 (constant 1), +13939352 (`Math.random`), +13939389 (`setTimeout`)

```
function retryScheduler():
    # Uses Math.random to probabilistically determine retry timing.
    # Numeric constants observed: 2 (bundle.js:+13939350), 1 (bundle.js:+13939366)
    # These likely represent retry multiplier and base delay factor.
    delayFactor = Math.random() * 2   # bundle.js:+13939352 / +13939350
    baseDelay   = 1                   # bundle.js:+13939366

    if retryRequired(delayFactor, baseDelay):
        setTimeout(retryAction, computeDelay(delayFactor, baseDelay))
                                      # bundle.js:+13939389
    else:
        returnImmediately()
```

Numeric constants: multiplier `2` (bundle.js:+13939350), base weight `1` (bundle.js:+13939366).

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal (`telemetry: []`) |
| Hook registration | No hook registration signals found at depth ≤ 2 |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | No sound-related literals or identifiers found |
| Async scheduling | `setTimeout` called conditionally inside retry scheduler `H` (bundle.js:+13939389) |
| Stochastic behaviour | `Math.random` used to gate retry delay (bundle.js:+13939352) |
| `description` field | Explicitly `null`; command is not surfaced to end-users via help text |

---

## Version History

| Version | Change |
|---|---|
| v2.1.170 | Initial analysis |

---

## Common Mistakes

1. **Treating `/callback` as a user-facing command.** Because `description` is `null`, it does not appear in help menus. It is an internal dispatch mechanism, not intended for direct user invocation.
2. **Assuming deterministic completion timing.** The `retryScheduler` (`H`) uses `Math.random` with constants `2` and `1`, so retry delays are non-deterministic. Tests relying on fixed timing will be flaky.
3. **Ignoring the `"unknown"` fallthrough.** Entries whose `type` does not match any of the six known string values (`command`, `prompt`, `agent`, `http`, `mcp_tool`, `callback`) are routed to the unknown handler (bundle.js:+13529764) rather than being dropped or throwing an error.
4. **Confusing the nested `"callback"` type with the command itself.** The string literal `"callback"` at bundle.js:+12618673 is a *type tag* on an individual entry object, distinct from the registration `name` of the command.
5. **Expecting telemetry events.** No `tengu_*` events are emitted by this command's handler at depth ≤ 2; do not rely on telemetry for observability of callback dispatch.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Dtf` | Top-level `/callback` command handler function (registered as `arbor_handler`; resolves direct) |
| `H` | Stochastic retry scheduler — calls `Math.random` and `setTimeout` to gate delayed retries |
| `h$H` | Callback executor — receives mapped/routed results from `Dtf` and performs final dispatch |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.