```
---
type: feature-spec
feature: "extra-usage"
cc_version: 2.1.196
updated: "2026-06-26"
tags: ["extra-usage", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.193
analysis_basis: "CC v2.1.193 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/extra-usage`

> Analysis basis: CC v2.1.193 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.193

---

## Overview

`/extra-usage` is a hidden, deprecated alias command that has been renamed to `/usage-credits`. It is registered as a `local-jsx` command with a JSX-rendered output surface, and its handler delegates immediately to the same underlying implementation used by the canonical `/usage-credits` command. Users encountering this command name should be directed to `/usage-credits` instead.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `extra-usage` |
| description | `"Renamed to /usage-credits"` |
| isHidden | `true` |
| module_id | `sSo` |
| load_inline | `true` |
| loc_byte | `9181297` |
| loc_byte_end | `9181482` |
| loc_line | `3566` |
| arbor_handler.name | `WGp` |
| arbor_handler.fqn | `claude-2.1.193::WGp` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.193 bundle.js:+9181297

---

## Input Branching

The command's handler is a linear async flow with no significant user-input branching; a numbered pseudocode representation is used.

1. Command is invoked (hidden from normal command list).
2. Handler `WGp` is resolved via `module_id` → `sSo`.
3. Handler awaits `Promise.resolve`, then delegates to helper `_jt` and utility `n`.
4. JSX output is composed using `eWn.jsxs` / `eWn.jsx` with a `"column"` layout.
5. Output is returned to the CLI renderer.

---

## Behavioral Spec

### Handler Dispatch (`WGp`)

The primary handler for `/extra-usage` is the async function `WGp`, resolved from module `sSo` via the `module_id` resolution path.

```
async function usageCreditsHandler(context):
    // Immediately resolve — no deferred loading required
    await Promise.resolve()

    // Delegate to the shared usage-display helper
    result = await sharedUsageHelper(context)

    // Apply lowercase normalization via textNormalizer
    normalizedText = textNormalizer(result)

    // Compose JSX output with column layout
    output = jsxComposer.jsxs(
        layout = "column",        // literal: "column" @ bundle.js:+9180448
        children = [
            jsxComposer.jsx(normalizedText)   // @ bundle.js:+9180467
        ]
    )

    return output
```

Analysis basis: CC v2.1.193 bundle.js:+9180307

### Load Stub (`VGp`)

A secondary load-stub function `VGp` handles the inline `Promise.resolve` loading pattern for the command registration.

```
function loadStub(context):
    // Inline load — no external module fetch
    Promise.resolve()

    // Invoke secondary helper oSo
    oSo(context)

    // Invoke utility e, which uses:
    //   - Math.random() with divisor 2  (@ bundle.js:+14343445)
    //   - setTimeout with delay factor 1 (@ bundle.js:+14343461)
    //   - Output type "text"             (@ bundle.js:+9180609)
    e(context)
```

Analysis basis: CC v2.1.193 bundle.js:+9180543

### Text Normalization Helper (`n`)

The utility function `n` applies lowercase normalization to the display string.

```
function textNormalizer(input):
    return input.toLowerCase()   // @ bundle.js:+17511154
    // Maximum column width applied: 40 characters (bundle.js:+17511228)
```

Analysis basis: CC v2.1.193 bundle.js:+17511154

### Stream / Connection Lifecycle (`i`, `r`, `s`)

The handler participates in a connection-lifecycle pattern shared across JSX-rendering commands.

```
function connectionLifecycle(streamHandle, registry):
    // Close both primary (index 0) and secondary streams on completion
    streamHandle.close()    // @ bundle.js:+17495264
    registry.close()        // @ bundle.js:+17495274

    // Registry operations:
    //   registry.add(item)     — register active stream  (@ bundle.js:+17488421)
    //   streamHandle.finally() — attach cleanup callback (@ bundle.js:+17488430)
    //   registry.delete(item)  — deregister on teardown  (@ bundle.js:+17488444)

function dataReader(source):
    // Read from "data" channel  (@ bundle.js:+17378420)
    chunk = source.read("data")
    // Internal buffer size: 1024 bytes (bundle.js:+17378473)
    return chunk
```

Analysis basis: CC v2.1.193 bundle.js:+17495262

### Error / Exit Handler (`Is`)

```
function exitHandler(code):
    // Emit CLI error event via lKe  (@ bundle.js:+13300644)
    lKe("cli_error")               // literal "cli_error" @ bundle.js:+13300654

    // Record error via OT          (@ bundle.js:+13300651)
    OT(code)

    // Terminate process
    process.exit(code)             // @ bundle.js:+13300667
```

Analysis basis: CC v2.1.193 bundle.js:+13300644

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal (`telemetry: []`) |
| isHidden | `true` — command does not appear in the normal `/` command listing |
| JSX rendering | Output composed via `eWn.jsxs` / `eWn.jsx` with `"column"` layout |
| Stream lifecycle | Opens, tracks, and closes a stream handle via registry add/delete/finally pattern |
| Buffer limit | Internal data-reader buffer: 1024 bytes (bundle.js:+17378473) |
| Column width | Display column capped at 40 characters (bundle.js:+17511228) |
| Process exit | Calls `process.exit` on CLI error via `Is` (bundle.js:+13300667) |
| Error event | Emits `"cli_error"` string literal on fatal error (bundle.js:+13300654) |
| Randomized delay | Load stub `VGp` uses `Math.random() / 2 + 1` pattern for jittered `setTimeout` (bundle.js:+14343445, +14343461) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.193 | Initial analysis; command is already in deprecated/hidden state, renamed to `/usage-credits` |

---

## Common Mistakes

1. **Invoking `/extra-usage` directly** — This command is hidden (`isHidden: true`) and its description explicitly states it has been renamed to `/usage-credits`. Users should use `/usage-credits` for current behavior.
2. **Expecting telemetry events** — No telemetry events are fired by this command at depth-2 traversal. Do not rely on this command for usage analytics hooks.
3. **Assuming a simple alias** — While functionally equivalent to `/usage-credits`, the command goes through its own `load_inline` + `module_id` resolution path (`sSo` → `WGp`), meaning any version-specific divergence in `sSo` would affect this command independently.
4. **Overlooking the jittered delay in load** — The load stub `VGp` introduces a small randomized `setTimeout` delay. Automated tooling that expects immediate synchronous load may be affected.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `WGp` | Primary async handler (`usageCreditsHandler`); resolved via `module_id` → `sSo` |
| `VGp` | Load stub function; handles inline `Promise.resolve` registration pattern |
| `oSo` | Secondary helper invoked by load stub `VGp` |
| `_jt` | Shared usage-display helper delegated to by `WGp` |
| `n` | Text normalizer; applies `.toLowerCase()` and column-width enforcement |
| `i` | Stream handle; participates in connection lifecycle (close, finally) |
| `r` | Stream registry; tracks active streams (add, delete, close) |
| `s` | Registry-operation helper; coordinates `r.add`, `i.finally`, `r.delete` |
| `Is` | Exit/error handler; emits `"cli_error"`, calls `process.exit` |
| `lKe` | CLI error event emitter invoked by `Is` |
| `OT` | Error recorder invoked by `Is` |
| `eWn` | JSX runtime reference (provides `.jsx` and `.jsxs`) |
| `e` | Utility function using `Math.random` + `setTimeout` for jittered delay |
```