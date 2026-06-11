---
type: feature-spec
feature: "extra-usage"
cc_version: "2.1.169"
updated: "2026-06-11"
tags: ["extra-usage", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.169 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/extra-usage`

> Analysis basis: CC v2.1.169 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.169

---

## Overview

`/extra-usage` is a **hidden, deprecated alias** for the `/usage-credits` command. Its registration description explicitly states it has been renamed, and the command is flagged `isHidden: true`, preventing it from appearing in user-facing help menus or autocomplete. The underlying handler (`MKf`) resolves to the same JSX-returning async function that powers the credits/usage display flow.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `extra-usage` |
| description | `"Renamed to /usage-credits"` |
| isHidden | `true` |
| module_id | `$e_` |
| load_inline | `true` |
| loc_byte | `9564381` |
| loc_byte_end | `9564566` |
| loc_line | `4123` |
| arbor_handler.name | `MKf` |
| arbor_handler.fqn | `claude-2.1.169::MKf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.169 bundle.js:+9564381

---

## Input Branching

The command has a linear dispatch flow — the alias registration resolves immediately to the shared handler. There are fewer than 3 distinct top-level branches at the slash-command entry point itself; the branching lives inside the shared bootstrap/render pipeline reached via the handler.

```
1. User types /extra-usage (optionally with arguments)
2. CLI looks up command by name → finds hidden registration at byte 9564381
3. Registration has load_inline:true → handler resolved as MKf (via module_id $e_)
4. MKf is invoked as an AsyncFunction
5. MKf calls Promise.resolve, then Ih6, then A, then H (the bootstrap/fetch/render pipeline)
6. H performs a bootstrap fetch and returns JSX content for display
7. Output rendered as "text" / "column" layout to the terminal
```

Analysis basis: CC v2.1.169 bundle.js:+9564381 (registration), +9563378 (MKf call graph entry)

---

## Behavioral Spec

### Alias Resolution

The command name `extra-usage` is registered with `isHidden: true` and the description `"Renamed to /usage-credits"`. It does not appear in `/help` output or tab completion. It remains callable directly but is considered a legacy entry point.

Analysis basis: CC v2.1.169 bundle.js:+9564381

### Handler Dispatch — `MKf` (AsyncFunction)

The Arbor symbol graph resolves the handler as `MKf` via `module_id → $e_`. The callGraph confirms `MKf` calls `Promise.resolve` (immediate resolution path), followed by `Ih6` (an initialisation or data-fetch helper), `A` (a data/state accessor), and `H` (the primary bootstrap-and-render pipeline).

```
async function handleExtraUsage(context):
    await Promise.resolve()          // yield to event loop
    result = await initialiseHelper(context)   // Ih6
    data   = accessState(result)               // A
    output = await bootstrapAndRender(data)    // H
    return output
```

Analysis basis: CC v2.1.169 bundle.js:+9563378, +9563408, +9563428, +9563437

### Bootstrap Fetch Pipeline — `H`

`H` is the shared bootstrap-and-render function also used by `/usage-credits`. Its behaviour:

```
async function bootstrapAndRender(data):
    log("[Bootstrap] Fetching", ...)           // literal at +16097956
    response = MA.get(cacheKey)               // check cache
    if not cached:
        fetch with headers:
            "Content-Type": "application/json"  // +16098041, +16098056
            "User-Agent":   <ua-string>          // +16098075
        timeout = 5000 ms                        // +16098157
    parsed = parseResponse(response)
    if parse fails:
        emitTelemetry("api_bootstrap_fetch", "parse_failed")  // +16098278, +16098300
    else:
        log("[Bootstrap] Fetch ok", ...)         // +16098330
    return renderJSX(parsed, layout="text"|"column")
```

Layout constants `"text"` (+9563695) and `"column"` (+9563536) are passed to the JSX renderer.

Analysis basis: CC v2.1.169 bundle.js:+16097954, +16097956, +16098041, +16098056, +16098075, +16098157, +16098278, +16098300, +16098330, +9563695, +9563536

### Command-Line Argument Parsing — `w2_`

Arguments supplied after `/extra-usage` are passed through the shared argument-parsing helper `w2_`, which:

```
function parseCommandArgs(rawInput):
    parts = rawInput.split(delimiter)      // +2984790
    for each part:
        trimmed = part.trim()              // +2984829
        idx = trimmed.indexOf("=")         // +2984853
        if idx >= 0:
            value = trimmed.slice(idx+1)   // +2984893
    return parsedArgs
```

Analysis basis: CC v2.1.169 bundle.js:+2984790, +2984829, +2984853, +2984893

### Model String Normalisation — `c9` / `M9`

The pipeline includes a model-name normalisation step (shared with the broader CLI). Recognised model aliases and their internal tokens:

| Input alias | Internal token (literal) |
|---|---|
| `"opusplan"` | opusplan (+2252174) |
| `"[1m]"` suffix | 1m model variant (+2252200) |
| `"sonnet"` | sonnet (+2252215) |
| `"haiku"` | haiku (+2252254) |
| `"opus"` | opus (+2252293) |
| `"best"` | best (+2252330) |

Provider routing literals also present: `"anthropicAws"` (+2105867), `"gateway"` (+2105887), `"mantle"` (+2249023), `"firstParty"` (+2248333), `"anthropic."` prefix (+2246054).

Analysis basis: CC v2.1.169 bundle.js:+2252174, +2252200, +2252215, +2252254, +2252293, +2252330, +2105867, +2105887, +2249023, +2248333, +2246054

### Transcript / File Writing — `StK` / `htK`

The shared pipeline includes a transcript-append path used for session logging:

```
async function appendToTranscript(sessionData, content):
    dir = path.dirname(transcriptPath)         // +208436
    await fs.mkdir(dir, {recursive: true})     // +208157
    await fs.appendFile(transcriptPath, chunk) // +208216
    byteLen = Buffer.byteLength(chunk)         // +208309, +208611
    if byteLen exceeds rotation threshold:
        rotateLogs(transcriptPath)             // Vo8 at +208605
    hookRegistry.register(cleanup)             // Z9 → ZGA.register at +62328
```

File rotation (`Vo8`) checks for a `.txt` suffix (+207832), uses a slice offset of 4 (+207854), performs `fs.stat` (+207728), `fs.rename` (+207884), and `fs.unlink` (+207924).

Error code `"EISDIR"` (+178013) is handled in directory-creation error paths.

Analysis basis: CC v2.1.169 bundle.js:+208157, +208216, +208309, +208436, +208605, +208611, +62328, +207728, +207832, +207854, +207884, +207924, +178013

### Feature-Sad Telemetry Path — `o6`

A secondary call path from `H` leads to `o6`, which fires a `tengu_feature_sad` telemetry event (+1014069). This path is triggered when the command's feature state is evaluated as degraded or unsupported.

```
function evaluateFeatureState(featureFlags):
    if feature is unavailable or deprecated:
        emitTelemetry("tengu_feature_sad")   // +1014069
        return degradedView(featureFlags)
    return normalView(featureFlags)
```

Analysis basis: CC v2.1.169 bundle.js:+1014067, +1014069

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_sad` (bundle.js:+1014069) — fired when feature is evaluated as unavailable/degraded |
| Telemetry (bootstrap) | `api_bootstrap_fetch` with label `parse_failed` (+16098278, +16098300) — fired on JSON parse failure of bootstrap response |
| Hook registration | `ZGA.register` called via `Z9` (+62328) — registers a cleanup/teardown hook for the transcript writer |
| File I/O | Transcript append via `fs.appendFile` (+208216); directory creation via `fs.mkdir` (+208157); log rotation via `fs.rename` / `fs.unlink` (+207884, +207924) |
| Cache read | `MA.get` (+16097992) — bootstrap response cache lookup |
| Timer usage | `setTimeout` (+61906), `clearTimeout` (+61742), `setImmediate` (+61999) used inside the batched output writer (`TBH`) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Visibility | Command is hidden (`isHidden: true`) — does not appear in `/help` or autocomplete |

---

## Version History

| Version | Change |
|---|---|
| v2.1.169 | Initial analysis — command present as hidden alias for `/usage-credits` |

---

## Common Mistakes

1. **Using `/extra-usage` expecting new behaviour** — this command is a deprecated alias. Prefer `/usage-credits` for all current and future usage. The description field explicitly states the rename.
2. **Expecting the command in autocomplete or `/help`** — `isHidden: true` suppresses it from all discovery surfaces; it must be typed exactly.
3. **Assuming it has its own handler** — the `arbor_handler.n_hits` is `0` and resolution is via `module_id`, meaning the handler `MKf` is shared infrastructure. Any breakage in the shared bootstrap pipeline affects this alias equally.
4. **Passing model alias arguments** — the argument normalisation pipeline is present but the command's primary purpose is displaying usage/credits data, not selecting a model; model alias literals in the call graph are from shared plumbing, not command-specific logic.
5. **Relying on this alias in scripts** — because it is hidden and marked as renamed, it may be removed in a future version without a separate deprecation notice.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `MKf` | Primary handler (AsyncFunction) for `/extra-usage` — resolved via Arbor from module_id `$e_` |
| `$Kf` | Load-inline wrapper; calls `Promise.resolve`, `fe_`, and `H` |
| `H` | Bootstrap-and-render pipeline; performs fetch, cache lookup, and JSX output |
| `N` | Inner dispatch / argument routing function within bootstrap pipeline |
| `ItK` | Argument initialisation helper |
| `vGA` | Sub-initialiser; calls `yoK` and `hoK` |
| `CH` | JSON serialisation helper (calls `JSON.stringify`) |
| `R4` | String/path formatting utility; uses `replace`, `at`, `lastIndexOf`, `slice` |
| `qZA` | Array mapping helper for path segments (`ZtK.map`) |
| `q` | Data stream / chunk accessor (calls `$1`) |
| `A` | Lowercase path builder (`f.toLowerCase`) |
| `rBH` | Write-dispatch helper; calls `lEA` |
| `lEA` | Low-level write wrapper (`H.write`) |
| `StK` | Transcript session writer; orchestrates mkdir, appendFile, rotation, hook registration |
| `TBH` | Batched output flusher; uses `setTimeout`, `clearTimeout`, `setImmediate`, `join`, `push` |
| `_4H` | Path assembly helper; calls `_M6`, `P6H.join`, `A_`, `I6` |
| `l6` | Auxiliary state accessor used by transcript writer |
| `n56` | Directory error handler; checks for `"EISDIR"` error code |
| `MZA` | Path join helper for transcript directory (`P6H.join`, `I6`) |
| `Vo8` | Log rotation handler; uses `fs.stat`, `fs.rename`, `fs.unlink`, `.txt` suffix check |
| `htK` | Transcript append executor; calls mkdir, appendFile, rotation, byte-length check |
| `Z9` | Hook registration dispatcher (`ZGA.register`) |
| `P$` | Post-fetch processor in bootstrap pipeline |
| `w2_` | Command argument parser (split, trim, indexOf, slice) |
| `u6H` | Feature-flag set membership check (`vO4.has`) |
| `n3` | Text replacement utility (`H.replace`) |
| `M9` | Model resolution entry point; delegates to `Cc`, `c9`, `eD` |
| `Cc` | Model string parser; calls `tY`, `pU`, `FA`, `CC` |
| `tY` | Model token helper (called from `Cc`) |
| `pU` | Model token helper (called from `Cc`) |
| `CC` | Model string normaliser; trims, maps, checks prefixes and includes |
| `c9` | Model alias resolver; normalises alias strings, routes to `Mk`, `QcH`, `AE`, `dG1`, `zM` |
| `u2` | Sub-resolver helper; calls `ZLH` |
| `TLH` | Model family inclusion check (`GLH.includes`) |
| `Mk` | Model variant matcher; calls `zM`, `F5` |
| `QcH` | Model variant matcher (alternative path); calls `F5` |
| `AE` | Model descriptor builder; calls `zM`, `F5`, `YA` |
| `dG1` | Model descriptor delegator; calls `AE` |
| `zM` | Provider type resolver; returns `"anthropicAws"` / `"gateway"` via `YA` |
| `__8` | Model list inclusion check (`Q5L.includes`) |
| `dcH` | Fallback model resolver; calls `_6` |
| `eD` | Extended model resolution; calls `c9` and `hG` |
| `hG` | Full model descriptor assembler; calls `yA`, `h8H`, `cDH`, `ccH`, `AE`, `x2`, `zM`, `YA`, `F5`, `Mk` |
| `o6` | Feature state evaluator; emits `tengu_feature_sad` and calls `K6` |
| `d` | Feature flag data accessor |
| `K6` | Feature view renderer; calls `c76` |
| `c76` | Low-level view construction helper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.