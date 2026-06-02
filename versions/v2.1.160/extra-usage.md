---
type: feature-spec
feature: "extra-usage"
cc_version: "2.1.160"
updated: "2026-06-02"
tags: ["extra-usage", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.160 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/extra-usage`

> Analysis basis: CC v2.1.160 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.160

---

## Overview

`/extra-usage` is a hidden legacy alias that has been renamed to `/usage-credits`. The command is registered as a `local-jsx` type and delegates its rendering and logic entirely to the same handler used by `/usage-credits`. Because it is marked `isHidden: true`, it does not appear in the user-visible command palette; it exists solely for backwards compatibility with scripts or muscle-memory that reference the old name.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `extra-usage` |
| description | `"Renamed to /usage-credits"` |
| isHidden | `true` |
| module_id | `CQ_` |
| load_inline | `true` |
| loc_byte | `9237123` |
| loc_byte_end | `9237308` |
| loc_line | `4055` |
| arbor_handler.name | `cB7` |
| arbor_handler.fqn | `claude-2.1.160::cB7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.160 bundle.js:+9237123

---

## Input Branching

The command accepts no user-supplied arguments and has a simple linear dispatch: the registration is looked up, the inline load promise resolves, and the handler `cB7` is invoked. There are no argument-based branches; all branching occurs inside the shared `usage-credits` rendering pipeline reached via `cB7 → H`.

```
1. User types /extra-usage (no arguments expected or consumed)
2. CC resolves the load_inline promise (Promise.resolve at +9236120)
3. CC calls handler cB7 (AsyncFunction, module_id resolution)
4. cB7 delegates to the bootstrap-fetch helper (H at +9236179)
5. H fetches usage/credits data and renders the JSX component
6. Result is displayed identical to /usage-credits output
```

Analysis basis: CC v2.1.160 bundle.js:+9236120, +9236150, +9236170, +9236179

---

## Behavioral Spec

### Handler Entry Point (`cB7`)

`cB7` is the authoritative handler, resolved by Arbor via `module_id` → `CQ_`. It is an `AsyncFunction`.

```
async function extraUsageHandler(context):
    resolved = await Promise.resolve()          // inline load gate (+9236120)
    usageComponent = loadUsageComponent()       // wV6 (+9236150)
    appState = getAppState()                    // A  (+9236170)
    result = await bootstrapAndRender(appState) // H  (+9236179)
    return result
```

Analysis basis: CC v2.1.160 bundle.js:+9236120, +9236150, +9236170, +9236179

---

### Bootstrap Fetch Sub-routine (`H → N`)

`H` logs a bootstrap-fetch trace (`"[Bootstrap] Fetching"` at +15451800), then calls `N` to perform the actual network request with appropriate HTTP headers.

```
async function bootstrapFetch(appState):
    log("[Bootstrap] Fetching")                        // literal +15451800
    setHeader("Content-Type", "application/json")      // literal +15451885, +15451900
    setHeader("User-Agent", <agent-string>)            // literal +15451919
    response = await fetch(endpoint, {timeout: 5000})  // literal +15451991
    if parse fails:
        emitTelemetry("api_bootstrap_fetch", {status: "parse_failed"})  // literals +15452112, +15452134
        return error
    log("[Bootstrap] Fetch ok")                        // literal +15452164
    return parsedResponse
```

Analysis basis: CC v2.1.160 bundle.js:+15451800, +15451885, +15451900, +15451919, +15451991, +15452112, +15452134, +15452164

---

### Transcript / Log Write Sub-routine (`N → PmH → ZwA`)

After fetching, usage data may be written to a local log via the write helper chain.

```
function writeUsageLog(handle, data):
    serialized = JSON.stringify(data)  // SH +183798
    handle.write(serialized)           // ZwA → H.write +191795
```

Analysis basis: CC v2.1.160 bundle.js:+183798, +191795

---

### File-rotation Sub-routine (`rmK` family)

The transcript-logging path includes a file-rotation mechanism that manages log file size and rollover.

```
async function manageLogRotation(logDir):
    dir = path.dirname(logDir)                          // je.dirname +203769
    currentSize = Buffer.byteLength(currentContent)    // Buffer.byteLength +203943
    filePath = buildFilePath(dir)                      // gwA +203905
    stats = await fs.stat(filePath)                    // FwA → Hy.stat +203091

    if filePath ends with ".txt":                      // literal +203195
        slicedPath = filePath.slice(0, -4)             // H.slice +203206, literal 4 +203217
        await fs.rename(filePath, slicedPath)          // Hy.rename +203247
        // handle EISDIR error code if rename fails    // literal +174371
        await fs.unlink(oldFile)                       // Hy.unlink +203287

    await appendToLog(logDir, content)                 // imK → Hy.appendFile +203549
    await fs.mkdir(logDir, {recursive: true})          // imK → Hy.mkdir +203490

    scheduleFlush()                                    // QuH → setTimeout +58626
    registerShutdownHook()                             // O9 → HDA.register +59048
```

Analysis basis: CC v2.1.160 bundle.js:+203769, +203943, +203905, +203091, +203195, +203206, +203217, +174371, +203287, +203549, +203490, +58626, +59048

---

### Flush / Debounce Sub-routine (`QuH`)

The flush helper debounces writes using `clearTimeout` / `setTimeout` and `setImmediate`.

```
function scheduleFlush(pendingChunks, liveLines):
    clearTimeout(existingTimer)                    // clearTimeout +58462
    timer = setTimeout(doFlush, 1000)              // setTimeout +58626, literal 1000 +58350
    // capacity guard: max 100 pending items       // literal 100 +58371
    if pendingChunks.length >= 100:
        pendingChunks.push(chunk)                  // $.push +58661
        setImmediate(doFlush)                      // setImmediate +58719
    else:
        liveLines.push(chunk)                      // L.push +58810
    joinAndWrite(pendingChunks.join(""))           // $.join +58536, L.join +58580, J.join +58759
```

Analysis basis: CC v2.1.160 bundle.js:+58462, +58626, +58536, +58580, +58759, +58661, +58810, +58350, +58371

---

### Model-name Normalisation Sub-routine (`gq → K1`)

When rendering the usage display, model names are normalised from internal identifiers to display strings.

```
function normaliseModelName(rawName):
    trimmed = rawName.trim().toLowerCase()         // K1 → H.trim +2233677, _.toLowerCase +2233688

    // Provider classification
    if trimmed includes "anthropic.":              // literal +2227735
        provider = "firstParty"                    // literal +2229981

    // Tier classification (checked in order)
    if trimmed includes "opusplan":  return "opusplan"  // literal +2233773
    if trimmed includes "[1m]":      return "[1m]"      // literal +2233799
    if trimmed includes "sonnet":    return "sonnet"    // literal +2233814
    if trimmed includes "haiku":     return "haiku"     // literal +2233853
    if trimmed includes "opus":      return "opus"      // literal +2233892
    if trimmed is "best":            return "best"      // literal +2233929

    // Backend routing
    if provider is "anthropicAws":   route = "aws"      // literal +2048530
    if provider is "gateway":        route = "gateway"  // literal +2048550
    if provider is "mantle":         route = "mantle"   // literal +2230622

    // Sanitise for display: replace sensitive tokens with [REDACTED]
    display = trimmed.replace(sensitivePattern, "[REDACTED]")  // literal +196350
    return display
```

Analysis basis: CC v2.1.160 bundle.js:+2233677, +2233688, +2227735, +2229981, +2233773, +2233799, +2233814, +2233853, +2233892, +2233929, +2048530, +2048550, +2230622, +196350

---

### Debug Logging Guard (`N` → `"debug"` literal)

Before writing diagnostic output, the pipeline checks whether debug mode is active.

```
function maybeDebugLog(message, level):
    if currentLogLevel == "debug":    // literal +204223
        writeToDebugSink(message)
```

Analysis basis: CC v2.1.160 bundle.js:+204223

---

### Feature Deprecation Telemetry (`d` → `tengu_feature_sad`)

The legacy-alias path fires a single telemetry event to signal use of a deprecated feature name.

```
function reportDeprecatedFeatureUse():
    emit("tengu_feature_sad", {feature: "extra-usage"})  // +966258
```

Analysis basis: CC v2.1.160 bundle.js:+966258

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_sad` (bundle.js:+966258) — fired to record use of the deprecated `/extra-usage` alias |
| Telemetry (bootstrap) | `api_bootstrap_fetch` with status `"parse_failed"` on JSON parse error (bundle.js:+15452112, +15452134) |
| Hook registration | `HDA.register` called via `O9` (+59048) — registers a shutdown hook to flush pending log writes |
| File I/O | `Hy.appendFile`, `Hy.mkdir`, `Hy.rename`, `Hy.unlink` — log file creation, rotation, and cleanup |
| Timers | `clearTimeout` / `setTimeout` (1 000 ms debounce) and `setImmediate` for flush scheduling |
| appState changes | Reads app state via identifier `A` (+9236170); no confirmed writes identified within depth-2 traversal |
| Network | HTTP fetch to usage/credits endpoint with `Content-Type: application/json` header and 5 000 ms timeout |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.160 | Initial analysis; command present as hidden legacy alias for `/usage-credits` |

---

## Common Mistakes

1. **Typing `/extra-usage` expecting it to appear in autocomplete.** The command is `isHidden: true` and will not surface in the slash-command picker; use `/usage-credits` instead.
2. **Assuming the command has its own independent implementation.** All behaviour is provided by the shared `cB7` / `CQ_` module, which is identical to the `/usage-credits` handler. There is no separate code path.
3. **Passing arguments.** The command does not declare or consume any argument schema. Any text after `/extra-usage` is silently ignored.
4. **Expecting no telemetry side-effect.** Using this alias fires `tengu_feature_sad` to Anthropic's telemetry pipeline, flagging that a deprecated name was used. If minimising telemetry noise matters, prefer `/usage-credits`.
5. **Relying on this alias in automation scripts long-term.** `isHidden` combined with the `"Renamed to /usage-credits"` description signals intentional deprecation; the alias may be removed in a future release.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `lB7` | Load-wrapper function that resolves the inline `Promise` and returns the handler reference |
| `cB7` | Primary async handler for `/extra-usage` (Arbor-resolved via `module_id` → `CQ_`) |
| `H` | Bootstrap-fetch and render orchestrator |
| `N` | HTTP request executor within the bootstrap path |
| `lmK` | Log initialisation / setup helper |
| `ADA` | Auxiliary data aggregator called during log setup |
| `lbK` | Sub-helper invoked by `ADA` (role: <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->) |
| `nbK` | Sub-helper invoked by `ADA` (role: <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->) |
| `SH` | JSON serialisation wrapper (`JSON.stringify` delegator) |
| `x4` | Path / string sanitiser that redacts sensitive tokens |
| `xwA` | Mapping helper over a buffer/array (`BmK.map`) |
| `q` | File handle / path object; calls `ykK.unlinkSync` |
| `A` | App-state accessor; also used as a string with `toLowerCase` |
| `PmH` | Write-dispatch helper |
| `ZwA` | Low-level stream writer (`H.write`) |
| `rmK` | Log-rotation orchestrator |
| `QuH` | Debounced-flush scheduler (`clearTimeout` / `setTimeout` / `setImmediate`) |
| `R$H` | Rotation metadata builder (joins paths, reads byte offsets) |
| `d6` | Sub-helper in rotation path (role: <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->) |
| `A46` | Directory-error handler (catches `EISDIR`) |
| `gwA` | Log file path builder (`je.join`) |
| `FwA` | File-stats checker (`Hy.stat`, `Hy.rename`, `Hy.unlink`) |
| `imK` | Append-and-rotate executor (`Hy.mkdir`, `Hy.appendFile`) |
| `dwA` | Buffer/data preparation helper in rotation path |
| `O9` | Shutdown-hook registrar (`HDA.register`) |
| `o$` | Secondary state accessor within bootstrap orchestrator |
| `Ce` | Feature-flag / set-membership checker (`F64.has`) |
| `wj` | String replacement utility (`H.replace`) |
| `gq` | Model-name normalisation entry point |
| `GHH` | Model display-name formatter (calls `DN`, `p9H`, `ZA`, `lQ`) |
| `DN` | Model tier classifier sub-helper |
| `p9H` | Model provider classifier sub-helper |
| `lQ` | Model string parser (splits on separators, trims, checks prefixes) |
| `K1` | Core model-name resolver (trim → toLowerCase → tier match) |
| `C0` | Model-string transformation helper (`wKH`) |
| `DKH` | Exclusion-list checker (`zKH.includes`) |
| `dN` | Display-name builder variant A |
| `_gH` | Display-name builder variant B |
| `tT` | First-party model record constructor |
| `XDq` | Wrapper that calls `tT` for extended model types |
| `xM` | Provider-type resolver (`jA`) |
| `xa6` | Tier-inclusion checker (`Ss4.includes`) |
| `AgH` | Final display formatter (`FH`) |
| `yP` | Usage-line parser / aggregator |
| `R0` | Usage record constructor (assembles `EA`, `IHH`, `MzH`, `qgH`, model fields) |
| `t6` | Deprecated-feature telemetry emitter (`tengu_feature_sad`) |
| `d` | Low-level telemetry dispatch function |
| `SQ_` | Usage-credits component loader (resolved alongside `cB7`) |
| `wV6` | Component initialisation helper called inside `cB7` |
| `vu6` | Promise chain entry in rotation path |
| `QuH` | (see above — flush scheduler) |
| `Iu6` | Byte-offset calculator in rotation metadata |
| `n8` | Path normaliser in `R$H` |
| `y6` | Directory path resolver |
| `G8` | EISDIR-safe directory handler within `A46` |
| `V8` | Fallback handler in file-stats path |
| `_y` | Utility shared by `lmK` and `rmK` (role: <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->) |
| `cmK` | Sub-helper of `lmK` (role: <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->) |
| `er6` | Token-check helper in model-string parser |
| `HgH` | Sub-helper in `lQ` (role: <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->) |
| `PDq` | Sub-helper in `lQ` (role: <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->) |
| `ks4` | Sub-helper in `lQ` (role: <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->) |
| `DKH` | (see above — exclusion-list checker) |
| `ys4` | Sub-helper in `lQ` (role: <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->) |
| `EA` | Usage record field builder A |
| `IHH` | Usage record field builder B |
| `MzH` | Usage record field builder C |
| `qgH` | Usage record field builder D |
| `FX` | Usage record field builder E |
| `Jf` | Common record finaliser shared across model builders |
| `jA` | Provider-type constant resolver |
| `wKH` | Model-string transformation sub-function |
| `zKH` | Exclusion list array (checked via `.includes`) |
| `Ss4` | Tier inclusion list array (checked via `.includes`) |
| `FH` | Final display string formatter |
| `Gtf` | Sub-helper in bootstrap orchestrator (role: <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->) |
| `AR` | Sub-helper in request path (role: <!-- TODO: not found in depth-2 traversal; needs --depth 4 -->) |
| `BmK` | Buffer or array mapped by `xwA` |
| `ykK` | `fs`-like module providing `unlinkSync` |
| `Hy` | `fs/promises`-like module (`stat`, `rename`, `unlink`, `mkdir`, `appendFile`) |
| `je` | `path`-like module (`join`, `dirname`) |
| `HDA` | Process / shutdown event emitter (`HDA.register`) |
| `F64` | Feature-flag Set object (checked via `.has`) |
| `Y46` | Sub-helper in `N` path |
| `QuH` | (see flush scheduler — deduplicated) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.