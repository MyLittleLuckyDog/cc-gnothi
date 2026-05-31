---
type: feature-spec
feature: "statusline"
cc_version: "2.1.132"
updated: "2026-05-31"
tags: ["statusline", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.132 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/statusline`

> Analysis basis: CC v2.1.132 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.132

---

## Overview

The `/statusline` command configures Claude Code's status line UI by dispatching a dedicated subagent. When invoked, it constructs a prompt that instructs the agent to create a subagent of type `"statusline-setup"`, passing the user's shell `PS1` configuration as the effective task description. The command is of type `prompt`, meaning its entire effect is expressed as a message sent to the agent rather than through imperative side effects.

---

## Registration

| Field | Value |
|---|---|
| type | `prompt` |
| name | `statusline` |
| description | `Set up Claude Code's status line UI` |
| aliases | *(none)* |
| handler_method | `getPromptForCommand` |
| handler_method_start (byte) | `11363337` |
| handler_method_end (byte) | `11363545` |
| prompt_body length | `76 characters` |
| prompt_body trace | `inline template` |
| `loc_byte_end` | `11363546` |
| `handler_method_start` | `11363337` |
| `handler_method_end` | `11363545` |
| `prompt_body.length` | `76` chars |
| `prompt_body.trace` | `inline template` |
| `arbor_handler.name` | `getPromptForCommand` |
| `arbor_handler.kind` | `Method` |
| `arbor_handler.resolution_path` | `direct` |
| `arbor_handler.fqn` | `claude-2.1.132::getPromptForCommand` |
| `arbor_handler.n_hits` | `1` |

Analysis basis: CC v2.1.132 bundle.js:+11363032 – +11363546

---

## Input Branching

The handler reads the user-supplied argument string, trims it, and falls back to a default prompt text if the trimmed value is empty.

```mermaid
flowchart TD
    A[User invokes /statusline] --> B[Read raw argument string H]
    B --> C{H.trim() non-empty?}
    C -- Yes --> D[Use trimmed argument as embedded prompt text]
    C -- No --> E[Use default text:\n'Configure my statusLine from my shell PS1 configuration']
    D --> F[Build subagent dispatch message]
    E --> F
    F --> G[Return prompt string to agent runtime]
```

Analysis basis: CC v2.1.132 bundle.js:+11363343 (getPromptForCommand dispatch), +11363372 (H.trim call), +11363382 (default literal)

---

## Behavioral Spec

### Prompt Construction

The handler is an inline `ObjectMethod` named `getPromptForCommand` residing directly on the registration object (resolution path: `direct`). It is the sole entry point for this command.

```
function getPromptForCommand(rawArgument):
    trimmedArg = rawArgument.trim()

    if trimmedArg is empty:
        embeddedPrompt = "Configure my statusLine from my shell PS1 configuration"
    else:
        embeddedPrompt = trimmedArg

    dispatchMessage = buildSubagentDispatch(
        subagent_type = "statusline-setup",
        prompt        = embeddedPrompt,
        content_type  = "text"
    )

    return dispatchMessage
```

Analysis basis: CC v2.1.132 bundle.js:+11363343, +11363372, +11363382, +11363453

**Key observations:**

- The constructed message instructs the agent runtime to spawn a subagent whose `subagent_type` is `"statusline-setup"`. This is a named subagent class understood by the Claude Code agent loop.
- The embedded prompt is rendered as a `"text"` content block (literal `"text"` at +11363453).
- When the user provides no argument (or only whitespace), the fallback prompt — approximately *"Configure my statusLine from my shell PS1 configuration"* — is injected verbatim as the subagent's task description (bundle.js:+11363382).
- The overall prompt template length is 76 characters, consistent with a short inline template wrapping the subagent type and the embedded prompt text (bundle.js:+11363032).

### Subagent Dispatch Structure

```
dispatchMessage shape (conceptual):
{
    action:       "create_subagent",
    subagent_type: "statusline-setup",
    prompt:       <trimmedArg | defaultText>,
    content_type: "text"
}
```

The actual serialization is handled by the agent runtime; `getPromptForCommand` returns the composed string that triggers this dispatch. Analysis basis: CC v2.1.132 bundle.js:+11363337–+11363545.

### Utility Function `H` (timer/random helper)

The call graph reaches a secondary function (`H`) that uses `Math.random` and `setTimeout`. These appear to be utility-level infrastructure (e.g., jitter delay or retry scheduling) referenced transitively from the same module scope, **not** logic that runs synchronously inside `getPromptForCommand`. The constants `2` (+12264283) and `1` (+12264299) are associated with this helper.

```
function delayWithJitter(baseMs, jitterFactor):
    // jitterFactor ∈ {1, 2} (observed constants)
    delay = baseMs * (1 + Math.random() * jitterFactor)
    setTimeout(callback, delay)
```

Analysis basis: CC v2.1.132 bundle.js:+12264283, +12264285, +12264299, +12264322

> ⚠️ The connection between `H` and `/statusline` is a depth-2 call-graph edge originating from the same module, not from `getPromptForCommand` directly. Its role in the command's runtime behavior is likely indirect (module-level scheduler). <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | *(none detected in depth-2 traversal)* |
| Hook registration | None observed |
| appState changes | None directly; subagent runtime may update status line state after the spawned `statusline-setup` subagent completes |
| Sound | None observed |
| Subagent spawned | Yes — `subagent_type: "statusline-setup"` |
| Network / FS writes | Deferred to the spawned subagent; not attributable to this command's handler |

---

## Version History

| Version | Change |
|---|---|
| v2.1.132 | Initial analysis — `prompt`-type command with inline `getPromptForCommand`, `statusline-setup` subagent dispatch, default PS1 fallback text confirmed |

---

## Common Mistakes

1. **Passing no argument and expecting a blank subagent task** — when invoked without arguments, the command does *not* send an empty prompt; it substitutes the default PS1 configuration text automatically. Callers cannot suppress the default by invoking `/statusline` with no input.
2. **Assuming direct imperative setup** — `/statusline` is a `prompt`-type command. It does not imperatively modify the status line itself; it delegates entirely to the `statusline-setup` subagent. Any failure in that subagent will not surface as a command-level error in the `/statusline` invocation.
3. **Treating trimmed whitespace as a valid custom prompt** — the trim step means an argument consisting solely of whitespace is indistinguishable from no argument; the default text will be used.
4. **Expecting telemetry events** — no `tengu_*` telemetry events are emitted by this command's handler at the observed traversal depth.
5. **Confusing `H` with a core handler** — the identifier `H` in the call graph is a module-level utility (timer/jitter helper) and is not the command's main handler. The canonical handler is `getPromptForCommand` (resolved via Arbor `direct` path).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `__handler_statusline` | Synthetic BFS entry point representing the `getPromptForCommand` ObjectMethod on the `/statusline` registration object; not a real exported symbol |
| `H` | Module-level utility function using `Math.random` + `setTimeout`; likely a jitter-delay or retry scheduler reached transitively from the command's module scope |