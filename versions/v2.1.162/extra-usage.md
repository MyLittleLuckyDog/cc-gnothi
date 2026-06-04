---
type: feature-spec
feature: "extra-usage"
cc_version: "2.1.162"
updated: "2026-06-04"
tags: ["extra-usage", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.162 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/extra-usage`

> Analysis basis: CC v2.1.162 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.162

---

## Overview

`/extra-usage` is a hidden, legacy alias that has been renamed to `/usage-credits`. The command is registered as a `local-jsx` type and delegates immediately to the same handler as `/usage-credits`. Users should prefer `/usage-credits` going forward; this entry is retained in the bundle purely for backwards compatibility.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `extra-usage` |
| description | `"Renamed to /usage-credits"` |
| isHidden | `true` |
| module_id | `ul_` |
| load_inline | `true` |
| loc_byte | `9313257` |
| loc_byte_end | `9313442` |
| loc_line | `4244` |
| arbor_handler.name | `al7` |
| arbor_handler.fqn | `claude-2.1.162::al7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.162 bundle.js:+9313257

---

## Input Branching

The command follows a simple linear dispatch: it resolves its module via an inline `Promise.resolve` load and immediately forwards control to the real usage-credits handler. There are fewer than three distinct input branches, so numbered pseudocode is used here.

1. User types `/extra-usage` (with or without arguments).
2. The CLI resolves the `load_inline` module (`ul_`) via `Promise.resolve` and obtains the call target (handler `al7`).
3. `al7` is invoked as an `AsyncFunction` with the command context.
4. `al7` dispatches to the shared usage-credits rendering path (functions `hN6` and `A`/`H`).
5. Output is rendered as a JSX column layout (literal `"column"` at bundle.js:+9312412) with text content (literal `"text"` at bundle.js:+9312571).

---

## Behavioral Spec

### Command Registration and Load

The command is registered at bundle byte range `(9313257, 9313442)` as a hidden `local-jsx` entry. Its `load_inline: true` flag means no separate dynamic `import()` is issued; instead the module is delivered via an inline `Promise.resolve({call: al7})` pattern.

```
function loadExtraUsageHandler():
    module = await Promise.resolve({ call: usageCreditsHandler })
    return module.call   // resolves to al7
```

Analysis basis: CC v2.1.162 bundle.js:+9312505 (call-graph edge `sl7 → Promise.resolve`)

### Handler Dispatch (`al7`)

The Arbor-resolved handler `al7` is an `AsyncFunction` that mirrors the `/usage-credits` command handler. Upon invocation it:

1. Immediately resolves a `Promise` (no network I/O at this layer).
2. Delegates to the internal usage-data fetch helper (`hN6`) and a data-formatting function.
3. Passes the formatted result to the JSX layout renderer using a `"column"` container and `"text"` leaf nodes.

```
async function usageCreditsHandler(commandContext):
    await Promise.resolve()                    // micro-task yield
    rawData   = await fetchUsageData(hN6)      // hN6 = usage data fetcher
    formatted = formatUsageData(rawData)       // via A helper
    render(columnLayout(formatted))            // "column" / "text" literals
```

Analysis basis: CC v2.1.162 bundle.js:+9312254 (`al7 → Promise.resolve`), +9312284 (`al7 → hN6`), +9312304 (`al7 → A`), +9312313 (`al7 → H`)

### Bootstrap Fetch Sub-path (`H`)

The shared fetch helper (`H`) is also reached from the call graph. It performs an HTTP fetch annotated with `"[Bootstrap] Fetching"` in debug logs, sets `Content-Type: application/json` and a `User-Agent` header, enforces a 5000 ms timeout, and emits a `tengu_feature_sad` telemetry event on parse failure.

```
async function bootstrapFetch(url, options):
    log("[Bootstrap] Fetching", url)           // bundle.js:+15590993
    headers = {
        "Content-Type": "application/json",   // bundle.js:+15591078
        "User-Agent":    <agent-string>        // bundle.js:+15591112
    }
    response = await fetch(url, { headers, timeout: 5000 })   // bundle.js:+15591194
    if parseFails:
        emit("api_bootstrap_fetch", { result: "parse_failed" })  // bundle.js:+15591315
        return null
    log("[Bootstrap] Fetch ok")                // bundle.js:+15591367
    return response
```

Analysis basis: CC v2.1.162 bundle.js:+15590991 (`H → v`), +15591315 (`t6` telemetry event)

### File-write / Logging Sub-path (`EgK`)

The call graph shows that the shared write-to-disk subsystem (`EgK`) is reachable from the main dispatch chain. This subsystem:

- Resolves the output directory via `path.dirname` and `path.join`.
- Checks file size via `Buffer.byteLength`, appending to an existing log file when below threshold and rotating when above.
- Rotation: renames the current file (appending `.txt` suffix — bundle.js:+204765), then unlinks the old copy.
- Schedules batched writes using `setTimeout` / `clearTimeout` / `setImmediate` with a 1000 ms debounce (bundle.js:+59425) and a 100-item queue limit (bundle.js:+59446).
- Registers a cleanup hook via `jJA.register` (bundle.js:+60123).

```
async function writeToLog(entry, context):
    dir      = path.dirname(resolveLogPath())
    fullPath = path.join(dir, resolveFilename())
    size     = Buffer.byteLength(entry)         // bundle.js:+205513
    if shouldRotate(size):
        rotate(fullPath)                         // rename → .txt, unlink old
    else:
        await mkdir(dir, { recursive: true })
        await appendFile(fullPath, entry)
    scheduleFlush(debounceMs=1000, maxQueue=100)
```

Analysis basis: CC v2.1.162 bundle.js:+205306 (`EgK → dmH`), +205513 (`EgK → Buffer.byteLength`), +204765 (`.txt` literal), +59425 (1000 ms), +59446 (100 items)

### Model-resolution Sub-path (`a1` / `qq`)

The command's shared context helpers resolve the active model string before rendering. The resolution checks for shorthand aliases in this priority order:

| Alias string | Maps to |
|---|---|
| `"opusplan"` | Opus-plan model (bundle.js:+2240470) |
| `"[1m]"` | 1-million-context variant (bundle.js:+2240496) |
| `"sonnet"` | Sonnet family (bundle.js:+2240511) |
| `"haiku"` | Haiku family (bundle.js:+2240550) |
| `"opus"` | Opus family (bundle.js:+2240589) |
| `"best"` | Best-available selection (bundle.js:+2240626) |

Provider strings checked: `"firstParty"` (bundle.js:+2236678), `"anthropicAws"` (bundle.js:+2094587), `"gateway"` (bundle.js:+2094607), `"mantle"` (bundle.js:+2237319).

Analysis basis: CC v2.1.162 bundle.js:+2236454 (`a1 → oHH`), +2240374 (`qq`)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_sad` emitted on bootstrap-fetch parse failure (bundle.js:+1008376); `api_bootstrap_fetch` event with `parse_failed` result (bundle.js:+15591337) |
| Hook registration | `jJA.register` called by log-write subsystem for process-exit cleanup (bundle.js:+60123) |
| appState changes | None directly; usage data display is read-only |
| File I/O | Log rotation and append via `fs.appendFile`, `fs.mkdir`, `fs.rename`, `fs.unlink` (reachable via `EgK` / `GgK`) |
| Sound | None detected |
| Network | HTTP fetch with 5000 ms timeout, `Content-Type: application/json`, User-Agent header |
| Render output | JSX `"column"` layout containing `"text"` nodes (bundle.js:+9312412, +9312571) |
| Visibility | Hidden (`isHidden: true`); does not appear in `/help` listing |

---

## Version History

| Version | Change |
|---|---|
| v2.1.162 | Initial analysis; command already marked hidden with description "Renamed to /usage-credits" |

---

## Common Mistakes

1. **Using `/extra-usage` intentionally** — this command is hidden and deprecated. Use `/usage-credits` instead; `/extra-usage` may be removed in a future version without notice.
2. **Expecting distinct behavior** — `/extra-usage` delegates to the exact same `al7` handler as `/usage-credits`. There is no behavioral difference between the two at runtime.
3. **Passing arguments** — the call graph shows no argument-parsing logic specific to this alias. Any arguments are forwarded as-is to the shared handler, whose argument handling is defined by `/usage-credits`.
4. **Assuming the command is discoverable** — `isHidden: true` means it will not appear in auto-complete or `/help` output, which can cause confusion when searching for available commands.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `sl7` | Inline load shim; wraps `Promise.resolve({call: al7})` for `extra-usage` |
| `al7` | Primary async handler for `/extra-usage` (= `/usage-credits` handler); Arbor-resolved |
| `H` | Bootstrap HTTP fetch dispatcher |
| `v` | Core fetch implementation called by `H` |
| `PgK` | Fetch options builder |
| `PJA` | Header construction helper |
| `SH` | JSON serialization wrapper (`JSON.stringify`) |
| `V4` | Path/string manipulation utility |
| `rXA` | Array map helper for path segments |
| `q` | File unlink / queue utility |
| `A` | Lowercase / slice string helper |
| `WpH` | Write-stream dispatcher |
| `pXA` | Low-level `H.write` wrapper |
| `EgK` | Log-write orchestrator (size check, rotate, append) |
| `dmH` | Debounced flush scheduler (setTimeout/clearTimeout/setImmediate) |
| `E3H` | Log entry formatter |
| `i6` | Internal path resolver |
| `zL6` | EISDIR error handler |
| `_PA` | Path join helper for log files |
| `HPA` | File-rotation executor (rename → `.txt`, unlink) |
| `GgK` | Directory-create-and-append helper (`mkdir` + `appendFile`) |
| `J9` | Process-exit hook registrar (`jJA.register`) |
| `_3` | Context extraction helper |
| `AY_` | Argument string splitter/trimmer |
| `LHH` | Feature-flag set membership check (`Y94.has`) |
| `bJ` | String replacement utility |
| `a1` | Model-string resolution entry point |
| `oHH` | Model alias dispatcher |
| `k0` | Model prefix extractor |
| `OqH` | Model family classifier |
| `Dd` | Model string parser (prefix checks, alias table) |
| `qq` | Model alias normaliser (toLowerCase, alias map lookup) |
| `Q0` | Model registry lookup (`BKH`) |
| `pKH` | Model inclusion checker (`mKH.includes`) |
| `qI` | Model variant resolver (`UM` + `G5`) |
| `LQH` | Model list helper (`G5`) |
| `PE` | First-party provider resolver |
| `RJ1` | Provider chain helper |
| `UM` | AWS/gateway provider mapper (`wA`) |
| `Xt6` | Context-size inclusion checker (`z8L.includes`) |
| `fQH` | Token-budget helper (`tH`) |
| `rX` | Full model-resolution pipeline |
| `g0` | Model selection aggregator |
| `t6` | Telemetry event emitter (`tengu_feature_sad`) |
| `c` | Telemetry transport |
| `Z6` | Event dispatch wrapper |
| `Zx6` | Low-level event queue |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.