---
type: feature-spec
feature: "radio"
cc_version: 2.1.163
updated: "2026-06-02"
tags: ["radio", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.160
analysis_basis: "CC v2.1.160 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/radio`

> Analysis basis: CC v2.1.160 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.160

---

## Overview

The `/radio` command opens the Claude FM lo-fi radio stream (`https://clau.de/radio`) in the user's default web browser. It is a lightweight, non-interactive utility command that attempts a platform-aware browser launch and falls back to printing a plain-text URL when the launch fails.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `radio` |
| description | `Listen to Claude FM lo-fi radio` |
| supportsNonInteractive | `false` |
| module_id | `Nt1` |
| load_inline | `true` |
| loc_byte | `12468093` |
| loc_byte_end | `12468298` |
| loc_line | `8767` |
| arbor_handler.name | `nEf` |
| arbor_handler.fqn | `claude-2.1.160::nEf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.160 bundle.js:+12468093

---

## Input Branching

The command has 3+ distinct execution paths (URL open success, URL open failure/fallback, platform-specific open strategy), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/radio invoked"] --> B["Attempt to open URL:\nhttps://clau.de/radio"]
    B --> C{URL scheme valid?\nhttp: or https:}
    C -- "Invalid scheme" --> D["Reject with Error\n(vL7 check)"]
    C -- "Valid scheme" --> E{Detect platform\n(process.platform)}
    E -- "darwin" --> F["Spawn 'open' with URL"]
    E -- "win32" --> G["Spawn 'rundll32 url,OpenURL'\nwith URL"]
    E -- "other / linux" --> H["Spawn 'xdg-open' with URL"]
    F --> I{Launch succeeded?}
    G --> I
    H --> I
    I -- "Yes" --> J["Return text message:\n'Opening Claude FM in your browser…'"]
    I -- "No / error" --> K["Return fallback text:\n'Couldn't open the browser.\nListen at: https://clau.de/radio'"]
```

Analysis basis: CC v2.1.160 bundle.js:+6749865, +6749915, +6749937, +6750224, +6750240, +6750324, +6750336, +6750398, +6750405, +12467854, +12467904, +12467972

---

## Behavioral Spec

### Handler Entry Point (`nEf` — radio command handler)

```
async function radioCommandHandler(context):
    targetURL = "https://clau.de/radio"
    result = await openURL(targetURL)
    return result
```

Analysis basis: CC v2.1.160 bundle.js:+12467851, +12467854

---

### URL Open Orchestrator (`kK` — open-URL dispatcher)

```
async function openURLDispatcher(url):
    // Validate URL scheme
    parsed = parseURL(url)
    if parsed.protocol not in ["http:", "https:"]:
        raise Error via schemeValidator(url)   // vL7

    // Determine exit-code threshold
    exitCodeThreshold = 0                      // literal at +6750190

    // Select platform launcher
    platform = process.platform
    if platform == "darwin":
        launcher = "open"
        args = [url]
    elif platform == "win32":
        launcher = "rundll32"
        args = ["url,OpenURL", url]
    else:
        // Linux / BSD / WSL / etc.
        launcher = "xdg-open"
        args = [url]

    // Spawn subprocess via h8
    spawnResult = await spawnLauncher(launcher, args)
    return spawnResult
```

Analysis basis: CC v2.1.160 bundle.js:+6749865, +6749915, +6749937, +6750165, +6750190, +6750224, +6750240, +6750273, +6750324, +6750336, +6750398, +6750405

---

### URL Scheme Validator (`vL7` — scheme guard)

```
function schemeValidator(url):
    if url.protocol not in ["http:", "https:"]:
        throw new Error("unsupported URL scheme")
```

Analysis basis: CC v2.1.160 bundle.js:+6749865, +6749915, +6749937

---

### Subprocess Spawn Wrapper (`h8` → `v_` — process launcher)

```
async function spawnLauncher(executable, args):
    // v_ wraps the low-level child-process spawn via jEH
    // jEH assembles spawn options, registers stdio callbacks,
    // and manages process lifetime (up to 1,000,000 ms timeout)
    childProcess = spawnChildProcess(executable, args, options)

    // On completion, collect exit code and stdout/stderr
    // Uses bound callbacks: PkA.bind, XkA.bind
    exitCode = await waitForExit(childProcess)

    if exitCode != 0:
        return failure
    return success
```

Analysis basis: CC v2.1.160 bundle.js:+1050168, +1050635, +1046243, +1046282

---

### Result Message Construction

```
function buildResultMessage(openSucceeded):
    if openSucceeded:
        return {
            type: "text",
            content: "Opening Claude FM in your browser…"
        }
    else:
        return {
            type: "text",
            content: "Couldn't open the browser. Listen at: https://clau.de/radio"
        }
```

Analysis basis: CC v2.1.160 bundle.js:+12467891, +12467904, +12467972

---

### Forced-Shutdown Guard (`Y` — abort handler)

```
function forcedShutdownHandler(signal):
    // Called if process is interrupted during URL open
    logEvent("forced shutdown")    // literal at +15879880
    abortController.abort()        // z.abort
    process.exit(exitCode)
```

Analysis basis: CC v2.1.160 bundle.js:+15879877, +15879880, +15879899, +15879920

---

### Context Store Lookup (`S6` / `sF6` — async-local store accessor)

```
function getContextStore():
    store = asyncLocalStorage.getStore()   // aF6.getStore
    if store is null:
        return defaultContext via Ki
    return store
```

Analysis basis: CC v2.1.160 bundle.js:+976326, +976347, +976377, +976396

---

### Logger / Error Reporter (`yH` — log sink)

```
function logErrorIfPresent(err):
    if err is defined and err.level == "error":
        appendToLogBuffer(err)          // LUH.push
        mi.logError(err)
```

Analysis basis: CC v2.1.160 bundle.js:+971461, +971474, +971720, +971803, +971821, +971861, +1051062

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | None detected in depth-2 traversal |
| Browser side effect | Spawns a platform-native process (`open` / `rundll32` / `xdg-open`) to open `https://clau.de/radio` in the default browser |
| stdout / return value | Returns a `text`-type message: either `"Opening Claude FM in your browser…"` (success) or `"Couldn't open the browser. Listen at: https://clau.de/radio"` (failure) — Analysis basis: CC v2.1.160 bundle.js:+12467891, +12467904, +12467972 |
| supportsNonInteractive | `false` — command is not usable in non-interactive/pipe mode |
| Abort / shutdown | Registers a forced-shutdown handler (`Y`) that calls `process.exit` and aborts any in-flight async work if the session is interrupted — Analysis basis: CC v2.1.160 bundle.js:+15879899 |
| Async-local store | Reads the async-local context store (`sF6`) for request-scoped config — Analysis basis: CC v2.1.160 bundle.js:+976326 |
| Error logging | Any error from spawn is logged via the internal log sink (`yH`) — Analysis basis: CC v2.1.160 bundle.js:+971861 |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | None detected |

---

## Version History

| Version | Change |
|---|---|
| v2.1.160 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `/radio` has `supportsNonInteractive: false`. Invoking it from a script or pipe context will not work as expected; the command is designed for interactive terminal sessions only.
2. **Expecting in-terminal audio**: The command does not play audio inside the terminal. It opens `https://clau.de/radio` in the system's default browser. If no browser is configured or the desktop environment lacks one, the launch will fail and only the fallback text URL is returned.
3. **Firewall or sandboxed environments**: On systems where `open`, `rundll32`, or `xdg-open` are unavailable or blocked, the command will silently fall back to printing the URL. The fallback message `"Couldn't open the browser. Listen at: https://clau.de/radio"` is the only indication of failure.
4. **Unsupported URL schemes**: The dispatcher (`kK`) validates that the target URL uses `http:` or `https:`. Any attempt to pass a custom/non-standard URL internally would be rejected — this is a hardcoded guard, not a user-facing concern, but relevant to contributors patching the target URL.
5. **Assuming telemetry coverage**: No `tengu_*` telemetry events are emitted by this command. Do not rely on analytics pipelines to detect `/radio` usage.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `nEf` | Radio command handler (AsyncFunction; Arbor `arbor_handler.name`) |
| `kK` | Open-URL dispatcher; validates scheme, detects platform, spawns launcher |
| `vL7` | URL scheme validator; throws Error for non-http/https URLs |
| `MY` | Secondary helper called by open-URL dispatcher (role not fully resolved at depth-2) |
| `h8` | Subprocess spawn entry point; delegates to `v_` |
| `v_` | Spawn wrapper; orchestrates child-process lifecycle |
| `jEH` | Low-level child-process spawn assembler; manages stdio, timeout, callbacks |
| `Y` | Forced-shutdown / abort handler; calls `process.exit` |
| `o44` | String conversion utility used in spawn path |
| `SO` | Helper called in spawn result path (role not fully resolved at depth-2) |
| `N` | Log-level / debug classifier; checks `H.includes`, `H.trim`, formats level string |
| `G8` | Helper called after spawn in `v_` (role not fully resolved at depth-2) |
| `yH` | Log sink / error reporter; writes to log buffer and calls `mi.logError` |
| `S6` | Context-store accessor entry point; delegates to `sF6` and `Y_` |
| `sF6` | Async-local store getter; calls `aF6.getStore`, falls back via `Ki` |
| `Y_` | Secondary context resolver; delegates to `zN` |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.