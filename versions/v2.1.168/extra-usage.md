---
type: feature-spec
feature: "extra-usage"
cc_version: "2.1.168"
updated: "2026-06-11"
tags: ["extra-usage", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.168 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/extra-usage`

> Analysis basis: CC v2.1.168 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.168

---

## Overview

`/extra-usage` is a hidden, legacy alias that was renamed to `/usage-credits`. When invoked, it delegates to the same underlying handler (`ht7`) that services the canonical `/usage-credits` command, rendering a JSX-based credits/usage display. Because it is marked hidden, it does not appear in command auto-complete or help listings.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `extra-usage` |
| description | `"Renamed to /usage-credits"` |
| isHidden | `true` |
| module_id | `Fr_` |
| load_inline | `true` |
| loc_byte | `9391771` |
| loc_byte_end | `9391956` |
| loc_line | `4390` |
| arbor_handler.name | `ht7` |
| arbor_handler.fqn | `claude-2.1.168::ht7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.168 bundle.js:+9391771

---

## Input Branching

Two primary paths exist: the legacy entry-point (`St7`) that wraps the canonical handler, and the canonical handler (`ht7`) itself. The flow is essentially linear — the legacy wrapper resolves a promise and immediately forwards to the same rendering pipeline as `/usage-credits`.

```
1. User invokes /extra-usage
2. Load entry-point St7 resolves via Promise.resolve (bundle.js:+9391019)
3. St7 delegates to Ur_ (locale/context helper) and then to H (render host) (bundle.js:+9391049, +9391069)
4. Arbor-resolved handler ht7 is the true async function; it calls Promise.resolve,
   then NI6 (data-fetch helper), A (data transform), and H (render host) (bundle.js:+9390768–+9390827)
5. H renders the JSX column layout (literal "column" at bundle.js:+9390926;
   literal "text" at bundle.js:+9391085)
```

Because only two branches exist (legacy wrapper → canonical handler), numbered pseudocode is used instead of a Mermaid flowchart.

---

## Behavioral Spec

### Handler Dispatch (Legacy Alias → Canonical Handler)

Analysis basis: CC v2.1.168 bundle.js:+9391019

```
async function legacyEntryPoint(context):
    // St7 — load-inline wrapper
    result = await Promise.resolve()          // bundle.js:+9391019
    localeOrContext = localeHelper(context)   // Ur_  bundle.js:+9391049
    return renderHost(localeOrContext)        // H    bundle.js:+9391069
```

The Arbor-resolved canonical handler (`ht7`, `claude-2.1.168::ht7`) is an `AsyncFunction` reached via `module_id` resolution (`Fr_`). The `load_inline` flag confirms the handler is inlined as `Promise.resolve({call: ht7})` rather than being dynamically imported.

### Canonical Usage/Credits Rendering

Analysis basis: CC v2.1.168 bundle.js:+9390768

```
async function usageCreditsHandler(context):       // ht7
    await Promise.resolve()                        // bundle.js:+9390768
    data = await dataFetcher(context)              // NI6  bundle.js:+9390798
    transformed = dataTransformer(data)            // A    bundle.js:+9390818
    return renderHost(transformed, context)        // H    bundle.js:+9390827
```

The render host (`H`) composes a JSX layout. Observed layout literals confirm:
- Layout orientation: `"column"` (bundle.js:+9390926)
- Content node type: `"text"` (bundle.js:+9391085)

### Bootstrap / Data Fetch Sub-Pipeline

The render host `H` calls into a bootstrap-fetch sub-pipeline, visible in the call graph from `H`:

Analysis basis: CC v2.1.168 bundle.js:+15797656

```
function renderHost(data, context):               // H
    log("[Bootstrap] Fetching", ...)              // bundle.js:+15797658
    cachedValue = appStateMap.get(key)            // qA.get  bundle.js:+15797694
    if not cachedValue:
        fetch with headers:
            "Content-Type": "application/json"   // bundle.js:+15797743, +15797758
            "User-Agent": <agent string>          // bundle.js:+15797777
        timeout = 5000 ms                        // bundle.js:+15797859
    parseResult = modelParser(responseText)       // Y3, mj_  bundle.js:+15797790, +15797798
    if parse fails:
        emitTelemetry("api_bootstrap_fetch",      // bundle.js:+15797980
                      "parse_failed")             // bundle.js:+15798002
    else:
        log("[Bootstrap] Fetch ok")               // bundle.js:+15798032
    return renderJSX(parseResult)                 // o6  bundle.js:+15797977
```

### JSX Render and Telemetry Emission

Analysis basis: CC v2.1.168 bundle.js:+1011091

```
function renderJSX(parsedData):                   // o6
    emitTelemetry("tengu_feature_sad")            // bundle.js:+1011093
    layout = createLayout(parsedData)             // l   bundle.js:+1011091
    return columnContainer(layout)                // J6  bundle.js:+1011127
```

> Note: The telemetry event name `tengu_feature_sad` appears at bundle.js:+1011093. Its exact semantic meaning (error path, deprecation signal, or instrumentation stub) is not further resolvable within depth-2 traversal. Given that this command is a renamed/hidden alias, the event likely flags usage of a deprecated feature path.

### Model Name Normalization Sub-Pipeline

The call graph exposes a model-name normalization chain (`H9` → `s9` → `Y2`, `h4H`, `CI`, `DdH`, `bT`, `lP1`, `lM`, `NH8`, `wdH`) that operates on model identifiers. This sub-pipeline is shared infrastructure; the literals within it confirm the set of recognized model family strings:

Analysis basis: CC v2.1.168 bundle.js:+2247441

```
function normalizeModelName(rawName):             // s9
    trimmed = rawName.trim().toLowerCase()        // bundle.js:+2247412, +2247423
    resolved = resolveModelAlias(trimmed)         // Y2  bundle.js:+2247441
    if resolved contains "opusplan":              // bundle.js:+2247508
        return planningVariant(resolved)          // CI  bundle.js:+2247526  ("[1m]" suffix, bundle.js:+2247534)
    if resolved contains "sonnet":                // bundle.js:+2247549
        return sonnetVariant(resolved)            // DdH bundle.js:+2247603
    if resolved contains "haiku":                 // bundle.js:+2247588
        return haikuVariant(resolved)             // ... bundle.js:+2247641 (bT)
    if resolved contains "opus":                  // bundle.js:+2247627
        return opusVariant(resolved)              // lP1 bundle.js:+2247678
    if resolved == "best":                        // bundle.js:+2247664
        return bestVariant(resolved)              // lM  bundle.js:+2247696
    return fallback(resolved)                     // NH8, wdH
```

Provider context strings present in this pipeline:
- `"anthropic."` (bundle.js:+2241469)
- `"firstParty"` (bundle.js:+2243716)
- `"anthropicAws"` (bundle.js:+2101625)
- `"gateway"` (bundle.js:+2101645)
- `"mantle"` (bundle.js:+2244357)

### File I/O Sub-Pipeline (Transcript / Log Append)

The call graph includes a file-append chain (_iK → HiK) with filesystem operations. This is shared transcript/log infrastructure, not specific to `/extra-usage`:

Analysis basis: CC v2.1.168 bundle.js:+206082

```
function transcriptWriter(entry, config):         // _iK
    dir = path.dirname(outputPath)                // IHH.dirname  bundle.js:+206115
    rolledPath = buildRolledPath(dir, config)     // $0A  bundle.js:+206252
    fileStats = statFile(rolledPath)              // ll8  bundle.js:+206284
    byteLen = Buffer.byteLength(entry)            // bundle.js:+206290
    appendQueue = getOrCreateQueue()              // O0A  bundle.js:+206323
    appendQueue.then(appendHandler.bind(ctx))     // fB6.then, HiK.bind  bundle.js:+206340, +206349
    hookRegistry.register(cleanup)               // j9 → NPA.register  bundle.js:+206445

function appendHandler(entry):                   // HiK
    fs.mkdir(dir, {recursive: true})             // bundle.js:+205836
    fs.appendFile(path, entry)                   // bundle.js:+205895
    rotateLogs(...)                              // B76, $0A, ll8  bundle.js:+205927, +205944, +205982
    byteLen = Buffer.byteLength(entry)           // bundle.js:+205988
```

Log rotation constants observed:
- `.txt` suffix (bundle.js:+205511)
- Rotation chunk size: `4` (bundle.js:+205533)
- Error code `"EISDIR"` guarded during rotation (bundle.js:+175692)

### Batch/Queue Sub-Pipeline

Analysis basis: CC v2.1.168 bundle.js:+59783

```
function batchDispatcher(items):                 // npH
    clearTimeout(existingTimer)                  // bundle.js:+59783
    joined = queue.join(separator)               // $.join  bundle.js:+59857
    batchDelay = 1000 ms                         // bundle.js:+59671
    batchSize  = 100                             // bundle.js:+59692
    timer = setTimeout(flush, batchDelay)        // bundle.js:+59947
    queue.push(item)                             // bundle.js:+59982
    setImmediate(processNext)                    // bundle.js:+60040
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_sad` (bundle.js:+1011093) — emitted during JSX render; likely signals deprecated-alias usage |
| Telemetry (bootstrap) | `api_bootstrap_fetch` / `parse_failed` (bundle.js:+15797980, +15798002) — emitted on bootstrap fetch parse failure |
| Hook registration | `j9` → `NPA.register` (bundle.js:+206445) — registers a cleanup hook for the transcript append queue |
| appState changes | `qA.get` read (bundle.js:+15797694) — reads cached bootstrap data from app-state map |
| File I/O | `fs.appendFile`, `fs.mkdir`, `fs.rename`, `fs.unlink`, `fs.stat` — transcript/log append pipeline (`HiK`, `ll8`) |
| Network | Bootstrap HTTP fetch with `Content-Type: application/json`, `User-Agent` header; 5000 ms timeout (bundle.js:+15797743, +15797858) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Visibility | `isHidden: true` — command does not appear in help or auto-complete |

---

## Version History

| Version | Change |
|---|---|
| v2.1.168 | Initial analysis; command is a hidden alias for `/usage-credits` |

---

## Common Mistakes

1. **Invoking `/extra-usage` expecting independent behavior** — this command is a renamed alias; it routes through the identical handler (`ht7`) as `/usage-credits`. Prefer `/usage-credits` for all new scripts and documentation.
2. **Assuming the command is fully removed** — it is hidden (`isHidden: true`) but still registered and callable; it will execute without error, it just will not appear in `/help` output.
3. **Confusing `St7` (load-inline wrapper) with `ht7` (canonical handler)** — the Arbor resolution path is `module_id` → `Fr_` → `ht7`. The call graph also shows a parallel `St7` entry at byte `9391019`; `St7` is the load wrapper, not the functional handler. Use `ht7` as the authoritative entry when debugging.
4. **Expecting telemetry parity with `/usage-credits`** — because this alias path fires `tengu_feature_sad` (a deprecation-flavored event), telemetry dashboards may record it differently from direct `/usage-credits` invocations.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `ht7` | Canonical async handler for usage/credits display (Arbor-resolved; `claude-2.1.168::ht7`) |
| `St7` | Load-inline entry-point wrapper for `/extra-usage` (legacy alias loader) |
| `H` | Render host / JSX composition function |
| `v` | Inner render helper called by `H` |
| `snK` | Context/state normalizer within `v` |
| `IPA` | Sub-normalizer within `snK` |
| `RH` | JSON serialization helper (`JSON.stringify` wrapper) |
| `G4` | Path/string manipulation utility (extension extraction) |
| `K0A` | Array-map utility used by `G4` |
| `EUH` | Write-stream utility calling `nWA` |
| `nWA` | Low-level write helper (`H.write`) |
| `_iK` | Transcript writer / file-append orchestrator |
| `npH` | Batch/queue dispatcher with timeout and `setImmediate` |
| `YKH` | Sub-helper of `_iK`; calls `r76`, `IHH.join`, `t8`, `R6` |
| `d6` | Helper called within `_iK` (role not fully resolved at depth 2) |
| `B76` | Log rotation helper; guards `EISDIR` error |
| `$0A` | Rolled-path builder using `IHH.join` and `R6` |
| `ll8` | File-stat and rotation checker (`ny.stat`, `.txt` suffix, `ny.rename`, `ny.unlink`) |
| `HiK` | Async append handler (`fs.mkdir`, `fs.appendFile`, rotation) |
| `j9` | Hook registration wrapper → `NPA.register` |
| `Y3` | Bootstrap response processor |
| `mj_` | Response text parser (split/trim/indexOf/slice) |
| `lHH` | Cache-set membership checker (`o74.has`) |
| `uj` | String replace utility |
| `H9` | Model-name dispatch router |
| `m6H` | Model-name resolution sub-router |
| `Q0` | Model resolution helper (role: default case) |
| `aqH` | Model resolution helper (role not fully resolved at depth 2) |
| `qB` | Model string tokenizer/classifier |
| `s9` | Core model-name normalization function |
| `Y2` | Model alias resolver → `R4H` |
| `h4H` | Model family inclusion checker (`y4H.includes`) |
| `CI` | `opusplan` / `[1m]` variant handler |
| `DdH` | `sonnet` variant handler |
| `bT` | `haiku` / `opus` variant handler |
| `lP1` | `opus` best-effort delegator → `bT` |
| `lM` | Provider mapper (`anthropicAws`, `gateway`) |
| `NH8` | Fallback model matcher (`AKL.includes`) |
| `wdH` | Final fallback handler → `_6` |
| `FJ` | Model-name pipeline entry combining `s9` and `_G` |
| `_G` | Composite model descriptor builder |
| `o6` | JSX render function; emits `tengu_feature_sad` |
| `l` | Layout node factory |
| `J6` | Column container factory → `hm6` |
| `hm6` | Lowest-level JSX primitive constructor |
| `NI6` | Data-fetch helper called by canonical handler `ht7` |
| `Ur_` | Locale/context helper called by legacy wrapper `St7` |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.