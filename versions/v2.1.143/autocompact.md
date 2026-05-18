---
type: feature-spec
feature: "autocompact"
cc_version: "2.1.143"
updated: "2026-05-18"
tags: ["autocompact", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.143 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/autocompact`

> Analysis basis: CC v2.1.143 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.143

---

## Overview

`/autocompact` configures the threshold at which Claude Code automatically compacts the conversation context window. The command accepts either the literal keyword `auto` (to restore automatic threshold selection) or an explicit token count, and persists the chosen value to the active settings layer. When invoked with no argument it opens an interactive dialog instead of applying a value directly.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `autocompact` |
| description | Configure the auto-compact window size |
| argumentHint | `[auto\|<tokens>]` |
| isHidden | `false` |
| module\_id | `gKq` |

Analysis basis: CC v2.1.143 bundle.js:+10139002

---

## Input Branching

The top-level handler (`dialogOrCommandHandler`) inspects whether a user-supplied argument string is present and non-empty after trimming, then delegates to either the interactive dialog path or the direct-set path.

```mermaid
flowchart TD
    A["/autocompact invoked"] --> B{Argument string present\nand non-empty after trim?}
    B -- No --> C[Open interactive dialog\nEmit: tengu_autocompact_dialog_opened]
    B -- Yes --> D{Is argument one of\n'reset' | 'unset' | 'default'?}
    D -- Yes --> E[Clear stored setting\nDelegate to clearSetting]
    D -- No --> F{Is argument 'auto'?}
    F -- Yes --> G[Set compact window to 'auto'\nDisplay: 'Auto-compact window set to auto']
    F -- No --> H[Parse token argument via\nparseTokenArgument]
    H --> I{Parse result valid?}
    I -- No --> J[Return error result 'invalid']
    I -- Yes --> K{Env var CLAUDE_CODE_AUTO_COMPACT_WINDOW set?}
    K -- Yes --> L[Warn: env var takes precedence\nDisplay precedence message]
    K -- No --> M[Persist token value to settings\nEmit: tengu_autocompact_command]
```

Analysis basis: CC v2.1.143 bundle.js:+10133497 (command handler entry), +10138687 (dialog branch entry), +10133662 (reset/unset/default literals), +9577577 (auto literal)

---

## Behavioral Spec

### Token Argument Parsing

The `parseTokenArgument` function normalises a raw user string into a validated integer token count.

```
function parseTokenArgument(rawInput):
    s = rawInput.trim()

    if s.endsWith("k") or s.endsWith("K"):
        numeric = parseFloat(s)           // strip suffix implicitly
        value   = Math.round(numeric * 1000)
    else:
        value = parseInt(s, 10)

    if not Number.isFinite(value):
        return { valid: false, reason: "invalid" }

    // Clamp to legal range
    value = Math.max(value, 10)           // lower bound: 10 tokens
    value = Math.min(value, 1_000_000)    // upper bound: 1 000 000 tokens

    // Snap to nearest hundred below 1 000, nearest thousand above
    if value < 1000:
        value = Math.round(value / 10)  * 10
    else:
        value = Math.round(value / 1000) * 1000

    return { valid: true, tokens: value }
```

- Lower bound: **10 tokens** Analysis basis: CC v2.1.143 bundle.js:+9576773
- Upper bound: **1 000 000 tokens** Analysis basis: CC v2.1.143 bundle.js:+9576702
- Sub-1 000 rounding granularity: **10** Analysis basis: CC v2.1.143 bundle.js:+9576782
- Above-1 000 rounding granularity: **1 000** Analysis basis: CC v2.1.143 bundle.js:+9576746
- `Number.isFinite` guard applied before clamping Analysis basis: CC v2.1.143 bundle.js:+9576808
- `Math.round` used for rounding Analysis basis: CC v2.1.143 bundle.js:+9576855

### Environment Variable Precedence Check

After a valid token value is derived, the command handler reads the `CLAUDE_CODE_AUTO_COMPACT_WINDOW` environment variable. If it is set, no settings write is performed and the user receives the message:

> `CLAUDE_CODE_AUTO_COMPACT_WINDOW is set and takes precedence. Unset it to change this setting.`

Analysis basis: CC v2.1.143 bundle.js:+9577215 (env var name literal), +10133531 (precedence message literal), +9577407 (source label `"env"`)

### Settings Persistence

When no environment variable override is active, the resolved value is written through `persistSettings` (the settings-write utility, `p_`). The write targets the `userSettings` layer unless a project-scoped or local-scoped path takes precedence via the settings-layer resolution logic.

The settings-write path internally uses:
- `PXH.dirname` for path resolution Analysis basis: CC v2.1.143 bundle.js:+1206410
- `utf-8` encoding for file I/O Analysis basis: CC v2.1.143 bundle.js:+1206908
- An `WCH.emit` call to notify subscribers after the write Analysis basis: CC v2.1.143 bundle.js:+1207214
- An `Error` constructor for write-failure propagation Analysis basis: CC v2.1.143 bundle.js:+1206551

Settings layers consulted (in priority order, derived from literals in `p_`):

| Priority | Layer key |
|---|---|
| 1 (highest) | `policySettings` |
| 2 | `flagSettings` |
| 3 | `projectSettings` |
| 4 | `localSettings` |
| 5 (lowest) | `userSettings` |

Analysis basis: CC v2.1.143 bundle.js:+1206298 (`policySettings`), +1206320 (`flagSettings`), +1206971 (`projectSettings`), +1206994 (`localSettings`), +1206856 (`userSettings`)

After a successful write for the `auto` keyword, the confirmation string **"Auto-compact window set to auto"** is returned to the UI.
Analysis basis: CC v2.1.143 bundle.js:+10134315

### Reset / Clear Path

Arguments `reset`, `unset`, or `default` all map to the same clear-setting branch (`clearSetting` / `R_`), which removes the stored autocompact window value from the active settings layer and delegates to the `Lu` (settings-reader/writer coordination) utility.
Analysis basis: CC v2.1.143 bundle.js:+10133662, +10133675, +10133688, +1204658

### Flag Settings Application

After the settings write (set or clear), `_.applyFlagSettings` is called to propagate any flag-derived overrides that may now take effect.
Analysis basis: CC v2.1.143 bundle.js:+10134050

### Interactive Dialog Path

When no argument is provided the handler constructs a JSX element (`sM.createElement`) with role `"dialog"`, emits `tengu_autocompact_dialog_opened`, and returns the element for rendering by the host UI framework. The dialog implementation uses `Math.random` and `setTimeout` internally (from the shared `H` utility), suggesting animated or deferred rendering.
Analysis basis: CC v2.1.143 bundle.js:+10138775, +10138764 (dialog role literal), +10138722 (telemetry), +12638156 (`Math.random`), +12638193 (`setTimeout`)

### Compact-Window State Reader

`getCompactWindowState` (`qr`) is invoked inside the command handler to read the current effective window size prior to any modification. It resolves the value from up to four sources, returning a structured result that includes the source label (`"env"`, `"settings"`, `"auto"`, or `"invalid"`).

```
function getCompactWindowState():
    raw = readEnvVar("CLAUDE_CODE_AUTO_COMPACT_WINDOW")  // G1

    if raw is set:
        parsed = parseTokenArgument(raw)
        if not parsed.valid:
            return { source: "invalid", tokens: null }
        tokens = clamp(parsed.tokens, 0, MAX_TOKENS)     // Math.max / Math.min
        return { source: "env", tokens: tokens }

    stored = readFromSettings()                          // r0 / j98

    if stored is set:
        return { source: "settings", tokens: stored }

    return { source: "auto", tokens: null }
```

- `"invalid"` source sentinel Analysis basis: CC v2.1.143 bundle.js:+9577316
- `"env"` source sentinel Analysis basis: CC v2.1.143 bundle.js:+9577407
- `0` lower clamp in env-path Analysis basis: CC v2.1.143 bundle.js:+9577427
- `"settings"` source sentinel Analysis basis: CC v2.1.143 bundle.js:+9577477
- `"auto"` source sentinel Analysis basis: CC v2.1.143 bundle.js:+9577577
- `Math.max` call Analysis basis: CC v2.1.143 bundle.js:+9577333
- `Math.min` call Analysis basis: CC v2.1.143 bundle.js:+9577373

### Numeric Formatting

The `oK` helper (display formatter) uses `dq` internally and appends `".0"` when formatting fractional token counts for display, ensuring consistent decimal presentation.
Analysis basis: CC v2.1.143 bundle.js:+10134299 (oK call-site), +206690 (oK→dq), +206704 (`".0"` literal)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — command | `tengu_autocompact_command` fired after a successful token/auto/reset set operation (Analysis basis: CC v2.1.143 bundle.js:+10134101) |
| Telemetry — dialog | `tengu_autocompact_dialog_opened` fired when the command is invoked with no argument (Analysis basis: CC v2.1.143 bundle.js:+10138722) |
| Settings write | Persists `autocompact` window value to `userSettings` (or effective layer) via `persistSettings` (`p_`) |
| Settings clear | Removes `autocompact` window value from active settings layer via `clearSetting` (`R_`) |
| Flag propagation | `_.applyFlagSettings` is called after every set/clear to re-apply flag-derived config (Analysis basis: CC v2.1.143 bundle.js:+10134050) |
| Event bus | `WCH.emit` notifies subscribers upon settings file write (Analysis basis: CC v2.1.143 bundle.js:+1207214) |
| JSX rendering | Dialog branch returns a `sM.createElement` node for UI rendering (Analysis basis: CC v2.1.143 bundle.js:+10138775) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.143 | Initial analysis |

---

## Common Mistakes

1. **Passing a bare integer expecting exact storage** — The parser rounds values to the nearest 10 (below 1 000) or nearest 1 000 (above 1 000), so `/autocompact 1234` is stored as `1000`, not `1234`.
2. **Expecting the command to override the env var** — If `CLAUDE_CODE_AUTO_COMPACT_WINDOW` is set in the shell environment, `/autocompact <tokens>` will display a precedence warning and make no change; the env var must be unset first.
3. **Using `reset` expecting a confirmation number** — The `reset`/`unset`/`default` keywords clear the stored setting entirely; they do not restore a numeric default. The effective window size will revert to `auto` behaviour.
4. **Omitting the argument expecting an immediate change** — Invoking `/autocompact` with no argument opens a dialog rather than performing any write; the dialog interaction must be completed for a change to take effect.
5. **Providing a token count outside the valid range** — Values are silently clamped to the range **10 – 1 000 000**; a value of `0` will be stored as `10`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Cz7` | Top-level command handler / dialog-or-command dispatcher |
| `r26` | Direct-set command handler (argument processing entry point) |
| `qr` | Compact-window state reader (resolves current effective value) |
| `US_` | Token argument parser (string → validated integer) |
| `p_` | Settings persistence utility (read + write settings files) |
| `R_` | Setting clear utility (removes stored autocompact value) |
| `H` | Shared async utility (used for dialog rendering; contains `Math.random` / `setTimeout`) |
| `d` | Application state / context accessor |
| `oK` | Numeric display formatter for token counts |
| `_` | Global utilities namespace (hosts `applyFlagSettings`, `endsWith`, etc.) |