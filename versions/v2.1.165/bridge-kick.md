```
---
type: feature-spec
feature: "bridge-kick"
cc_version: "2.1.165"
updated: "2026-06-05"
tags: ["bridge-kick", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.165 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/bridge-kick`

> Analysis basis: CC v2.1.165 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.165

---

## Overview

`/bridge-kick` is a developer/QA-facing diagnostic command that injects synthetic Remote Control failures into the running Claude Code bridge layer for the purpose of recovery testing. It accepts a sub-command argument selecting which failure mode to activate (connection close, transient poll error, registration error, reconnect failure, heartbeat failure, or forced reconnect), then arms the selected fault path so that the next relevant bridge operation will experience the injected failure. The command is only functional when a bridge debug handle is registered, which requires `USER_TYPE=ant` with an active Remote Control connection.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `bridge-kick` |
| description | `Inject Remote Control failures for recovery testing` |
| supportsNonInteractive | `false` |
| load_inline | `true` |
| load_ident | `LRf` |
| loc_byte | `12589437` |
| loc_byte_end | `12589616` |
| loc_line | `9060` |
| arbor_handler.name | `LRf` |
| arbor_handler.fqn | `claude-2.1.165::LRf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `load_ident` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.165 bundle.js:+12589437

---

## Input Branching

The command parses its argument string and branches across **seven distinct paths** (no argument / unrecognized, plus six named fault modes). A Mermaid flowchart is used.

```mermaid
flowchart TD
    START(["/bridge-kick [arg]"]) --> CHECK_HANDLE{Bridge debug\nhandle registered?}
    CHECK_HANDLE -- No --> ERR_NO_HANDLE["Return error:\n'No bridge debug handle\nregistered. Remote Control\nmust be connected\n(USER_TYPE=ant).'"]
    CHECK_HANDLE -- Yes --> PARSE["Trim arg string\nand convert to Number"]
    PARSE --> VALID_NUM{arg is a\nfinite number?}
    VALID_NUM -- No --> MATCH_STRING{Match trimmed\narg string}

    MATCH_STRING -- '"close"' --> CLOSE["fireClose()\nArm connection-close fault"]
    MATCH_STRING -- '"poll" or\n"transient" or\n"pollForWork"' --> POLL["injectFault('transient')\n+ wakePollLoop()\nReturn: next poll throws\ntransient 503"]
    MATCH_STRING -- '"register" or\n"registerBridgeEnvironment"' --> REGISTER["injectFault('fatal')\nReturn: next registerBridge\nwill 403 permission_error"]
    MATCH_STRING -- '"reconnect-session" or\n"reconnectSession"' --> RECONNECT_SESSION["injectFault(...)\nReturn: next 2 POST\n/bridge/reconnect will 404"]
    MATCH_STRING -- '"heartbeat" or\n"heartbeatWork"' --> HEARTBEAT["injectFault(401)\nArm heartbeat fault"]
    MATCH_STRING -- '"reconnect"' --> RECONNECT["forceReconnect()\ncall reconnectEnvironmentWithSession()"]
    MATCH_STRING -- '"status"' --> STATUS["describe()\nReturn current bridge state"]
    MATCH_STRING -- unknown --> UNKNOWN["Return usage/help text\nlisting valid sub-commands"]

    VALID_NUM -- Yes --> NUMERIC["Use numeric value\nas fault code parameter\nfor injectFault()"]
```

Analysis basis: CC v2.1.165 bundle.js:+12587196 through +12589350

---

## Behavioral Spec

### Guard: Bridge Debug Handle Check

Before any fault injection is attempted, the handler checks whether a bridge debug handle is currently registered. If none is present, the command returns immediately with the error message `"No bridge debug handle registered. Remote Control must be connected (USER_TYPE=ant)."` and takes no further action.

```
function bridgeKickHandler(context, argString):
    handle = getBridgeDebugHandle()
    if handle is null or undefined:
        return textResult("No bridge debug handle registered. Remote Control must be connected (USER_TYPE=ant).")

    rawArg = argString.trim()
    numericArg = Number(rawArg)
    ...
```

Analysis basis: CC v2.1.165 bundle.js:+12587196, +12587233

### Argument Parsing

The handler trims the raw argument string and attempts to convert it to a JavaScript `Number`. If the result is a finite number (via `Number.isFinite`), it is used directly as a numeric fault-code parameter. Otherwise, the string form is matched against known sub-command keywords (case-sensitive, with aliases).

```
function parseArgument(rawArg):
    trimmed = rawArg.trim()
    asNum   = Number(trimmed)
    if Number.isFinite(asNum):
        return { kind: "numeric", value: asNum }
    else:
        return { kind: "string", value: trimmed }
```

Analysis basis: CC v2.1.165 bundle.js:+12587332, +12587383, +12587397

### Fault Mode: `close`

When the argument matches `"close"`, the handler calls `fireClose()` on the debug handle, which triggers an immediate simulated connection-close event on the bridge transport layer.

```
function handleClose(handle):
    handle.fireClose()
    return textResult("Bridge close injected.")
