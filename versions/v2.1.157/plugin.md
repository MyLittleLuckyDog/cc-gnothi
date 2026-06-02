---
type: feature-spec
feature: "plugin"
cc_version: "2.1.157"
updated: "2026-06-02"
tags: ["plugin", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.157 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/plugin`

> Analysis basis: CC v2.1.157 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.157

---

## Overview

The `/plugin` command (also reachable as `/plugins` or `/marketplace`) is a local JSX command that provides a plugin management interface within Claude Code. It renders a JSX component as its primary output and delegates to a conversation/context analysis sub-system to determine the current turn state before presenting plugin-related options. No telemetry events were detected in the depth-2 traversal.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `plugin` |
| description | `Manage Claude Code plugins` |
| aliases | `["plugins", "marketplace"]` |
| immediate | `true` |
| load_inline | `true` |
| module_id | `$i1` |
| loc_byte | `12292493` |
| loc_byte_end | `12292783` |
| arbor_handler.name | `Vf5` |
| arbor_handler.fqn | `claude-2.1.157::Vf5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.157 bundle.js:+12292493

---

## Input Branching

The handler's internal flow involves 3+ distinct branches driven by message-role classification and content-type checking. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/plugin invoked"] --> B["Handler: pluginCommandHandler (Vf5)"]
    B --> C["Render JSX element via createElement"]
    B --> D["Call: buildContextView (FC1)"]
    D --> E["Call: classifyTurns (_k6)"]
    E --> F["Call: validateMessageRole (BC1)"]
    F --> G{Role == 'assistant'?}
    G -- Yes --> H["Check content blocks for 'tool_use'"]
    H --> I{Has tool_use block?}
    I -- Yes --> J["Classify as tool-use turn"]
    I -- No --> K["Classify as plain assistant turn"]
    G -- No --> L["Non-assistant role: skip or treat as user turn"]
    E --> M["Call: extractCommandTokens (gH5)"]
    M --> N["Trim whitespace from token string"]
    M --> O{Token set already seen? (FH5.has)}
    O -- Yes --> P["Deduplicate: skip adding"]
    O -- No --> Q["Add token to accumulator set"]
    D --> R["Call: parseCommandSegments (Ak6)"]
    R --> S["Call: validateMessageRole (BC1)"]
    R --> T["Call: extractSegmentBounds (BH5)"]
    T --> U["Run regex on content (UC1.exec)"]
    T --> V["Locate last delimiter (lastIndexOf)"]
    T --> W["Slice segment text"]
    T --> X["Find sub-delimiter (indexOf)"]
    T --> Y["Push segment to result list"]
    R --> Z["Add segment refs to accumulator"]
    B --> AA["Return rendered JSX plugin UI"]
```

---

## Behavioral Spec

### Top-Level Handler: Plugin UI Renderer

The Arbor-resolved handler `Vf5` is an `AsyncFunction` reached via `module_id → $i1`.

```
async function pluginCommandHandler(commandInput):
    element = createElement(PluginComponent, commandInput)
    contextView = buildContextView(conversationMessages)
    return render(element, contextView)
```

Analysis basis: CC v2.1.157 bundle.js:+12289924, +12289989

---

### Sub-feature: Context View Builder (`FC1`)

`FC1` (buildContextView) orchestrates two downstream passes over the conversation message list: turn classification and command segment parsing.

```
function buildContextView(messages):
    turnMap   = classifyTurns(messages)       // _k6
    segmentList = parseCommandSegments(messages) // Ak6
    return { turnMap, segmentList }
```

Analysis basis: CC v2.1.157 bundle.js:+11461439, +11461456

---

### Sub-feature: Turn Classifier (`_k6`)

Iterates over messages and classifies each by role and content type, building a deduplicated token set.

```
function classifyTurns(messages):
    accumulator = new Set()
    for each message in messages:
        isValid = validateMessageRole(message)   // BC1
        if isValid:
            tokens = extractCommandTokens(message) // gH5
            accumulator.add(tokens)               // _.add
    return accumulator
```

Analysis basis: CC v2.1.157 bundle.js:+11460776, +11460790, +11460802

---

### Sub-feature: Message Role Validator (`BC1`)

Checks that a message originates from the `"assistant"` role and that its content includes a block of type `"tool_use"`. Relies on `Array.isArray` for structure safety and an `includes` check on the content-type field.

```
function validateMessageRole(message):
    if message.role != "assistant":        // literal: "assistant" @ +11460500
        return false
    if not Array.isArray(message.content):
        return false
    hasToolUse = message.content.includes("tool_use") // literal @ +11460590
    return hasToolUse
```

Analysis basis: CC v2.1.157 bundle.js:+11460513, +11460602

---

### Sub-feature: Command Token Extractor (`gH5`)

Extracts tokens associated with `"command"`-type content blocks, trims whitespace, and deduplicates via a persistent seen-set (`FH5`).

```
function extractCommandTokens(message):
    results = []
    for each block in message.content:
        if block.type == "command":        // literal @ +11460672
            token = block.text.trim()     // H.trim @ +11461172
            if not seenTokens.has(token): // FH5.has @ +11461250
                results.push(token)
    return results
```

Analysis basis: CC v2.1.157 bundle.js:+11461172, +11461250

---

### Sub-feature: Command Segment Parser (`Ak6`)

A second pass over messages: validates role (reuses `BC1`), then delegates to the segment bounds extractor (`BH5`) which uses regex and string operations to locate and slice segment boundaries.

```
function parseCommandSegments(messages):
    accumulator = []
    for each message in messages:
        isValid = validateMessageRole(message)  // BC1 @ +11461092
        if isValid:
            segments = extractSegmentBounds(message.content) // BH5 @ +11461112
            accumulator.add(segments)                         // _.add @ +11461119
    return accumulator
```

Analysis basis: CC v2.1.157 bundle.js:+11461092, +11461112, +11461119

---

### Sub-feature: Segment Bounds Extractor (`BH5`)

Uses a compiled regex (`UC1`) to scan content, then uses `lastIndexOf`, `slice`, and `indexOf` to extract precise text ranges. Results are pushed to an output list.

```
function extractSegmentBounds(content):
    segments = []
    startOffset = 0                              // literal 0 @ +11460876
    match = regexPattern.exec(content)           // UC1.exec @ +11460887
    while match != null:
        lastSep = content.lastIndexOf(match)     // @ +11460935
        segment = content.slice(startOffset, lastSep) // @ +11460966
        subPos  = segment.indexOf(delimiter)     // @ +11460985
        segments.push({ segment, subPos })       // @ +11461030
        startOffset = lastSep + 1
    return segments
```

Analysis basis: CC v2.1.157 bundle.js:+11460887, +11460935, +11460966, +11460985, +11461030

---

### Sub-feature: Randomized Utility (`H`)

`H` is reachable indirectly via `gH5` and contains `Math.random` and `setTimeout` calls, suggesting a jitter or debounce utility used internally (possibly for rendering scheduling or token deduplication timing). Numeric literals `2`, `1`, and `0` appear in this vicinity.

- `Math.random` usage — literal `2` at +13423029, literal `1` at +13423045
- `setTimeout` call — +13423068

```
function jitterDelay():
    factor = Math.random() * 2       // constants: 2, 1
    delay  = Math.max(1, factor)
    setTimeout(callback, delay)
```

Analysis basis: CC v2.1.157 bundle.js:+13423029, +13423031, +13423045, +13423068

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal |
| Hook registration | `immediate: true` — command executes without waiting for agent turn |
| appState changes | Accumulator set (`FH5`) is updated with newly seen command tokens; segment accumulator is extended |
| JSX rendering | `D8A.createElement` is called to construct the plugin management UI component |
| File system | `q` identifier reaches `JVK.unlinkSync` (+15445005) — a file-deletion utility is reachable within depth-2; unclear if triggered by this command path directly |
| Sound | None detected |

---

## Version History

| Version | Change |
|---|---|
| v2.1.157 | Initial analysis |

---

## Common Mistakes

1. **Using `/plugin` expecting a conversational agent response** — this is a `local-jsx` command with `immediate: true`; it renders a UI component directly without invoking the LLM agent.
2. **Assuming `/marketplace` is a separate command** — `/marketplace` and `/plugins` are registered aliases of `/plugin` and share identical behavior.
3. **Expecting telemetry visibility** — no `tengu_*` telemetry events were found in the depth-2 traversal; plugin interactions may not appear in telemetry logs for this version.
4. **Assuming the command operates on raw user text input** — the context-building pipeline (`FC1 → _k6 / Ak6`) processes the existing conversation message list, not the slash-command argument string directly.
5. **Confusing `tool_use` classification with tool invocation** — the `validateMessageRole` / `BC1` check identifies messages that contain `tool_use` blocks for context-building purposes; it does not invoke any tool itself.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Vf5` | Top-level plugin command handler (AsyncFunction); Arbor-resolved entry point |
| `FC1` | Context view builder; orchestrates turn classification and segment parsing |
| `_k6` | Turn classifier; iterates messages and populates token accumulator |
| `BC1` | Message role validator; checks for `"assistant"` role and `"tool_use"` content |
| `gH5` | Command token extractor; trims and deduplicates `"command"`-type block text |
| `H` | Jitter/delay utility; uses `Math.random` and `setTimeout` |
| `_` | Generic accumulator/set object; target of `.add` calls in turn and segment passes |
| `Ak6` | Command segment parser; second-pass message iterator feeding `BH5` |
| `BH5` | Segment bounds extractor; uses regex, `lastIndexOf`, `slice`, `indexOf` to slice content |
| `q` | String/path utility object; reaches `JVK.unlinkSync` — potential file-deletion helper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.