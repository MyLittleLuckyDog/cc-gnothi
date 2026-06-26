---
type: feature-spec
feature: "permissions"
cc_version: "2.1.193"
updated: "2026-06-26"
tags: ["permissions", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.193 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/permissions`

> Analysis basis: CC v2.1.193 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.193

---

## Overview

The `/permissions` command (also accessible as `/allowed-tools`) provides an interactive interface for managing the allow and deny rules that govern which tools Claude Code may invoke. It renders a JSX component into the conversation and appends a system-level message to the current message thread so that the permission state is visible and adjustable without leaving the CLI session.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `permissions` |
| description | `Manage allow and deny tool permission rules` |
| aliases | `["allowed-tools"]` |
| module_id | `P9l` |
| load_inline | `true` |
| loc_byte | `12677084` |
| loc_byte_end | `12677256` |
| arbor_handler.name | `yMf` |
| arbor_handler.fqn | `claude-2.1.193::yMf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.193 bundle.js:+12677084

---

## Input Branching

The command follows a two-branch flow: it unconditionally renders the permissions UI component and then appends a system message. Because there are fewer than three distinct branches, numbered pseudocode is used.

1. User invokes `/permissions` (or alias `/allowed-tools`).
2. The handler `permissionsHandler` is called with the current conversation context `ctx`.
3. A JSX permissions-management component is produced via `renderPermissionsUI(ctx)`.
4. A system message of type `"permission_retry"` is appended to the message thread via `ctx.applyMessageOp("append", ...)`.
5. The rendered component and the updated thread are returned to the CLI shell for display.

---

## Behavioral Spec

### Main Handler (`permissionsHandler`)

Analysis basis: CC v2.1.193 bundle.js:+12676913

```
async function permissionsHandler(ctx):
    // Step 1: Render the permissions management UI as a JSX element
    uiElement = renderPermissionsUI(ctx)          // calls renderJSX helper

    // Step 2: Build a system-level permission_retry message
    systemMsg = buildSystemMessage(
        role   = "system",
        type   = "permission_retry",
        id     = generateUUID()                   // crypto.randomUUID
    )

    // Step 3: Append that message to the live conversation thread
    ctx.applyMessageOp("append", systemMsg)

    // Step 4: Return the JSX element so the CLI shell can render it
    return uiElement
```

Analysis basis: CC v2.1.193 bundle.js:+12676956 (applyMessageOp call), +12676979 ("append" literal)

---

### System Message Construction (`buildSystemMessage`)

Analysis basis: CC v2.1.193 bundle.js:+13911937

```
function buildSystemMessage(role, type, id):
    parts = []
    parts.join(", ")                 // separator literal used when serialising
                                     // multiple tool names or rule entries

    msg = {
        role : "system",             // literal at +13911937
        type : "permission_retry",   // literal at +13911954
        level: "info",               // literal at +13912024
        id   : crypto.randomUUID()   // call at +13912081
    }
    return msg
```

Analysis basis: CC v2.1.193 bundle.js:+13911937, +13911954, +13912024, +13912081

---

### UUID Generation helper (`generateUUID`)

Analysis basis: CC v2.1.193 bundle.js:+13912081

```
function generateUUID():
    return crypto.randomUUID()       // CO.randomUUID in bundle
```

The implementation also contains references to `Math.random` (at +14343447) and `setTimeout` (at +14343484) within a utility reached through `buildSystemMessage`'s call chain. These appear to be part of a shared retry/debounce utility rather than core permissions logic. The numeric literals `2` (+14343445) and `1` (+14343461) likely represent retry count and delay multiplier respectively.

<!-- TODO: exact semantics of Math.random / setTimeout in this path not resolvable at depth-2 traversal; needs --depth 4 -->

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal |
| Message thread mutation | Appends one `"system"` / `"permission_retry"` message via `applyMessageOp("append", …)` (bundle.js:+12676956, +12676979) |
| UI rendering | Produces a JSX element (`local-jsx` type) via `renderPermissionsUI` / `O9l.jsx` (bundle.js:+12676913) |
| UUID side-effect | Calls `crypto.randomUUID()` once per invocation to assign an ID to the injected system message (bundle.js:+13912081) |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.193 | Initial analysis |

---

## Common Mistakes

1. **Expecting a plain-text response** — `/permissions` renders an interactive JSX component, not a text summary. Piping or scripting the output may not capture the rendered UI state.
2. **Forgetting the alias** — The command is equally reachable as `/allowed-tools`; both names map to the same handler and produce identical behaviour.
3. **Assuming the command is synchronous** — The handler is an `AsyncFunction`. In automated test harnesses, callers must `await` its resolution before inspecting message thread state.
4. **Expecting telemetry events** — No `tengu_*` telemetry events are fired by this command at the analysed depth; do not rely on telemetry to confirm invocation in observability pipelines.
5. **Treating the injected system message as user-visible dialogue** — The appended `"permission_retry"` message has role `"system"` and level `"info"`; it is infrastructure metadata, not a conversational turn directed at the user.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `yMf` | Main async handler for `/permissions` (`permissionsHandler`) — resolved via `module_id` path through module `P9l` |
| `t` | Conversation context object passed into the handler; exposes `applyMessageOp` |
| `U9l` | System message construction helper (`buildSystemMessage`) — joins tool-name lists and generates UUIDs |
| `e` | Shared retry/debounce utility reached through `U9l`; references `Math.random` and `setTimeout` |
| `O9l` | JSX rendering helper that produces the permissions management UI component |
| `CO` | `crypto` / `globalThis.crypto` namespace used for `randomUUID()` |
| `P9l` | Bundle module containing the `/permissions` command registration and handler |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.