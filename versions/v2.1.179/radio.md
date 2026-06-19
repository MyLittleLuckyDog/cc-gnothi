---
type: feature-spec
feature: "radio"
cc_version: 2.1.179
updated: "2026-06-16"
tags: ["radio", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.178
analysis_basis: "CC v2.1.178 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/radio`

> Analysis basis: CC v2.1.178 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.178

---

## Overview

`/radio` is a local Claude Code slash command that opens the Claude FM lo-fi radio stream (`https://clau.de/radio`) in the user's default web browser. It is a purely side-effectful, non-interactive command: it triggers a browser launch and returns a short status message, emitting no telemetry events.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `radio` |
| description | `Listen to Claude FM lo-fi radio` |
| loc_byte | `13032488` |
| loc_byte_end | `13032693` |
| loc_line | `9015` |
| supportsNonInteractive | `false` |
| module_id | `HWK` |
| load_inline | `true` |
| arbor_handler.name | `D95` |
| arbor_handler.fqn | `claude-2.1.178::D95` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.178 bundle.js:+13032488

---

## Input Branching

The command accepts no user-supplied arguments. Its branching logic is determined entirely by the outcome of the browser-open attempt (success vs. failure). Two branches exist; numbered pseudocode is sufficient.

1. **Happy path** — the URL opens successfully → return a `text` message: `"Opening Claude FM in your browser…"`
2. **Error path** — the open attempt throws or fails → return a `text` message: `"Couldn't open the browser. Listen at: https://clau.de/radio"`

---

## Behavioral Spec

### Top-Level Handler (`D95`)

The Arbor-resolved handler is the `AsyncFunction` `D95` inside module `HWK`.

```
async function radioCommandHandler(context):
    TARGET_URL = "https://clau.de/radio"

    try:
        openUrlInBrowser(TARGET_URL)   // calls h4 → Dg9 / KV7
        return { type: "text", body: "Opening Claude FM in your browser…" }
    catch error:
        return { type: "text", body: "Couldn't open the browser. Listen at: https://clau.de/radio" }
```

Analysis basis: CC v2.1.178 bundle.js:+13032246

---

### URL Validation (`KV7`)

Before attempting to open the URL, a validation step (reachable via `h4 → KV7`) checks that the scheme is an acceptable web protocol.

```
function validateUrl(url):
    scheme = extractScheme(url)        // e.g. "http:" or "https:"
    if scheme not in ["http:", "https:"]:
        throw new Error("Unsupported URL scheme")
    return true
```

Accepted scheme literals: `"http:"` (bundle.js:+6311178) and `"https:"` (bundle.js:+6311200).

Analysis basis: CC v2.1.178 bundle.js:+6311128

---

### Browser Open (`Dg9`)

After validation, `Dg9` handles the platform-specific launch of the URL.

```
function openUrlInBrowser(url):
    platform = getPlatform()           // Iw — reads process.platform

    if platform == "darwin":
        spawnProcess("open", [url])    // literals: "darwin" (+6311866), "open" (+6311885)
    else:
        // cross-platform open via alternative launcher (g8 / Q_ path)
        crossPlatformOpen(url)

    return exitCode == 0               // success check: number literal 0 at +6311832
```

Analysis basis: CC v2.1.178 bundle.js:+6311749

---

### Cross-Platform URL Opener (`g8 / Q_`)

When the platform is not `darwin`, `g8` delegates to `Q_`, which implements a cross-platform open strategy.

```
function crossPlatformOpen(url):
    candidates = detectAvailableLaunchers()   // Q_ probes environment

    // Internal limits observed in literals:
    //   max retries / pool size: 10   (+1131181)
    //   buffer size ceiling: 1000000  (+1131703)
    //   initial attempt index: 1      (+1131826)

    for each launcher in candidates:
        result = tryLaunch(launcher, url)
        if result.status == "error":          // literal "error" at +1132130
            logAndContinue(result)
            continue
        return result

    // subordinate utilities called by Q_:
    //   shH  — shell-helper / argument builder  (+1131742)
    //   w    — write / output helper            (+1131879)
    //   Ol4  — option/launcher selector         (+1131935)
    //   D5   — data / environment reader        (+1132061)
    //   N    — normaliser                       (+1132067)
    //   Z8   — zero-exit checker                (+1132102)
    //   RH   — result handler                   (+1132145)
```

Analysis basis: CC v2.1.178 bundle.js:+1131236

---

### Process Spawn Utilities (`u6`)

`u6` provides low-level child-process spawning used by the open sub-system.

```
function spawnChild(command, args, options):
    // delegates to Pe6 — process-execution primitive  (+1055617)
    // and W_  — wait/resolve helper                   (+1055636)
    process = Pe6(command, args, options)
    return W_(process)
```

Analysis basis: CC v2.1.178 bundle.js:+1131347

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None — `telemetry` array is empty; no `tengu_*` events are fired |
| Browser launch | Spawns a child process to open `https://clau.de/radio` (platform-dependent: `open` on macOS, cross-platform launcher otherwise) |
| appState changes | None observed in depth-2 traversal |
| Sound | None |
| Hook registration | None observed in depth-2 traversal |
| Return value | Always a `{ type: "text" }` response object (literal `"text"` at bundle.js:+13032286) |
| Non-interactive support | `supportsNonInteractive: false` — command must be invoked from an interactive session |

---

## Version History

| Version | Change |
|---|---|
| v2.1.178 | Initial analysis |

---

## Common Mistakes

1. **Expecting output in the terminal**: `/radio` opens a browser tab, not an in-terminal audio player. The terminal only receives the short confirmation (or error) text message.
2. **Using in non-interactive mode**: `supportsNonInteractive` is `false`; invoking `/radio` from a script or pipe will not work as expected.
3. **Assuming arguments are accepted**: The command takes no arguments. Any text typed after `/radio` is ignored.
4. **Assuming telemetry is present**: Unlike most commands, `/radio` fires zero telemetry events, so it will not appear in usage analytics derived from `tengu_*` event counts.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `D95` | Top-level async handler for `/radio` (Arbor-resolved entry point, module `HWK`) |
| `h4` | URL dispatch coordinator; calls validator and browser-open function |
| `KV7` | URL scheme validator; checks `"http:"` / `"https:"` prefixes |
| `Dg9` | Platform-aware browser launcher; branches on `darwin` vs. other platforms |
| `Iw` | Platform detector (`process.platform` reader) |
| `g8` | Cross-platform open initiator; delegates to `Q_` |
| `Q_` | Cross-platform URL open engine; probes available launchers and iterates |
| `u6` | Child-process spawn helper; wraps `Pe6` and `W_` |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.