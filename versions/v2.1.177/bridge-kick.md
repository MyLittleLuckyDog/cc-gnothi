```markdown
---
type: feature-spec
feature: "bridge-kick"
cc_version: 2.1.177
updated: "2026-06-11"
tags: ["bridge-kick", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.170
analysis_basis: "CC v2.1.170 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/bridge-kick`

> Analysis basis: CC v2.1.170 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.170

---

## Overview

`/bridge-kick` is a developer/QA-oriented command that injects controlled failures into the Remote Control (bridge) subsystem to exercise error-recovery paths. It accepts a sub-command keyword as its argument and, depending on the chosen fault type, either fires a forced WebSocket close, injects a transient or fatal HTTP error into the poll/register/reconnect cycle, or triggers an immediate reconnect — allowing testers to verify that the bridge's self-healing logic behaves correctly without requiring a real network failure.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `bridge-kick` |
| description | `Inject Remote Control failures for recovery testing` |
| loc_byte | `12771887` |
| loc_byte_end | `12772066` |
| loc_line | `9124` |
| supportsNonInteractive | `false` |
| load_inline | `true` |
| load_ident | `mgf` |
| arbor_handler.name | `mgf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `load_ident` |
| arbor_handler.fqn | `claude-2.1.170::mgf` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.170 bundle.js:+12771887

---

## Input Branching

The handler parses the trimmed argument string and dispatches across seven distinct fault sub-commands plus a fallback "status/help" path — well over three branches, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/bridge-kick [arg]"] --> B{Bridge debug handle registered?}
    B -- No --> ERR["Return error: 'No bridge debug handle registered.\nRemote Control must be connected (USER_TYPE=ant).'"]
    B -- Yes --> C["Trim argument string"]
    C --> D{Argument value?}

    D -- '"close"' --> E["fireClose()\nForce-closes the WebSocket connection"]
    D -- '"poll"' --> F["injectFault('transient', 'pollForWork', 503)\nwakePollLoop()\nReturn success message: transient 503 queued, poll loop woken"]
    D -- '"register"' --> G["injectFault(type, 'registerBridgeEnvironment', 403)\nReturn success message: next register will 403"]
    D -- '"reconnect-session"' --> H["injectFault(type, 'reconnectSession', 404 × 2)\nReturn success: next 2 reconnect POSTs will 404"]
    D -- '"heartbeat"' --> I["injectFault(401, 'heartbeatWork', ...)\nReturn success message"]
    D -- '"reconnect"' --> J["forceReconnect()\nReturn: 'Called reconnectEnvironmentWithSession(). Watch debug.log.'"]
    D -- '"status"' --> K["describe()\nReturn current bridge state summary"]
    D -- other/empty --> K
```

Analysis basis: CC v2.1.170 bundle.js:+12769646 through +12771800

---

## Behavioral Spec

### 1. Guard: Bridge Debug Handle Check

Before any fault is injected, the handler verifies that a bridge debug handle is currently registered. If none is present, it immediately returns a plain-text error message.

```
async function bridgeKickHandler(context):
    debugHandle = getBridgeDebugHandle()         // FfK  — bundle.js:+12769646
    if debugHandle is null or undefined:
        return {
            type: "text",
            text: "No bridge debug handle registered. Remote Control must be connected (USER_TYPE=ant)."
        }                                         // bundle.js:+12769683

    subCommand = context.args.trim()             // bundle.js:+12769782
    dispatch(subCommand, debugHandle)
```

Analysis basis: CC v2.1.170 bundle.js:+12769646

---

### 2. Sub-command: `close`

Triggers an immediate, forced closure of the underlying WebSocket connection, simulating a clean disconnect event.

```
case "close":                                    // bundle.js:+12769818
    debugHandle.fireClose()                      // bundle.js:+12769935
    return successMessage("WebSocket close fired.")
```

Analysis basis: CC v2.1.170 bundle.js:+12769818, +12769935

---

### 3. Sub-command: `poll`

Queues a transient (axios-rejection-style) fault against the `pollForWork` operation with HTTP status 503, then immediately wakes the poll loop so the injected fault is exercised without waiting for the natural poll interval.

```
case "poll":                                     // bundle.js:+12770049
    debugHandle.injectFault("transient", "pollForWork", 503)
    //                        ↑                   ↑      ↑
    //                    fault kind   target fn  status  bundle.js:+12770064,+12770105,+12770143
    debugHandle.wakePollLoop()                   // bundle.js:+12770157
    return {
        type: "text",
        text: "Next poll will throw a transient (axios rejection). Poll loop woken."
        // bundle.js:+12770193
    }
```

Analysis basis: CC v2.1.170 bundle.js:+12770049

---

### 4. Sub-command: `register`

Injects a `permission_error` (HTTP 403) fault that will fire on the next call to `registerBridgeEnvironment`. Because registration only runs during a connect/reconnect cycle, the message advises the user to trigger a close/reconnect to exercise the path.

```
case "register":                                 // bundle.js:+12770637
    debugHandle.injectFault("permission_error", "registerBridgeEnvironment", 403)
    //                        bundle.js:+12770755              +12770693   +12770741
    return {
        type: "text",
        text: "Next registerBridgeEnvironment will 403. Trigger with close/reconnect."
        // bundle.js:+12770803
    }
```

