---
type: feature-spec
feature: "permissions"
cc_version: 2.1.179
updated: "2026-06-11"
tags: ["permissions", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.170
analysis_basis: "CC v2.1.170 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/permissions`

> Analysis basis: CC v2.1.170 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.170

---

## Overview

The `/permissions` command (also accessible as `/allowed-tools`) provides an interactive interface for managing the allow and deny rules that govern which tools Claude Code may invoke during a session. It renders a JSX component directly in the terminal UI and appends a system-level `permission_retry` message to the conversation state, allowing the agent to re-evaluate pending tool-use requests after the user modifies permission rules.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `permissions` |
| description | `Manage allow and deny tool permission rules` |
| aliases | `["allowed-tools"]` |
| module_id | `P4K` |
| load_inline | `true` |
| loc_byte | `12593338` |
| loc_byte_end | `12593510` |
| arbor_handler.name | `TBf` |
| arbor_handler.fqn | `claude-2.1.170::TBf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.170 bundle.js:+12593338

---

## Input Branching

The command's top-level flow is linear (no argument parsing; it operates on current session state), so numbered pseudocode is appropriate here.

1. User invokes `/permissions` (or `/allowed-tools`).
2. Handler `TBf` is called asynchronously.
3. A JSX element is created via `createElement` (the permissions management UI component).
4. A `permission_retry` system message is appended to the conversation via `applyMessageOp` with operation `"append"`.
5. A new session/correlation ID is generated via `generateMessageId` (`IFq`) for the injected message.
6. The rendered JSX component is returned to the CLI shell for display.

---

## Behavioral Spec

### Main Handler — `TBf` (AsyncFunction)

```
async function permissionsCommandHandler(context):
    // Render the permissions management UI
    uiElement = createElement(PermissionsUIComponent, context)

    // Build a system message signalling a permission retry
    messageId = generateMessageId()   // see IFq below
    systemMessage = {
        role:    "system",
        type:    "permission_retry",
        id:      messageId
    }

    // Append the system message to the active conversation
    applyMessageOp("append", systemMessage, context.conversationState)

    // Return the JSX element for terminal rendering
    return uiElement
```

Analysis basis: CC v2.1.170 bundle.js:+12593156 (createElement call), +12593209 (applyMessageOp call), +12593232 ("append" literal), +12593251 (IFq call)

---

### Message ID Generation — `IFq`

```
function generateMessageId(parts):
    // Concatenate provided string segments with ", " separator
    // (used to build composite identifiers when multiple parts exist)
    combined = parts.join(", ")

    // Generate a cryptographically random UUID as the primary identifier
    uuid = crypto.randomUUID()

    // Log at "info" level for diagnostic tracing
    log("info", uuid)

    return uuid
```

Analysis basis: CC v2.1.170 bundle.js:+10956185 (H.join), +10956192 (", " separator literal), +10956274 (randomUUID call), +10956217 ("info" log level literal), +10956130 ("system" role literal), +10956147 ("permission_retry" type literal)

---

### Jitter / Retry Delay Utility — `H`

```
function computeJitteredDelay(baseDelayMs):
    // Apply a small random jitter multiplier (range: 1 to 2×)
    jitter = 1 + Math.random()   // values in [1, 2)
    delayWithJitter = baseDelayMs * jitter

    // Schedule the delayed callback
    setTimeout(callback, delayWithJitter)
```

The literal values `2` and `1` found at +13939350 and +13939366 respectively correspond to the upper and lower bounds of the jitter multiplier. This utility is reached transitively through `IFq` and is likely used for permission-retry back-off rather than being invoked directly from the command handler.

Analysis basis: CC v2.1.170 bundle.js:+13939350 (literal `2`), +13939366 (literal `1`), +13939352 (Math.random call), +13939389 (setTimeout call)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal |
| Conversation mutation | Appends a `"system"` / `"permission_retry"` message to the active conversation via `applyMessageOp("append", …)` (bundle.js:+12593209, +12593232) |
| Message ID | A new UUID is minted via `crypto.randomUUID()` for each injected system message (bundle.js:+10956274) |
| JSX rendering | Returns a `createElement`-produced component to the CLI shell for in-terminal display (bundle.js:+12593156) |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.170 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/permissions` expecting immediate tool unblocking** — The command appends a `permission_retry` signal to the conversation, but the agent still needs to process that signal before any blocked tool call resumes. There is no synchronous unblock.
2. **Forgetting the `/allowed-tools` alias** — The command is registered under both `permissions` and `allowed-tools`; either form is valid, but documentation or scripts that hard-code only one name may mislead users.
3. **Assuming telemetry is emitted** — No `tengu_*` telemetry events were found in the depth-2 traversal. Downstream dashboards that expect a telemetry ping on permission changes will not receive one from this command path.
4. **Confusing session-scoped rules with project-level config** — `/permissions` manages runtime allow/deny rules for the current session; it does not necessarily persist changes to `settings.json` or `.claude/` project configuration files.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `TBf` | Main async handler for the `/permissions` command; resolved via `module_id` → `P4K` by Arbor |
| `_` | Conversation/message utility namespace; provides `applyMessageOp` used to append the `permission_retry` system message |
| `IFq` | Message ID generator; joins string parts, mints a UUID via `crypto.randomUUID()`, and logs at `"info"` level |
| `H` | Jitter/delay utility; computes a randomised back-off delay using `Math.random()` and `setTimeout` |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.