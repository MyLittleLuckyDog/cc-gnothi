---
type: feature-spec
feature: "ultrareview"
cc_version: 2.1.153
updated: "2026-05-19"
tags: ["ultrareview", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.144
analysis_basis: "CC v2.1.144 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultrareview`

> Analysis basis: CC v2.1.144 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.144

---

## Overview

`/ultrareview` is a local JSX slash command registered in CC v2.1.144 under module `bXq`. The AST depth-2 traversal recovered the registration record but yielded no resolvable entry-point functions, call edges, string literals, telemetry events, or obfuscated identifiers for this module; all behavioral detail below is therefore marked with the appropriate `TODO` notice rather than fabricated.

Analysis basis: CC v2.1.144 bundle.js:+11287836

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultrareview` |
| description | `null` |
| loc\_byte | `11287836` |
| loc\_line | `6798` |
| module\_id | `bXq` |

Analysis basis: CC v2.1.144 bundle.js:+11287836

---

## Input Branching

<!-- TODO: not found in depth-2 traversal; needs --depth 4 -->

The call graph returned by the AST extractor is empty (`"callGraph": []`), meaning no branching logic, argument-parsing paths, or sub-command dispatch could be reconstructed at the current traversal depth. A flowchart cannot be drawn without fabricating behavior.

To obtain this data, re-run the extractor against module `bXq` with at least `--depth 4`:

```
ast-extract --module bXq --depth 4 --bundle cc-v2.1.144-bundle.js
```

---

## Behavioral Spec

<!-- TODO: not found in depth-2 traversal; needs --depth 4 -->

No entry functions were resolved for module `bXq` (`"note": "no entry functions found for module 'bXq'"`). The following stub documents the shape of what a complete spec would contain once deeper traversal data is available.

### Command Entry Point

```
function ultrareview(userInput, appState):
    # Entry point unresolved — module bXq returned no callable edges
    # at traversal depth 2.
    # Expected pattern for a local-jsx command:
    #   1. Parse / validate userInput arguments
    #   2. Render a JSX component into the CLI output stream
    #   3. Optionally mutate appState or fire telemetry events
    #   4. Return an exit signal to the slash-command dispatcher
    TODO("re-extract at --depth 4 to fill this body")
```

Analysis basis: CC v2.1.144 bundle.js:+11287836 (registration only; implementation body not traversed)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> No `tengu_*` events found in the depth-2 pass (`"telemetry": []`). |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| JSX render target | Inferred from `type: "local-jsx"` — command renders output as a JSX component rather than plain text. Analysis basis: CC v2.1.144 bundle.js:+11287836 |

---

## Version History

| Version | Change |
|---|---|
| v2.1.144 | Initial analysis — registration record confirmed; implementation traversal incomplete pending `--depth 4` re-extraction. |

---

## Common Mistakes

1. **Treating `description: null` as a missing field.** The registration explicitly stores `null` for the description field (Analysis basis: CC v2.1.144 bundle.js:+11287836). This is a deliberate value in the registration object, not an extraction artifact; the command simply has no description string registered at this location.

2. **Assuming behavior from the command name alone.** The name `ultrareview` is suggestive, but no literals, call edges, or telemetry were recovered to confirm what it actually reviews, what thresholds or limits apply, or what output it produces. Do not derive behavioral claims from the name.

3. **Using this spec as authoritative for behavioral gating.** Until a `--depth 4` traversal populates the call graph, literals, and telemetry sections, this spec documents only the registration record and must not be used to drive automation or policy decisions that depend on the command's runtime behavior.

4. **Confusing module ID `bXq` with a stable API identifier.** Module IDs are bundle-internal and will change across CC versions. Only the `name` field (`ultrareview`) is the stable user-facing identifier.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `bXq` | Module ID containing the `/ultrareview` command registration (not an obfuscated function name; included here for cross-reference). |

> No obfuscated function identifiers were returned by the depth-2 traversal (`"identifiers": []`). Re-run with `--depth 4` to populate this table.