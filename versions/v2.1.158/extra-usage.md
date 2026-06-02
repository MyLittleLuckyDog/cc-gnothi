```
---
type: feature-spec
feature: "extra-usage"
cc_version: "2.1.158"
updated: "2026-06-02"
tags: ["extra-usage", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: "2.1.144"
analysis_basis: "CC v2.1.144 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/extra-usage`

> Analysis basis: CC v2.1.144 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.144

---

## Overview

`/extra-usage` is a hidden, deprecated alias that was renamed to `/usage-credits`. It is registered as a `local-jsx` command and remains present in the bundle solely to preserve backward compatibility; its active implementation delegates to the same underlying handler used by `/usage-credits`. No telemetry events are emitted by this command.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `extra-usage` |
| description | `"Renamed to /usage-credits"` |
| isHidden | `true` |
| module_id | `hI_` |
| load_inline | `true` |
| loc_byte | `8492919` |
| loc_byte_end | `8493104` |
| loc_line | `2762` |
| arbor_handler.name | `jo4` |
| arbor_handler.fqn | `claude-2.1.144::jo4` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.144 bundle.js:+8492919

---

## Input Branching

The command has a straightforward linear flow with no user-facing input branching (the command accepts no arguments and delegates immediately to the usage-credits handler). A simple numbered pseudocode representation is used.

1. User invokes `/extra-usage` in the CLI.
2. The CLI runtime resolves the command registration at byte range `(8492919, 8493104)`, identifies the hidden flag, and loads module `hI_` inline.
3. Control passes to the async handler (`jo4`) via the `module_id` resolution path.
4. The handler resolves a promise, invokes the UI renderer (`Fj6`) for the usage/credits display, and calls the shared helper (`asyncHelper`) for deferred work.
5. The rendered output is returned as a `"column"`-layout JSX node (layout literal at bundle.js:+8492059) containing `"text"`-typed content (literal at bundle.js:+8492218).

---

## Behavioral Spec

### Command Registration & Dispatch

The registration block (bytes 8492919–8493104) marks the command as hidden (`isHidden: true`), which suppresses it from the autocomplete help list and visible command palette. The description field explicitly states the rename, serving as an internal breadcrumb for bundle maintainers.

```
function resolveExtraUsage():
    registration = lookupCommand("extra-usage")
    assert registration.isHidden == true
    module = inlineLoad(registration.module_id)   // loads "hI_"
    return module.handler
```

Analysis basis: CC v2.1.144 bundle.js:+8492919

---

### Primary Handler (jo4 / usageCreditsHandler)

The Arbor-resolved handler `jo4` is an `AsyncFunction` reached via the `module_id` resolution path. It mirrors the `/usage-credits` handler path. The depth-2 call graph shows three direct callees from `jo4`:

1. **`Promise.resolve`** — immediately resolves any async preconditions before rendering (bundle.js:+8491901).
2. **`usageRenderer` (`Fj6`)** — the JSX rendering function responsible for producing the usage/credits UI component (bundle.js:+8491931).
3. **`asyncHelper` (`A`)** — a shared utility that normalises its input via a `toLowerCase` call (bundle.js:+8491951 → 14567299) and performs string canonicalisation up to a column width of 40 characters (literal at bundle.js:+14567373).

```
async function usageCreditsHandler(context):
    await Promise.resolve()                          // settle microtask queue
    uiNode = usageRenderer(context)                  // build JSX column layout
    result = await asyncHelper(uiNode)               // normalise + display
    return result
```

Analysis basis: CC v2.1.144 bundle.js:+8491901, +8491931, +8491951

---

### Loader Shim (Xo4 / loaderShim)

A secondary function `Xo4` appears in the call graph as a loader shim (bundle.js:+8492152). It also calls `Promise.resolve`, then delegates to `yI_` (bundle.js:+8492182) and the same `asyncHelper` (`H`) (bundle.js:+8492202). This shim is responsible for the `load_inline` module resolution pattern — it wraps the real handler inside a promise chain so the CLI's dynamic import infrastructure can treat it uniformly.

```
function loaderShim():
    return Promise.resolve()
        .then(() => inlineModuleExports(yI_))
        .then((exports) => asyncHelper(exports))
```

Analysis basis: CC v2.1.144 bundle.js:+8492152, +8492182, +8492202

---

### Shared Async Helper (H / asyncHelper)

The helper reachable from both `jo4` and `Xo4` (identified as `H` in the call graph) uses `Math.random` (bundle.js:+12668351) gated with numeric literals `2` (bundle.js:+12668349) and `1` (bundle.js:+12668365) to introduce a short non-deterministic delay via `setTimeout` (bundle.js:+12668388). This is a common jitter pattern used in CC to stagger concurrent UI updates and avoid render collisions.