```

Analysis basis: CC v2.1.165 bundle.js:+12587368, +12587485

### Fault Mode: `poll` / `transient` / `pollForWork`

When the argument matches any of the aliases `"poll"`, `"transient"`, or `"pollForWork"`, the handler arms the poll loop with a transient HTTP 503 fault and then wakes the poll loop so the fault is exercised on the very next iteration. The confirmation message states: `"Next poll will throw a transient (axios rejection). Poll loop woken."` (bundle.js:+12587743).

```
function handleTransientPollFault(handle):
    handle.injectFault("transient", statusCode=503)
    handle.wakePollLoop()
    return textResult("Next poll will throw a transient (axios rejection). Poll loop woken.")
```

Analysis basis: CC v2.1.165 bundle.js:+12587599, +12587614, +12587633, +12587655, +12587693, +12587707, +12587743

### Fault Mode: `register` / `registerBridgeEnvironment`

When the argument matches `"register"` or `"registerBridgeEnvironment"`, the handler injects a `"fatal"` fault tagged as HTTP 403 / `permission_error` so that the next `registerBridgeEnvironment` call will fail with a permission error. The response instructs the user to trigger the failure via a close/reconnect cycle.

```
function handleRegisterFault(handle):
    handle.injectFault("fatal", statusCode=403, errorType="permission_error")
    return textResult("Next registerBridgeEnvironment will 403. Trigger with close/reconnect.")
```

Analysis basis: CC v2.1.165 bundle.js:+12588187, +12588243, +12588291, +12588305, +12588353

### Fault Mode: `reconnect-session` / `reconnectSession`

When the argument matches `"reconnect-session"` or `"reconnectSession"`, the handler configures the fault injector to make the **next two** POST `/bridge/reconnect` calls return HTTP 404 with `not_found_error`, causing reconnect Strategy 1 to fall through to Strategy 2.

```
function handleReconnectSessionFault(handle):
    handle.injectFault("not_found_error", statusCode=404, count=2, endpoint="reconnectSession")
    return textResult("Next 2 POST /bridge/reconnect calls will 404. doReconnect Strategy 1 falls through to Strategy 2.")
```

Analysis basis: CC v2.1.165 bundle.js:+12587943, +12587947, +12587965, +12588662, +12588711, +12588811

### Fault Mode: `heartbeat` / `heartbeatWork`

When the argument matches `"heartbeat"` or `"heartbeatWork"`, the handler injects an HTTP 401 fault targeted at the heartbeat work path.

```
function handleHeartbeatFault(handle):
    handle.injectFault(statusCode=401, target="heartbeatWork")
    return textResult("Heartbeat fault armed: next heartbeat will receive 401.")
```

Analysis basis: CC v2.1.165 bundle.js:+12588916, +12588946, +12588979

### Fault Mode: `reconnect`

When the argument matches `"reconnect"`, the handler calls `forceReconnect()` on the debug handle, which immediately invokes `reconnectEnvironmentWithSession()`. The confirmation message directs the user to watch `debug.log` for results.

```
function handleForceReconnect(handle):
    handle.forceReconnect()
    return textResult("Called reconnectEnvironmentWithSession(). Watch debug.log.")
```

Analysis basis: CC v2.1.165 bundle.js:+12589193, +12589212, +12589250

### Fault Mode: `status`

When the argument matches `"status"`, the handler calls `describe()` on the debug handle, which returns a structured snapshot of the current bridge connection state.

```
function handleStatus(handle):
    stateDescription = handle.describe()
    return textResult(stateDescription)
```

Analysis basis: CC v2.1.165 bundle.js:+12589316, +12589350

### Numeric Fault Code Path

When the argument parses as a finite number, the numeric value is passed directly to `injectFault()` as the HTTP status code, allowing ad-hoc injection of arbitrary error codes not covered by the named aliases.

```
function handleNumericFault(handle, code):
    handle.injectFault(statusCode=code)
    return textResult("Fault injected with numeric code: " + code)
```

Analysis basis: CC v2.1.165 bundle.js:+12587383, +12587397

### Logging Infrastructure (supporting calls)

The call graph reveals that the handler also reaches a logging/append path (`appendFileLogger`) that writes structured entries to a rotating file log, with file-extension checks (`.txt`, bundle.js:+205021) and a rotation guard based on a size threshold using `Buffer.byteLength`. A separate path resolves a platform-specific directory via `path.dirname` and `path.join`. These are shared infrastructure functions not unique to `/bridge-kick`, but are exercised when the handler emits its result message.

Analysis basis: CC v2.1.165 bundle.js:+205248, +205317, +205376, +205469, +205771

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_sad` (bundle.js:+1010365) — fired via the shared feature-use path reachable through `s6 → c` |
| Bridge debug handle | `fireClose()`, `injectFault()`, `wakePollLoop()`, `forceReconnect()`, or `describe()` are called on the registered debug handle depending on sub-command |
| Fault injector state | Arms one-shot or counted fault conditions on the bridge transport; state is consumed on the next relevant bridge operation |
| Poll loop | `wakePollLoop()` is called immediately after `injectFault("transient")` to ensure the armed fault fires without waiting for the natural poll interval |
| Log file | Append-only write to the debug log file; file rotation may be triggered if the size threshold is exceeded |
| appState changes | No direct appState mutation observed in depth-2 traversal |
| Sound | None observed |
| Hook registration | `zXA.register` is reachable via `j9` (bundle.js:+60323), indicating a hook is registered; likely the standard command lifecycle hook |

