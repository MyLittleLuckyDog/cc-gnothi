---
type: feature-spec
feature: "voice"
cc_version: 2.1.150
updated: "2026-05-19"
tags: ["voice", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.144
analysis_basis: "CC v2.1.144 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/voice`

> Analysis basis: CC v2.1.144 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.144

---

## Overview

The `/voice` command toggles voice input mode within Claude Code's CLI interface. It accepts one of three explicit sub-modes — `hold`, `tap`, or `off` — to control how voice activation is triggered or disabled. It is registered as a local command and does not support non-interactive execution contexts.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `voice` |
| description | `Toggle voice mode` |
| argumentHint | `[hold\|tap\|off]` |
| supportsNonInteractive | `false` |
| module\_id | `uNq` |

Analysis basis: CC v2.1.144 bundle.js:+11954556

---

## Input Branching

The argument hint `[hold|tap|off]` indicates three discrete activation modes. Based on the registration data, the command routes behavior according to the argument provided by the user.

```mermaid
flowchart TD
    A["/voice invoked"] --> B{Argument provided?}
    B -- "hold" --> C[Activate hold-to-speak mode\nVoice input active only while key/button held]
    B -- "tap" --> D[Activate tap-to-toggle mode\nVoice input toggled on/off by single activation]
    B -- "off" --> E[Disable voice mode entirely]
    B -- "none / unrecognized" --> F[Display usage hint:\n/voice [hold|tap|off]]
```

Analysis basis: CC v2.1.144 bundle.js:+11954556

> **Note:** The call graph for module `uNq` returned no traversable entry functions at depth ≤ 2. The branching logic above is derived solely from the `argumentHint` field in the registration object. Internal dispatch logic, default fallback behavior, and error messaging are:
> <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->

---

## Behavioral Spec

### Mode Dispatch

The following pseudocode describes the expected top-level dispatch behavior inferred from the registration fields. It does not reproduce any bundle code.

```
function handleVoiceCommand(args):
    mode = args[0]  // first positional argument

    if mode == "hold":
        setVoiceMode(HOLD_TO_SPEAK)

    else if mode == "tap":
        setVoiceMode(TAP_TO_TOGGLE)

    else if mode == "off":
        setVoiceMode(DISABLED)

    else:
        displayUsage("/voice [hold|tap|off]")
        return
```

Analysis basis: CC v2.1.144 bundle.js:+11954556

### Non-Interactive Guard

Because `supportsNonInteractive` is `false`, the command must be invoked within an interactive TTY session. If called in a non-interactive pipeline or scripted context, the CLI is expected to reject the invocation before dispatch reaches the mode logic.

```
function voiceCommandEntryPoint(context, args):
    if not context.isInteractive:
        emitError("Command /voice does not support non-interactive mode")
        return

    handleVoiceCommand(args)
```

Analysis basis: CC v2.1.144 bundle.js:+11954556

### hold Mode

<!-- TODO: not found in depth-2 traversal; needs --depth 4 -->

The `hold` sub-mode is expected to keep voice input active only for the duration that an activation key or button is held. The exact hardware/software hook used to detect hold state is not recoverable from the current traversal depth.

### tap Mode

<!-- TODO: not found in depth-2 traversal; needs --depth 4 -->

The `tap` sub-mode is expected to toggle voice capture on or off with a single discrete activation event. State persistence between activations is not determinable from registration data alone.

### off Mode

<!-- TODO: not found in depth-2 traversal; needs --depth 4 -->

The `off` sub-mode is expected to fully disable any active voice capture session and clean up associated resources or listeners.

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected at depth ≤ 2. <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Non-interactive support | Explicitly disabled (`supportsNonInteractive: false`) |

Analysis basis: CC v2.1.144 bundle.js:+11954556

---

## Version History

| Version | Change |
|---|---|
| v2.1.144 | Initial analysis — registration confirmed; internal implementation unreachable at traversal depth ≤ 2 |

---

## Common Mistakes

1. **Omitting the sub-mode argument** — Invoking `/voice` without `hold`, `tap`, or `off` will likely display usage help rather than toggling any state. Always supply an explicit mode.
2. **Using in non-interactive contexts** — Because `supportsNonInteractive` is `false`, calling `/voice` inside a script, CI pipeline, or piped session will be rejected. This command is exclusively for interactive terminal sessions.
3. **Assuming a default active mode** — There is no evidence in the registration data of a default fallback mode. Do not assume `/voice` alone enables any particular capture behavior.
4. **Expecting telemetry or scripted observation** — No telemetry events were found at the analyzed traversal depth, so automated monitoring of voice mode changes via event hooks cannot be confirmed from this data.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `uNq` | Module ID for the `/voice` command registration and implementation unit |

> No obfuscated function or variable identifiers were returned by the depth-≤-2 AST traversal for this module. The call graph and identifier arrays are both empty.
> <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->