```
function asyncHelper(payload):
    jitter = Math.floor(Math.random() * 2) + 1   // 1 or 2 ms
    return new Promise(resolve =>
        setTimeout(() => resolve(payload), jitter)
    )
```

Analysis basis: CC v2.1.144 bundle.js:+12668349, +12668351, +12668365, +12668388

---

### File-Handle Cleanup (f / q / L)

Deeper in the call graph, the file-descriptor management cluster (`f`, `q`, `L`) handles cleanup of any temporary resources opened during the usage data fetch:

- `fileCloseManager` (`f`) calls `A.close` (bundle.js:+14552828) and `q.close` (bundle.js:+14552838) with initial value `0` (bundle.js:+14552826), then delegates to `trackingSetManager` (`L`) (bundle.js:+14552978).
- `tempFileRegistry` (`q`) calls `t_K.unlinkSync` (bundle.js:+14520889) to remove any temporary files.
- `trackingSetManager` (`L`) maintains an in-flight set: adds the handle (`q.add`, bundle.js:+14546613), registers a `finally` cleanup (`f.finally`, bundle.js:+14546622), and removes the handle on completion (`q.delete`, bundle.js:+14546636).

```
function fileCloseManager(handle):
    handle.close(0)          // close file descriptor A
    tempFileRegistry.close(0)  // close associated temp file
    trackingSetManager(handle)

function tempFileRegistry(path):
    fs.unlinkSync(path)      // delete temp file synchronously

function trackingSetManager(handle):
    inFlightSet.add(handle)
    try:
        return fileCloseManager.finally(() => inFlightSet.delete(handle))
    finally:
        inFlightSet.delete(handle)
```

Analysis basis: CC v2.1.144 bundle.js:+14520889, +14546613, +14546622, +14546636, +14552826, +14552828, +14552838, +14552978

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None — `telemetry` array is empty; no `tengu_*` events are emitted by this command. |
| Hook registration | Command is registered as `local-jsx` with `isHidden: true`; it does not appear in the autocomplete palette or `/help` output. |
| appState changes | No direct appState mutations observed in depth-2 traversal. The JSX column layout is rendered as a read-only display node. |
| Temporary files | `tempFileRegistry` (`q`) may call `fs.unlinkSync` to clean up temp files created during usage data retrieval (bundle.js:+14520889). |
| Async jitter | A 1–2 ms random delay is introduced via `asyncHelper` to stagger UI rendering (bundle.js:+12668349–12668388). |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Layout constants | Output rendered as a `"column"` layout (bundle.js:+8492059) with `"text"`-type content nodes (bundle.js:+8492218); column width truncated at 40 characters (bundle.js:+14567373). |

---

## Version History

| Version | Change |
|---|---|
| v2.1.144 | Initial analysis. Command exists as a hidden deprecated alias for `/usage-credits`; `isHidden: true`, no telemetry. |

---

## Common Mistakes

1. **Invoking `/extra-usage` expecting parity with `/usage`** — this command is specifically an alias for `/usage-credits`, not the general `/usage` command. If the intent is to view token or cost usage, prefer `/usage-credits` directly.
2. **Assuming the command is user-facing** — `isHidden: true` means it will not appear in autocomplete, help listings, or the command palette. It can only be invoked by typing it explicitly.
3. **Expecting telemetry coverage** — unlike most active commands, `/extra-usage` emits zero telemetry events. Debugging via event logs will yield no signal from this command.
4. **Treating `Xo4` as the primary handler** — the loader shim (`Xo4`) is BFS bookkeeping infrastructure for the `load_inline` pattern. The true async handler is `jo4` (Arbor-resolved, `fqn: claude-2.1.144::jo4`).
5. **Overlooking the jitter delay** — the 1–2 ms `Math.random`-based `setTimeout` in `asyncHelper` (`H`) is intentional and not a bug; it prevents concurrent render collisions when multiple commands resolve simultaneously.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Xo4` | Loader shim — wraps the real handler for the `load_inline` dynamic import pattern |
| `H` | Async jitter helper — introduces a 1–2 ms random delay via `Math.random` + `setTimeout` |
| `jo4` | Primary async handler for `/extra-usage` (Arbor-resolved; mirrors `/usage-credits` logic) |
| `A` | String normalisation utility — calls `toLowerCase` and enforces a 40-character column width |
| `f` | File-close manager — closes open file descriptors and delegates to the tracking set manager |
| `q` | Temp-file registry — calls `fs.unlinkSync` to remove temporary files |
| `L` | Tracking set manager — maintains an in-flight handle set with `add`/`delete` lifecycle |
| `yI_` | Inline module export target reached from loader shim `Xo4` |
| `Fj6` | JSX usage/credits UI renderer invoked by the primary handler |
| `hI_` | Module ID for the `extra-usage` / `usage-credits` inline module |
| `t_K` | Node.js `fs`-like module providing `unlinkSync` for temp-file deletion |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.
```