Analysis basis: CC v2.1.170 bundle.js:+12770637

---

### 5. Sub-command: `reconnect-session`

Injects a `not_found_error` (HTTP 404) fault that will fire on the **next two** `POST /bridge/reconnect` calls. This exercises the doReconnect fallthrough from Strategy 1 to Strategy 2.

```
case "reconnect-session":                        // bundle.js:+12771112
    debugHandle.injectFault("not_found_error", "reconnectSession", 404, count=2)
    //              bundle.js:+12770397             +12771161     +12770393
    return {
        type: "text",
        text: "Next 2 POST /bridge/reconnect calls will 404. doReconnect Strategy 1 falls through to Strategy 2."
        // bundle.js:+12771261
    }
```

Analysis basis: CC v2.1.170 bundle.js:+12771112

---

### 6. Sub-command: `heartbeat`

Injects an `authentication_error` (HTTP 401) fault targeting `heartbeatWork`, causing the next heartbeat operation to fail with an auth error.

```
case "heartbeat":                                // bundle.js:+12771366
    debugHandle.injectFault("authentication_error", "heartbeatWork", 401)
    //              bundle.js:+12770415                +12771429    +12771396
    return successMessage("Next heartbeat will 401.")
```

Analysis basis: CC v2.1.170 bundle.js:+12771366

---

### 7. Sub-command: `reconnect`

Calls `forceReconnect()` directly on the debug handle, which calls `reconnectEnvironmentWithSession()` immediately. The return message instructs the user to watch `debug.log` for the outcome.

```
case "reconnect":                                // bundle.js:+12771643
    debugHandle.forceReconnect()                 // bundle.js:+12771662
    return {
        type: "text",
        text: "Called reconnectEnvironmentWithSession(). Watch debug.log."
        // bundle.js:+12771700
    }
```

Analysis basis: CC v2.1.170 bundle.js:+12771643

---

### 8. Sub-command: `status` (and default/unknown)

When the argument is `"status"` or does not match any known sub-command, the handler calls `describe()` on the debug handle and returns the current bridge state summary.

```
case "status":                                   // bundle.js:+12771766
default:
    summary = debugHandle.describe()             // bundle.js:+12771800
    return { type: "text", text: summary }
```

Analysis basis: CC v2.1.170 bundle.js:+12771766, +12771800

---

### 9. Auxiliary: Random-delay helper (`H`)

A utility reachable from the call graph uses `Math.random()` and `setTimeout()` with constants `2` and `1` to introduce non-deterministic timing offsets. This is used internally by the bridge subsystem rather than being directly triggered by any single sub-command argument.

```
function randomDelay(callback):
    delay = Math.floor(Math.random() * 2) + 1   // bundle.js:+13939350, +13939366
    setTimeout(callback, delay)                  // bundle.js:+13939389
```

Analysis basis: CC v2.1.170 bundle.js:+13939350

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal |
| Bridge debug handle | Read via `getBridgeDebugHandle()` (identifier `FfK`); command is a no-op (returns error) if handle is absent |
| WebSocket state | `fireClose()` causes an immediate connection-close event visible to reconnect logic |
| Fault queue | `injectFault()` modifies internal bridge fault-injection state; faults are one-shot (consumed on next matching call) except the 404×2 reconnect-session case which consumes two calls |
| Poll loop | `wakePollLoop()` interrupts the natural poll timer so the queued fault fires immediately |
| Reconnect cycle | `forceReconnect()` calls `reconnectEnvironmentWithSession()` synchronously; side effects appear in `debug.log` |
| `supportsNonInteractive` | `false` — command must not be invoked in non-interactive/scripted mode |

---

## Version History

| Version | Change |
|---|---|
| v2.1.170 | Initial analysis |

---

## Common Mistakes

1. **Running without an active Remote Control session**: The command requires `USER_TYPE=ant` and an active bridge connection. Invoking it in a standard user session returns the "No bridge debug handle registered" error immediately; no fault is injected.
2. **Expecting persistent faults**: All injected faults (except the 404×2 reconnect-session case) are one-shot — they are consumed by the very next matching bridge operation. Re-injection requires running `/bridge-kick` again.
3. **Forgetting to trigger reconnect after `register`**: The `register` sub-command queues a fault for `registerBridgeEnvironment`, but that function only runs during a connect/reconnect cycle. Users must also issue `/bridge-kick close` (or equivalent) to actually exercise the injected 403.
4. **Using in non-interactive pipelines**: `supportsNonInteractive: false` means the command is rejected in scripted/pipe mode. Use it only in an interactive terminal session.
5. **Confusing `reconnect-session` with `reconnect`**: `reconnect-session` injects faults for the *next two* POST calls to `/bridge/reconnect` but does **not** immediately trigger a reconnect. `reconnect` calls `forceReconnect()` immediately without injecting any fault.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `mgf` | Main async handler for `/bridge-kick`; dispatches to bridge debug sub-commands |
| `FfK` | `getBridgeDebugHandle()` — retrieves the registered bridge debug handle object |
| `H` | Random-delay utility used internally by the bridge subsystem (`Math.random` + `setTimeout`) |
| `_` | Bridge debug handle object; exposes `fireClose`, `injectFault`, `wakePollLoop`, `forceReconnect`, `describe` |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.
```