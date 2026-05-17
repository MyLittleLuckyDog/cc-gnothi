---
type: feature-spec
feature: "heapdump"
cc_version: "2.1.132"
updated: "2026-05-17"
tags: ["heapdump", "commands", "slash-commands"]
source: "bundle-registration-only"
bundle_verified: false
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/heapdump`

> Analysis basis: CC v2.1.132 bundle.js (registration only; behavioral spec not yet analyzed)

## Registration

| Field | Value |
|---|---|
| name | `heapdump` |
| type | `local` |
| description | Dump the JS heap to ~/Desktop |

## Behavioral Spec

<!-- TODO: requires bundle.js deep analysis -->
<!-- Target: complete control flow for /heapdump (input parsing → execution → output) -->
<!-- Rule: pseudocode/Mermaid only. Never quote bundle code. -->

## Common Mistakes

<!-- TODO: fill after analysis -->

## See Also

- [_index.md](_index.md) — full command list for v2.1.132
