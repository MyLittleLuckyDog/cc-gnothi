---
type: feature-spec
feature: "callback"
cc_version: "2.1.169"
updated: "2026-06-11"
tags: ["callback", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.169 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/callback`

> Analysis basis: CC v2.1.169 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.169

---

## Overview

The `/callback` command is a registration-type handler that processes callback-type command objects dispatched internally by the Claude Code runtime. Rather than representing a user-facing interactive slash command, it functions as a programmatic entry point that maps over a collection of pending callback descriptors, dispatches each through a multi-stage processing pipeline, and resolves or rejects their associated continuation logic. Its handler (`jsf`) bridges command-dispatch infrastructure with bootstrap fetch, model resolution, and file I/O sub-systems.

---

## Registration

| Field | Value |
|---|---|
| type | `callback` |
| name | `callback` |
| description | `null` |
| loc_byte | `13506964` |
| loc_byte_end | `13506997` |
| loc_line | `10758` |
| arbor_handler.name | `jsf` |
| arbor_handler.fqn | `claude-2.1.169::jsf` |
| arbor_handler.kind | `Function` |
| arbor_handler.resolution_path | `direct` (symbol falls inside the registration byte range) |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.169 bundle.js:+13506964

---

## Input Branching

The call graph from `jsf` fans out into more than three distinct processing branches (bootstrap fetch path, model-string normalisation path, command-type dispatch path, file I/O / log-rotation path, and hook registration path). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/callback invoked\njsf entry-point]) --> B[Map over pending callback descriptors\nH.map]

    B --> C{Determine callback\ndescriptor type}

    C -- type == 'command'\nbundle.js:+13506608 --> D[Dispatch via command\npipeline: commandDispatch]

    C -- type == 'prompt' / 'agent'\nbundle.js:+12596519 --> E[Model string\nnormalisation: modelNormalise]

    C -- type == 'http'\nbundle.js:+12596576 --> F[Bootstrap fetch\npipeline: bootstrapFetch]

    C -- type == 'mcp_tool'\nbundle.js:+12596600 --> G[MCP tool\ncallback handler]

    C -- type == 'callback'\nbundle.js:+12596662 --> H2[Self-referential\ncallback re-entry]

    C -- type == 'unknown'\nbundle.js:+13507010 --> I[Emit tengu_feature_sad\ntelemetry & surface error]

    D --> J[commandDispatch:\nparse args → sanitise → format]
    J --> J1[argParser: split / trim / indexOf / slice\nbundle.js:+2984790]
    J --> J2[commandSanitiser: replace redacted tokens\nbundle.js:+200573]
    J --> J3[commandFormatter: toUpperCase / trim\nbundle.js:+209017]

    E --> K[modelNormalise:\nresolve model alias]
    K --> K1[modelAliasList: opusplan / sonnet /\nhaiku / opus / best\nbundle.js:+2252174]
    K --> K2[providerCheck: firstParty /\nanthropicAws / gateway / mantle\nbundle.js:+2248333]

    F --> L[bootstrapFetch:\nGET with Content-Type + User-Agent\nbundle.js:+16097956]
    L --> L1{HTTP response\nok?}
    L1 -- yes --> L2[Parse JSON\nbundle.js:+16098330]
    L1 -- no / parse fail --> L3[Emit api_bootstrap_fetch\nparse_failed telemetry\nbundle.js:+16098278]
    L --> L4[Timeout: 5000 ms\nbundle.js:+16098157]

    J3 --> M[fileIOAndLogRotation:\nappendFile / rename / unlink\nbundle.js:+208216]
    M --> M1[Compute byte length\nbundle.js:+208611]
    M --> M2{Exceeds\nrotation limit?}
    M2 -- yes --> M3[rotateLogs: rename .txt →\narchive, unlink oldest\nbundle.js:+207884]
    M2 -- no --> M4[appendFile to\ncurrent log\nbundle.js:+208216]

    M --> N2[hookRegistration\nbundle.js:+62328]
    I --> Z([Return / reject])
    L3 --> Z
    L2 --> Z
    N2 --> Z
    M4 --> Z
    M3 --> Z
    G --> Z
    H2 --> Z
```

---

## Behavioral Spec

### 1. Entry Point — Callback Map Dispatch (`jsf`)

The handler `jsf` is the sole registered function for the `callback` command type. On invocation it iterates over a collection of pending callback descriptor objects using `H.map` and processes each one through the appropriate sub-pipeline determined by the descriptor's `type` field.

```
function callbackHandler(descriptors):
    results = descriptors.map(descriptor =>
        dispatchDescriptor(descriptor)
    )
    return results
```

Analysis basis: CC v2.1.169 bundle.js:+13506577, +13506608

---

### 2. Descriptor Type Dispatch (`commandDispatch`)

When a descriptor carries the literal type value `"command"` (bundle.js:+13506608), the command pipeline is entered. The pipeline is coordinated by the function identified as `N` in the bundle.

```
function commandDispatch(descriptor):
    rawInput = descriptor.payload

    if debugMode:
        log("debug", rawInput)          // literal "debug" bundle.js:+208891

    sanitised = sanitiseInput(rawInput) // redacts sensitive tokens
    upperCased = sanitised.toUpperCase()
    trimmed    = upperCased.trim()

    formatted  = formatCommand(trimmed)
    writeToLog(formatted)
    scheduleFileRotation(formatted)
    return formatted
```

Analysis basis: CC v2.1.169 bundle.js:+208891, +209017, +209040

---

### 3. Argument Parsing (`argParser` — `w2_`)

Before a command string reaches the dispatch layer, raw text is decomposed into positional arguments.

```
function argParser(rawString):
    parts = rawString.split(delimiter)
    for each part in parts:
        trimmed = part.trim()
        idx     = trimmed.indexOf(separator)
        if idx >= 0:
            yield trimmed.slice(0, idx), trimmed.slice(idx + 1)
        else:
            yield trimmed
```

Analysis basis: CC v2.1.169 bundle.js:+2984790, +2984829, +2984853, +2984893

---

### 4. Input Sanitisation and Token Redaction (`commandSanitiser` — `R4`)

Sensitive tokens within the command string are replaced before further processing. The literal string `"[REDACTED]"` (bundle.js:+200573) is the substitution target. The function also resolves the last meaningful path segment via `lastIndexOf` and `slice`.

```
function commandSanitiser(input):
    mapped   = tokenMap.map(token => token)   // via qZA
    replaced = input.replace(sensitivePattern, "[REDACTED]")
    lastIdx  = replaced.lastIndexOf(pathSep)
    segment  = replaced.slice(lastIdx)

    // index into token array: positions 2 (bundle.js:+200602) and
    // character window of 40 chars (bundle.js:+16533353)
    return { replaced, segment }
```

Analysis basis: CC v2.1.169 bundle.js:+200521, +200573, +200631, +200657, +200683

---

### 5. Model String Normalisation (`modelNormalise` — `M9` / `c9`)

When the descriptor type is `"prompt"` or `"agent"`, the model identifier string is normalised.

```
function modelNormalise(modelString):
    trimmed   = modelString.trim()
    lower     = trimmed.toLowerCase()

    // Alias resolution table (bundle.js:+2252174 – +2252330):
    alias_map = {
        "opusplan" -> resolved_opusplan_id,
        "[1m]"     -> resolved_1m_id,
        "sonnet"   -> resolved_sonnet_id,
        "haiku"    -> resolved_haiku_id,
        "opus"     -> resolved_opus_id,
        "best"     -> resolved_best_id,
    }

    if lower in alias_map:
        return alias_map[lower]

    // Provider-type check (bundle.js:+2248333):
    provider = resolveProvider(lower)
    // provider ∈ { "firstParty", "anthropicAws", "gateway", "mantle" }

    if provider == "anthropicAws" or provider == "gateway":
        return applyProviderPrefix(lower, provider)

    return applyDefaultNormalisation(lower)
```

Analysis basis: CC v2.1.169 bundle.js:+2252078, +2252174, +2248333, +2105867, +2249023

---

### 6. Bootstrap Fetch Pipeline (`bootstrapFetch` — `H` outer function at `16097954`)

When the descriptor type is `"http"`, the bootstrap fetch pipeline is invoked.

```
function bootstrapFetch(url):
    log("[Bootstrap] Fetching", url)   // bundle.js:+16097956

    headers = {
        "Content-Type": "application/json",   // bundle.js:+16098041
        "User-Agent":    userAgentString,      // bundle.js:+16098075
    }

    fetchPromise = fetch(url, { headers, timeout: 5000 })
                                               // 5000 ms bundle.js:+16098157

    response = await fetchPromise

    if not response.ok or parseFails:
        emitTelemetry("api_bootstrap_fetch", { status: "parse_failed" })
                                               // bundle.js:+16098278
        return error

    data = await response.json()
    log("[Bootstrap] Fetch ok")                // bundle.js:+16098330
    return data
```

Analysis basis: CC v2.1.169 bundle.js:+16097954, +16097956, +16098041, +16098056, +16098075, +16098157, +16098278, +16098330

---

### 7. File I/O and Log Rotation (`fileIOManager` — `StK`)

After command processing, output is persisted and the log file is optionally rotated.

```
function fileIOManager(content, logDir):
    logPath  = path.join(logDir, currentLogFile)   // via MZA bundle.js:+208573
    byteLen  = Buffer.byteLength(content)           // bundle.js:+208611

    mkdir(logDir, { recursive: true })             // bundle.js:+208157
    appendFile(logPath, content)                   // bundle.js:+208216

    if shouldRotate(logPath):
        rotateLog(logPath)
    
    registerHook(logDir)                           // via Z9 → ZGA.register bundle.js:+62328

function rotateLog(logPath):
    stat = fs.stat(logPath)                        // bundle.js:+207728

    if logPath.endsWith(".txt"):                   // literal ".txt" bundle.js:+207832
        archivePath = logPath.slice(0, -4) + archiveSuffix
                                                   // slice param 4 bundle.js:+207854
        fs.rename(logPath, archivePath)            // bundle.js:+207884
    
    // handle EISDIR errors gracefully             // literal "EISDIR" bundle.js:+178013
    fs.unlink(oldestArchive)                       // bundle.js:+207924
```

Analysis basis: CC v2.1.169 bundle.js:+208157, +208216, +208309, +208436, +208573, +208611, +207728, +207832, +207854, +207884, +207924, +62328

---

### 8. Debounced Write Scheduler (`debouncedWriter` — `TBH`)

Writes to the file system are debounced to batch rapid successive callbacks.

```
function debouncedWriter(chunks, labels):
    clearTimeout(existingTimer)                    // bundle.js:+61742

    pendingChunks.push(newChunk)                   // bundle.js:+61941
    pendingLabels.push(newLabel)                   // bundle.js:+62090

    if pendingChunks.length >= 100:                // limit 100 bundle.js:+61651
        flushImmediately()                         // setImmediate bundle.js:+61999
        return

    timer = setTimeout(flush, 1000)                // 1000 ms bundle.js:+61630

function flush():
    combined = pendingChunks.join(joinChar)        // bundle.js:+61816
    labelStr = pendingLabels.join(joinChar)        // bundle.js:+61860
    write(combined, labelStr)
```

Analysis basis: CC v2.1.169 bundle.js:+61630, +61651, +61742, +61816, +61860, +61941, +61999, +62039, +62090

---

### 9. Error / Unknown Descriptor Path (`errorHandler` — `o6`)

When the descriptor type resolves to `"unknown"` (bundle.js:+13507010), the error handler fires and emits a failure telemetry event.

```
function errorHandler(descriptor):
    emitTelemetry("tengu_feature_sad", {
        context: descriptor,
    })                                              // bundle.js:+1014069
    surfaceError(descriptor)
    return null
```

Analysis basis: CC v2.1.169 bundle.js:+1014067, +1014069, +13507010

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_sad` (bundle.js:+1014069) — fired on unknown/unresolvable descriptor type; `api_bootstrap_fetch` / `parse_failed` (bundle.js:+16098278) — fired on HTTP bootstrap parse failure |
| Hook registration | `ZGA.register` called after file I/O completes (bundle.js:+62328); associates log directory with a lifecycle hook |
| File system writes | `fs.appendFile` to current log (bundle.js:+208216); `fs.mkdir` with `recursive:true` (bundle.js:+208157); `fs.rename` on rotation (bundle.js:+207884); `fs.unlink` of oldest archive (bundle.js:+207924) |
| Debounce timer | `setTimeout` at 1000 ms (bundle.js:+61630); `clearTimeout` on re-entry (bundle.js:+61742); `setImmediate` when chunk count ≥ 100 (bundle.js:+61999) |
| Model alias resolution | Alias table normalises `opusplan`, `sonnet`, `haiku`, `opus`, `best`, `[1m]` into canonical model identifiers (bundle.js:+2252174–+2252330) |
| JSON serialisation | `JSON.stringify` used inside `CH` for debug/log formatting (bundle.js:+187585) |
| Console/debug log | String literal `"debug"` (bundle.js:+208891) written to output when debug mode is active |

---

## Version History

| Version | Change |
|---|---|
| v2.1.169 | Initial analysis |

---

## Common Mistakes

1. **Treating `/callback` as a user-facing command.** The `description` field is `null` and the type is `callback`, indicating it is a programmatic internal dispatcher, not a command users invoke manually from the CLI prompt.
2. **Assuming synchronous execution.** The handler maps over descriptors but internally relies on `setTimeout`/`setImmediate` debouncing and `Promise`-based file I/O; callers must await resolution rather than consuming the return value synchronously.
3. **Ignoring the 1000 ms debounce window.** Rapid successive callbacks that each trigger file writes will be batched; if the process exits within 1000 ms of the last write, the final batch may not be flushed unless the chunk count reaches 100 and triggers the `setImmediate` fast path.
4. **Expecting `.txt` rotation for non-`.txt` logs.** The rotation guard checks `endsWith(".txt")` (bundle.js:+207832); log files with other extensions will not be renamed and may grow without bound.
5. **Misinterpreting `"[REDACTED]"` in output.** This substitution string is applied intentionally during sanitisation (bundle.js:+200573) and does not indicate a tooling defect.
6. **Overlooking `EISDIR` handling.** The file I/O layer explicitly handles `EISDIR` errors (bundle.js:+178013); passing a directory path where a file is expected will be caught silently rather than surfaced to the caller.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `jsf` | Main callback handler (arbor_handler; registered as the `callback` command entry point) |
| `H` | Outer bootstrap/dispatcher function; wraps fetch, model lookup, and command routing |
| `N` | Command processing pipeline orchestrator (toUpperCase, trim, sanitise, write) |
| `ItK` | Input pre-processor feeding into command pipeline |
| `vGA` | Sub-processor within ItK; calls `yoK` and `hoK` |
| `CH` | JSON serialisation helper (calls `JSON.stringify`) |
| `R4` | Command sanitiser / token redactor |
| `qZA` | Token map iterator used by R4 |
| `q` | Token/segment array; accessed via `.at()` |
| `A` | Path/string helper; uses `.toLowerCase()`, `.lastIndexOf()`, `.slice()` |
| `rBH` | Log-write dispatcher; calls `lEA` |
| `lEA` | Low-level write wrapper (calls `H.write`) |
| `StK` | File I/O and log-rotation manager |
| `TBH` | Debounced writer (setTimeout / setImmediate / clearTimeout) |
| `_4H` | Sub-helper of StK; handles path joining and index computation |
| `l6` | Utility referenced by StK during path setup |
| `n56` | EISDIR error handler within file I/O path |
| `MZA` | Log path builder (calls `path.join` and `I6`) |
| `Vo8` | Log rotation executor (stat / endsWith / rename / unlink) |
| `htK` | Append-and-rotate coordinator (mkdir → appendFile → rotate) |
| `Z9` | Hook registration dispatcher (calls `ZGA.register`) |
| `P$` | Utility called from outer `H` function |
| `w2_` | Argument parser (split / trim / indexOf / slice) |
| `u6H` | Seen-command cache checker (calls `vO4.has`) |
| `n3` | String replacement helper on `H` path |
| `M9` | Model normalisation entry point |
| `Cc` | Model resolution coordinator; calls `tY`, `pU`, `FA`, `CC` |
| `tY` | Model resolution sub-helper |
| `pU` | Model resolution sub-helper |
| `CC` | Model alias table resolver; checks `startsWith`, `includes`, `trim` |
| `c9` | Core model-string normaliser (trim / toLowerCase / alias lookup) |
| `u2` | Helper called from `c9`; calls `ZLH` |
| `TLH` | Provider inclusion checker (calls `GLH.includes`) |
| `Mk` | Model token matcher; calls `zM` and `F5` |
| `QcH` | Alternative model token matcher; calls `F5` |
| `AE` | Model resolver with `YA`; provider type `firstParty` |
| `dG1` | Delegating resolver; calls `AE` |
| `zM` | Provider type resolver; resolves `anthropicAws` / `gateway` |
| `__8` | Model set membership check (calls `Q5L.includes`) |
| `dcH` | Calls `_6`; additional normalisation step |
| `eD` | Extended dispatcher; calls `c9` and `hG` |
| `hG` | Composite model handler; assembles `yA`, `h8H`, `cDH`, `ccH`, `AE`, `x2`, `zM`, `YA`, `F5`, `Mk` |
| `o6` | Error / unknown-type handler; fires `tengu_feature_sad` |
| `d` | Error surface utility called from `o6` |
| `K6` | Sub-utility called from `o6`; calls `c76` |
| `c76` | Low-level error formatter / reporter |
| `E$H` | Secondary function called directly from `jsf` alongside `H.map` |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.