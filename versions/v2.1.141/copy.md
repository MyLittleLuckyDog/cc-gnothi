---
type: feature-spec
feature: "copy"
cc_version: 2.1.141
updated: "2026-05-18"
tags: ["copy", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.139
analysis_basis: "CC v2.1.139 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/copy`

> Analysis basis: CC v2.1.139 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.139

---

## Overview

The `/copy` command copies Claude's most recent response to the system clipboard. An optional numeric argument `N` allows the user to target the Nth-latest response instead of the default (most recent). The command is registered as a `local-jsx` type, meaning its output is rendered locally within the CLI without sending a new request to the model.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `copy` |
| description | `Copy Claude's last response to clipboard (or /copy N for the Nth-latest)` |
| module_id | `o6q` |

Analysis basis: CC v2.1.139 bundle.js:+9949443

---

## Input Branching

The description text establishes two distinct invocation forms. Because the depth-2 call-graph traversal returned no edges for module `o6q`, the branching below is reconstructed solely from the registration description and the known `local-jsx` command contract.

```mermaid
flowchart TD
    A([User types /copy]) --> B{Argument provided?}
    B -- "No argument" --> C[Target index = 1\n(most recent response)]
    B -- "Argument = N\n(positive integer)" --> D[Target index = N\n(Nth-latest response)]
    C --> E[Retrieve response at target index\nfrom conversation history]
    D --> E
    E --> F{Response found\nat target index?}
    F -- "Yes" --> G[Write text content\nto system clipboard]
    F -- "No" --> H[Render local error\nor no-op notification]
    G --> I[Render local confirmation\nmessage via JSX]
    H --> I
    I --> J([Done])
```

<!-- TODO: not found in depth-2 traversal; needs --depth 4 -->
> The exact branching implementation, error message strings, and clipboard API call site could not be confirmed because the AST traversal reported no call-graph edges and no literals for module `o6q`. The flowchart above reflects the behaviorally implied contract from the registration description alone.

---

## Behavioral Spec

### Response Selection

```
function selectTargetResponse(conversationHistory, rawArgument):
    if rawArgument is absent or empty:
        targetIndex = 1
    else:
        targetIndex = parsePositiveInteger(rawArgument)
        if parseFailure or targetIndex < 1:
            return Error("Invalid argument: expected a positive integer")

    assistantResponses = [
        msg for msg in conversationHistory
        if msg.role == "assistant"
    ]

    # Index 1 = most recent, index 2 = second-most-recent, etc.
    reversedResponses = reverse(assistantResponses)

    if targetIndex > length(reversedResponses):
        return Error("No response exists at position " + targetIndex)

    return reversedResponses[targetIndex - 1]
```

<!-- TODO: not found in depth-2 traversal; needs --depth 4 -->
Analysis basis: behavior inferred from registration description CC v2.1.139 bundle.js:+9949443

---

### Clipboard Write

```
function writeToClipboard(responseMessage):
    textContent = extractPlainText(responseMessage)
    systemClipboard.write(textContent)
    return Success
```

<!-- TODO: not found in depth-2 traversal; needs --depth 4 -->
Analysis basis: behavior inferred from registration description CC v2.1.139 bundle.js:+9949443

---

### Local JSX Render

```
function renderCopyResult(outcome):
    if outcome == Success:
        return JSXElement(
            type = "confirmation",
            message = "Copied to clipboard"   # exact string unconfirmed
        )
    else:
        return JSXElement(
            type = "error",
            message = outcome.errorDetail
        )
```

<!-- TODO: not found in depth-2 traversal; needs --depth 4 -->
Analysis basis: `local-jsx` type contract CC v2.1.139 bundle.js:+9949443

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected — telemetry array is empty for module `o6q` |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | No appState mutations confirmed; clipboard write is the sole external side effect |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Clipboard | Writes the plain-text content of the selected assistant response to the OS clipboard |
| Network | None — command is `local-jsx`; no model request is issued |

---

## Version History

| Version | Change |
|---|---|
| v2.1.139 | Initial analysis — registration confirmed; call-graph and literals unavailable due to empty AST traversal result for module `o6q` |

---

## Common Mistakes

1. **Passing a non-integer or zero as `N`** — the argument is expected to be a positive integer (`1`, `2`, …). Passing `0`, a negative number, or a non-numeric string will likely produce an error or be silently ignored; exact behavior is unconfirmed due to absent call-graph data.
2. **Expecting rich formatting in the clipboard** — because the target text is an assistant response, the clipboard content is expected to be plain text. Markdown or terminal-styled output may or may not be preserved; this is unconfirmed without deeper traversal.
3. **Using `/copy N` when fewer than N responses exist** — if the conversation has fewer assistant messages than the requested index `N`, the command will find no response at that position and is expected to surface an error rather than copy partial content.
4. **Assuming the command sends a request to Claude** — as a `local-jsx` command, `/copy` operates entirely on already-received conversation history and does not consume API tokens or trigger a new model turn.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| *(none)* | The AST traversal returned an empty `identifiers` array for module `o6q`; no obfuscated identifiers were captured at depth ≤ 2. Re-run with `--depth 4` targeting module `o6q` to populate this table. |