```
---
type: feature-spec
feature: "skill-doctor"
cc_version: "2.1.198"
updated: "2026-07-02"
tags: ["skill-doctor", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.198 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/skill-doctor`

> Analysis basis: CC v2.1.198 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.198

---

## Overview

`/skill-doctor` is a diagnostic utility command that inspects all currently loaded skills (MCP tools, subagents, or other registered capability modules) and reports which among them are idle — consuming context-window space without being invoked during the session. This helps users identify and unload unnecessary skills to reclaim prompt budget.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `skill-doctor` |
| description | `Show which loaded skills are unused and costing context` |
| supportsNonInteractive | `true` |
| thinClientDispatch | `post-text` |
| load_inline | `true` |
| loc_byte | `13568443` |
| loc_byte_end | `13568843` |

Analysis basis: CC v2.1.198 bundle.js:+13568443

---

## Input Branching

The command takes no user-supplied arguments and produces a single diagnostic report. The flow is linear with at most two outcome branches (skills present vs. no skills loaded), making numbered pseudocode the appropriate representation.

1. Command is invoked (no arguments parsed).
2. The runtime collects the list of all currently loaded skills from the session skill registry.
3. For each loaded skill, the runtime checks whether it was called at least once during the current session.
4. Two outcomes:
   - **Skills are loaded**: Partition skills into "used" and "unused" buckets; format and emit a report listing unused skills alongside their estimated context cost.
   - **No skills loaded**: Emit a message indicating that no skills are currently registered.

---

## Behavioral Spec

### Skill Usage Audit

```
function skillDoctor(session):
    loadedSkills = session.getLoadedSkills()

    if loadedSkills is empty:
        return formatMessage("No skills are currently loaded.")

    unusedSkills = []
    usedSkills   = []

    for each skill in loadedSkills:
        if skill.invocationCount == 0:
            unusedSkills.append(skill)
        else:
            usedSkills.append(skill)

    report = buildReport(unusedSkills, usedSkills)
    return report

function buildReport(unusedSkills, usedSkills):
    lines = []
    lines.append(summary(totalLoaded   = len(unusedSkills) + len(usedSkills),
                         totalUnused   = len(unusedSkills)))
    for each skill in unusedSkills:
        lines.append(formatUnusedEntry(skill.name, skill.estimatedContextTokens))
    return joinLines(lines)
```

> **Note**: No explicit handler function (`handler_method`, `load_ident`, `module_id`, or `arbor_handler`) was resolved during depth-2 AST traversal. The behavioral logic above is inferred from the registration metadata (description, `thinClientDispatch: "post-text"`, `supportsNonInteractive: true`) and the command's stated purpose. The implementation details of the actual handler are not confirmed at this traversal depth.

Analysis basis: CC v2.1.198 bundle.js:+13568443

### Non-Interactive Mode

Because `supportsNonInteractive` is `true`, the command may be executed in headless/scripted contexts (e.g., piped invocations, CI runs). In non-interactive mode the output is plain text rather than a rich terminal UI, consistent with the `thinClientDispatch: "post-text"` dispatch policy.

Analysis basis: CC v2.1.198 bundle.js:+13568443

### Thin-Client Dispatch

The `thinClientDispatch` value of `"post-text"` indicates that when Claude Code is operating in a thin-client configuration, the command's output is posted back as plain text rather than being rendered through the full interactive UI layer.

Analysis basis: CC v2.1.198 bundle.js:+13568443

### Inline Load

The `load_inline: true` flag means the command handler is bundled inline within the registration object rather than being loaded lazily from a separate module. No dynamic import is performed at invocation time; the handler is immediately available once the CLI initializes.

Analysis basis: CC v2.1.198 bundle.js:+13568443

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | None detected at depth-2 traversal |
| appState changes | None detected; command is read-only diagnostic |
| Sound | None detected |
| Context / session mutation | None — command reads skill registry but does not modify it |
| Output channel | Plain text (post-text dispatch); compatible with non-interactive mode |

---

## Version History

| Version | Change |
|---|---|
| v2.1.198 | Initial analysis |

---

## Common Mistakes

1. **Expecting argument support**: `/skill-doctor` accepts no arguments. Passing skill names or flags after the command will likely be ignored or produce an error, as no argument-parsing logic was found in the registration metadata.
2. **Confusing "loaded" with "available"**: A skill may be installed but not loaded into the current session. `/skill-doctor` only reports on skills that are actively loaded and occupying context, not on all installed skills.
3. **Running after heavy skill usage and expecting "unused" results**: The command checks invocation count within the current session. If all loaded skills have been called at least once, the report may show no unused skills even if some skills are rarely useful in practice.
4. **Assuming rich UI output in non-interactive mode**: Because `thinClientDispatch` is `"post-text"`, piped or CI usage will receive plain-text output without colour, tables, or interactive elements.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| *(none)* | No obfuscated identifiers were recovered at depth-2 traversal for this command. |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.
```