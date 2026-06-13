---
type: feature-spec
feature: "extra-usage"
cc_version: 2.1.176
updated: "2026-06-11"
tags: ["extra-usage", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.170
analysis_basis: "CC v2.1.170 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/extra-usage`

> Analysis basis: CC v2.1.170 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.170

---

## Overview

`/extra-usage` is a hidden legacy alias that has been renamed to `/usage-credits`. When invoked, it delegates to the same handler used by the canonical `/usage-credits` command, rendering a JSX-based credits/usage display. Because the command is marked `isHidden: true`, it does not appear in the visible command palette but remains callable for backwards compatibility.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `extra-usage` |
| description | `"Renamed to /usage-credits"` |
| isHidden | `true` |
| module_id | `qHA` |
| load_inline | `true` |
| loc_byte | `9595830` |
| loc_byte_end | `9596015` |
| loc_line | `4123` |
| arbor_handler.name | `y4f` |
| arbor_handler.fqn | `claude-2.1.170::y4f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.170 bundle.js:+9595830

---

## Input Branching

The command's flow has two distinct top-level paths (command entry → handler dispatch, and the underlying display rendering), making numbered pseudocode the appropriate representation.

1. CLI receives `/extra-usage`.
2. Command registry resolves the name to module `qHA` via the inline `load` shape.
3. The async handler `y4f` is invoked.
4. `y4f` calls `Promise.resolve`, then invokes `KS6` (usage-data fetcher) and `A` (output formatter/renderer).
5. `A` normalises its input string via `f.toLowerCase` (Analysis basis: CC v2.1.170 bundle.js:+16556490).
6. Output is produced as a `"text"` / `"column"` formatted JSX payload (Analysis basis: CC v2.1.170 bundle.js:+9595144 and +9594985).
7. On any fatal error path, `Y1` is reached, which emits a `"cli_error"` event, calls `process.exit` (Analysis basis: CC v2.1.170 bundle.js:+13231131), and cleans up open handles via `A.close` / `q.close`.

---

## Behavioral Spec

### Handler Dispatch (`y4f`)

```
async function usageCreditsHandler(context):
    resolvedModule = await Promise.resolve(loadModule("qHA"))
    usageData      = await fetchUsageData(resolvedModule)   // KS6
    renderResult   = await renderOutput(usageData)          // A
    return renderResult
```

Analysis basis: CC v2.1.170 bundle.js:+9594827, +9594857, +9594877, +9594886

### Output Rendering (`A`)

```
function renderOutput(data):
    normalised = data.toLowerCase()          // column-width cap: 40 chars
    return formatColumns(normalised, {
        layout: "column",                    // literal at +9594985
        outputKind: "text"                   // literal at +9595144
    })
```

Column width cap: 40 characters (Analysis basis: CC v2.1.170 bundle.js:+16556564).

Analysis basis: CC v2.1.170 bundle.js:+16556490

### Async Task Tracking (`L`)

```
function trackAsyncTask(promise):
    activeTasks.add(promise)                 // q.add  — +16535711
    promise.finally(() =>
        activeTasks.delete(promise)          // q.delete — +16535734
    )
    return promise
```

Buffer/queue size limit: 1024 entries (Analysis basis: CC v2.1.170 bundle.js:+16436118).

Analysis basis: CC v2.1.170 bundle.js:+16535711

### Legacy Alias Entry (`h4f`)

```
async function legacyExtraUsageEntry(context):
    resolvedModule = await Promise.resolve(loadModule(...))   // +9595078
    result         = await delegateToAliasTarget(resolvedModule) // _HA — +9595108
    delayed        = scheduleWithJitter(result)               // H — +9595128
    return delayed
```

`scheduleWithJitter` (identifier `H`) uses `Math.random` scaled between values `1` and `2` as a jitter multiplier, then `setTimeout` to defer execution (Analysis basis: CC v2.1.170 bundle.js:+13939350, +13939366, +13939352, +13939389).

Analysis basis: CC v2.1.170 bundle.js:+9595078

### Error / Shutdown Path (`Y1`)

```
function handleFatalError(err):
    emitEvent("cli_error", err)   // literal "cli_error" at +13231118
    cleanupLogger()               // JpH — +13231108
    flushPendingIO()              // aj  — +13231115
    process.exit(1)               // +13231131
```

Analysis basis: CC v2.1.170 bundle.js:+13231108

### Stream / Handle Cleanup (`f`)

```
function closeStreams():
    if activeStreamCount === 0:        // literal 0 at +16541760
        primaryStream.close()          // A.close — +16541762
        secondaryStream.close()        // q.close — +16541772
    trackAsyncTask(pendingFlush())     // L — +16541912
```

Analysis basis: CC v2.1.170 bundle.js:+16541760

### Data Event Routing (`q`)

```
function routeDataEvent(event):
    if event.type === "data":          // literal "data" at +16436065
        dispatchToSubscribers(event)   // Y1 — +16436075
```

Analysis basis: CC v2.1.170 bundle.js:+16436065

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal |
| Hook registration | Registered as hidden local-jsx command under module `qHA`; load is inline (`load_inline: true`) |
| appState changes | No direct appState mutations observed at this traversal depth |
| Async task set | Active-promise set (`q`) is updated on every async task start and completion via `trackAsyncTask` (L) |
| Stream handles | `primaryStream` and `secondaryStream` are closed when active stream count reaches 0 |
| Process exit | Fatal errors trigger `process.exit` after flushing pending I/O |
| Sound | None detected |

---

## Version History

| Version | Change |
|---|---|
| v2.1.170 | Initial analysis; command marked hidden with description "Renamed to /usage-credits" |

---

## Common Mistakes

1. **Calling `/extra-usage` expecting new behaviour** — the command is a legacy alias. Prefer `/usage-credits` for all current integrations; `/extra-usage` may be removed in a future version without notice.
2. **Assuming the command is discoverable** — `isHidden: true` means it will not appear in `/?` or the interactive command palette; callers must know the name explicitly.
3. **Interpreting the jitter delay as a bug** — `scheduleWithJitter` (H) intentionally introduces a small randomised `setTimeout` delay; this is by design and should not be treated as a hang.
4. **Expecting telemetry events** — no `tengu_*` events were found for this command at depth-2 traversal; do not build monitoring dashboards that depend on per-invocation telemetry from `/extra-usage`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `y4f` | Primary async handler for the usage-credits display (Arbor-resolved, `module_id` path) |
| `h4f` | Legacy alias entry-point function that delegates to the canonical target via `_HA` |
| `H` | Jitter scheduler — wraps a result in a randomised `setTimeout` delay |
| `A` | Output formatter/renderer; normalises strings via `toLowerCase`, formats with column layout |
| `f` | Stream lifecycle manager; closes primary and secondary streams when idle |
| `q` | Active-promise / data-event set; tracks in-flight async tasks and routes data events |
| `Y1` | Fatal-error and process-exit handler; emits `cli_error`, flushes I/O, calls `process.exit` |
| `L` | Async-task tracker; adds promises to the active set and removes them on completion |
| `KS6` | Usage-data fetcher called by `y4f` to retrieve credits/usage information |
| `_HA` | Canonical alias target module called by the legacy entry-point `h4f` |
| `JpH` | Logger cleanup function invoked before process exit |
| `aj` | Pending-I/O flush function invoked before process exit |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.