---

## Version History

| Version | Change |
|---|---|
| v2.1.165 | Initial analysis |

---

## Common Mistakes

1. **Running without a Remote Control connection**: The command silently returns an error if no bridge debug handle is registered. Ensure `USER_TYPE=ant` is set and that Remote Control is actively connected before invoking `/bridge-kick`.
2. **Expecting immediate failure**: Most fault modes (poll, register, reconnect-session, heartbeat) only *arm* a fault for the next relevant operation — they do not cause an immediate error. You must trigger the relevant bridge action (e.g. a poll cycle, a close/reconnect) to observe the injected failure.
3. **Using wrong aliases**: Sub-command matching is case-sensitive. `"Poll"` or `"CLOSE"` will not match; use exact lowercase forms (`"poll"`, `"close"`, etc.) or the documented camelCase aliases.
4. **Expecting `reconnect-session` to fail more than twice**: The fault injector is armed for exactly 2 POST `/bridge/reconnect` calls. After those two failures are consumed, subsequent reconnect attempts proceed normally.
5. **Confusing `reconnect` (force) with `reconnect-session` (fault)**: `"reconnect"` immediately calls `reconnectEnvironmentWithSession()`, while `"reconnect-session"` arms a future 404 fault — these are distinct operations with different effects.
6. **Using `/bridge-kick` in production**: This command exists for internal recovery testing under `USER_TYPE=ant`. It is not intended for end-user workflows and has no effect in standard user configurations.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `LRf` | Main handler for `/bridge-kick` (AsyncFunction) |
| `$1K` | Bridge debug handle accessor / getter |
| `H` | Bootstrap fetch / HTTP utility module |
| `v` | Log-message formatter / debug writer |
| `icK` | Log level / channel dispatcher |
| `DXA` | Log sink router (routes to output channels) |
| `SH` | JSON serializer wrapper for log entries |
| `_` | Generic utility / context object (used for various method calls) |
| `J4` | Path utility: resolves and normalizes file paths |
| `c2A` | Platform path-segment mapper |
| `q` | File system sync operations (unlinkSync etc.) |
| `A` | File name/path string utility (toLowerCase, lastIndexOf, slice) |
| `ppH` | Structured output writer (wraps `C2A`) |
| `C2A` | Low-level write handler (`H.write`) |
| `acK` | Append-to-log orchestrator (mkdir, appendFile, rotate) |
| `$pH` | Timer-based queue flusher (clearTimeout, setTimeout, setImmediate) |
| `d3H` | Log-record builder (joins fields, calls `a8`, `S6`) |
| `Q6` | Log directory resolver |
| `aL6` | EISDIR-safe directory validator |
| `s2A` | Log file path constructor (`path.join` + `S6`) |
| `a2A` | Log file rotation handler (stat, rename, unlink) |
| `ocK` | Append-file worker (mkdir + appendFile + rotate + size check) |
| `j9` | Command lifecycle hook registrar (`zXA.register`) |
| `e$` | HTTP response body extractor |
| `Gw_` | Header/token parser (split, trim, indexOf, slice) |
| `ZHH` | Cache/store membership check (`c44.has`) |
| `uj` | String sanitizer (replace) |
| `e1` | Model-string parser entry point |
| `D6H` | Model descriptor builder (`x0`, `IqH`, `SA`, `yd`) |
| `x0` | Model identifier extractor |
| `IqH` | Model tier classifier |
| `yd` | Model metadata parser (trim, map, startsWith, includes) |
| `Aq` | Model alias normalizer (toLowerCase, replace, classify) |
| `o0` | Model alias lookup table accessor |
| `_4H` | Model family membership checker |
| `wI` | Opus-plan model resolver (`gM`, `Z5`) |
| `NQH` | Haiku model resolver (`Z5`) |
| `NE` | First-party model resolver (`gM`, `Z5`, `XA`) |
| `SX1` | Sonnet model resolver (delegates to `NE`) |
| `gM` | Provider-type resolver (routes to `XA`) |
| `Pe6` | Rate-limit tier checker (`r1L.includes`) |
| `vQH` | Vendor error mapper (`eH`) |
| `eX` | Extended model-string parser (delegates to `Aq`, `r0`) |
| `r0` | Full model resolution pipeline (`ZA`, `P6H`, `PYH`, `IQH`, `NE`, `z2`, `gM`, `XA`, `Z5`, `wI`) |
| `s6` | Feature-use reporter (fires telemetry via `c`, `P6`) |
| `c` | Telemetry event emitter (`tengu_feature_sad`) |
| `P6` | Telemetry dispatch (`Nu6`) |
| `Nu6` | Core telemetry sink |
```

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.