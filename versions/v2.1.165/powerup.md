---
type: feature-spec
feature: "powerup"
cc_version: "2.1.165"
updated: "2026-06-05"
tags: ["powerup", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.165 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/powerup`

> Analysis basis: CC v2.1.165 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.165

---

## Overview

`/powerup` launches a quick, interactive tutorial experience that helps users discover Claude Code features through guided lessons. When invoked, it renders a JSX-based UI component via an async handler, fetching lesson content from a remote bootstrap endpoint and presenting it in a structured interactive format. The command is designed as an onboarding and feature-discovery aid rather than a workflow automation tool.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `powerup` |
| description | `Discover Claude Code features through quick interactive lessons` |
| loc_byte | `11987230` |
| loc_byte_end | `11987410` |
| loc_line | `8301` |
| module_id | `iiq` |
| load_inline | `true` |
| arbor_handler.name | `RTf` |
| arbor_handler.fqn | `claude-2.1.165::RTf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.165 bundle.js:+11987230

---

## Input Branching

The command flow involves more than three distinct paths: remote bootstrap fetch success/failure, content parse success/failure, log-file write routing, and feature-lesson state transitions. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A([User invokes /powerup]) --> B[Handler RTf invoked\nasync, local-jsx type]
    B --> C[createElement — build JSX root component]
    C --> D[Call bootstrapFetcher H\nwith 5000ms timeout]
    D --> E{HTTP fetch\nresult?}
    E -->|Success| F[Parse JSON response body]
    F --> G{JSON parse\nsucceeded?}
    G -->|Yes| H2[Emit telemetry:\napi_bootstrap_fetch / fetch ok\nlog '[Bootstrap] Fetch ok']
    G -->|No| I[Emit telemetry:\nparse_failed\nlog parse error]
    E -->|Failure / timeout| J[Log '[Bootstrap] Fetching'\nerror path]
    H2 --> K[Resolve lesson content\nfrom parsed data]
    I --> L[Fallback / degraded UI]
    J --> L
    K --> M[Normalize input string:\ntrim → toUpperCase → replace]
    M --> N[Route to lesson sub-feature\nvia modelResolver Aq]
    N --> O{Model tier\nidentified?}
    O -->|opusplan / [1m]| P[Render opus-plan lesson UI]
    O -->|sonnet| Q[Render sonnet lesson UI]
    O -->|haiku| R[Render haiku lesson UI]
    O -->|opus| S[Render opus lesson UI]
    O -->|best / default| T[Render best-tier lesson UI]
    P & Q & R & S & T --> U[Write lesson log via appendFileWriter]
    U --> V{File write\nrouting}
    V -->|New file path| W[mkdir + appendFile\nrotate if .txt + size > threshold]
    V -->|Existing path| X[appendFile directly]
    W & X --> Y[Register hook via hookRegistry j9]
    Y --> Z([Display interactive lesson\nJSX rendered in terminal])

    style L fill:#f96,color:#000
    style Z fill:#6f6,color:#000
```

---

## Behavioral Spec

### 1. Command Entry — Async JSX Handler

The primary handler `RTf` (resolved via `module_id → iiq`, Arbor `resolution_path: module_id`) is an `AsyncFunction`. On invocation it immediately calls `createElement` to begin constructing the JSX component tree, then delegates to the bootstrap-fetch helper.

```
async function powerupHandler(context):
    rootElement = createElement(PowerupComponent, context)
    bootstrapData = await fetchBootstrap(context)
    lessonContent = resolveLesson(bootstrapData, context.input)
    return renderLessonUI(rootElement, lessonContent)
```

Analysis basis: CC v2.1.165 bundle.js:+11987104, +11987139

---

### 2. Bootstrap Fetch

The bootstrap fetcher contacts a remote endpoint with a hard timeout of **5000 ms** (bundle.js:+15724784). It sets `Content-Type: application/json` (bundle.js:+15724683) and `User-Agent` (bundle.js:+15724702) request headers. The debug log message prefix `"[Bootstrap] Fetching"` (bundle.js:+15724583) is emitted at initiation. On a successful HTTP response the message `"[Bootstrap] Fetch ok"` (bundle.js:+15724957) is logged.

```
async function fetchBootstrap(context):
    log("[Bootstrap] Fetching ...")
    response = await fetch(bootstrapUrl, {
        headers: {
            "Content-Type": "application/json",
            "User-Agent": buildUserAgent()
        },
        timeout: 5000
    })
    if response.ok:
        data = await response.json()
        log("[Bootstrap] Fetch ok")
        emitTelemetry("api_bootstrap_fetch")
        return data
    else:
        emitTelemetry("parse_failed")
        return null
```

Analysis basis: CC v2.1.165 bundle.js:+15724581, +15724668, +15724683, +15724702, +15724784, +15724905, +15724927, +15724957

---

### 3. Input Normalization and Model Resolution

After the bootstrap data is obtained, the user's input string (if any) is normalized: whitespace is trimmed, the string is converted to uppercase, and then specific substrings are replaced. The normalization pipeline feeds into `modelResolver` (`Aq`), which maps shorthand tier names to internal model identifiers.

```
function normalizeInput(rawInput):
    trimmed = rawInput.trim()
    upper   = trimmed.toUpperCase()
    normalized = upper.replace(pattern, replacement)
    return normalized

function modelResolver(normalizedInput):
    lower = normalizedInput.toLowerCase().trim()
    lower = lower.replace(specialChars, "")
    if isForbiddenTier(lower):
        return null
    if lower includes "opusplan" or lower == "[1m]":
        return MODEL_OPUSPLAN
    if lower == "sonnet":
        return MODEL_SONNET
    if lower == "haiku":
        return MODEL_HAIKU
    if lower == "opus":
        return MODEL_OPUS
    if lower == "best":
        return MODEL_BEST
    return MODEL_DEFAULT
```

Model tier string constants found: `"opusplan"` (bundle.js:+2243249), `"[1m]"` (bundle.js:+2243275), `"sonnet"` (bundle.js:+2243290), `"haiku"` (bundle.js:+2243329), `"opus"` (bundle.js:+2243368), `"best"` (bundle.js:+2243405).

Provider tags found: `"firstParty"` (bundle.js:+2239457), `"anthropicAws"` (bundle.js:+2097366), `"gateway"` (bundle.js:+2097386), `"mantle"` (bundle.js:+2240098).

Analysis basis: CC v2.1.165 bundle.js:+206177, +206200, +2243153, +2243164, +2243192

---

### 4. Lesson Content Parsing

The content resolution pipeline (`contentResolver`, `c2A`) maps over a `QcK` array to build a list of lesson entries. A `"[REDACTED]"` sentinel value (bundle.js:+198141) is present in path-building logic. Path components are assembled using `lastIndexOf` and `slice` operations, and a segment index of `2` (bundle.js:+198170) is used to extract a path fragment.

```
function resolveContentPaths(rawPaths):
    mapped = rawPaths.map(entry => buildPath(entry))
    return mapped

function buildPath(entry):
    replaced = entry.replace(pattern, "[REDACTED]")
    segment  = entry.at(2)
    idx      = entry.lastIndexOf(separator)
    result   = entry.slice(0, idx)
    return result
```

Analysis basis: CC v2.1.165 bundle.js:+197777, +198062, +198089, +198141, +198170, +198199, +198225, +198251

---

### 5. Log File Write and Rotation

The append-file writer (`appendFileWriter`, `acK`) handles persisting lesson progress and telemetry logs. It computes the directory via `path.dirname`, checks whether an existing log file ends with `".txt"` (bundle.js:+205021), and if so performs a rotation using `fs.rename` followed by `fs.unlink`. The byte-length of content is computed via `Buffer.byteLength` before writing. Directory creation uses `fs.mkdir` (recursive). The file is written with `fs.appendFile`.

A debounce mechanism (`debounceWriter`, `$pH`) wraps write calls using `clearTimeout` / `setTimeout` with a debounce interval of **1000 ms** (bundle.js:+59625) and a maximum queue depth of **100** entries (bundle.js:+59646).

```
async function appendFileWriter(content, filePath):
    dir = path.dirname(filePath)
    await ensureDirectory(dir)        // fs.mkdir recursive
    byteLen = Buffer.byteLength(content)
    if filePath.endsWith(".txt"):
        sliced = filePath.slice(0, length - 4)
        await fs.rename(filePath, sliced)
        await fs.unlink(filePath)     // clean up old extension
    await fs.appendFile(filePath, content)
    rotateIfNeeded(filePath, byteLen)

function debounceWriter(fn, payload):
    clearTimeout(currentTimer)
    pendingQueue.push(payload)
    if pendingQueue.length >= 100:
        flushImmediately(fn)          // setImmediate path
    else:
        currentTimer = setTimeout(() => flushBatch(fn), 1000)
```

Analysis basis: CC v2.1.165 bundle.js:+59625, +59646, +205021, +205043, +205317, +205376, +205463, +205469, +205771

---

### 6. Hook Registration

After a lesson is displayed, a hook is registered via `hookRegistry` (`j9` → `zXA.register`) to track post-display lifecycle events. This allows the shell to clean up or trigger follow-up actions after the interactive lesson UI is dismissed.

```
function registerLessonHook(lessonId):
    hookRegistry.register(lessonId, cleanupCallback)
```

Analysis basis: CC v2.1.165 bundle.js:+205926, +60323

---

### 7. EISDIR Error Handling

During directory or file operations, the code explicitly handles the `"EISDIR"` error code (bundle.js:+175646) — the case where a directory exists where a file is expected — allowing it to abort the write gracefully rather than propagate a crash.

```
function safeWrite(path, content):
    try:
        writeFile(path, content)
    catch err:
        if err.code == "EISDIR":
            logAndAbort(err)
        else:
            raise err
```

Analysis basis: CC v2.1.165 bundle.js:+175646

---

### 8. System Prompt Role Injection

A `"system"` role literal (bundle.js:+11987152) is present within the handler registration block, indicating the command may inject a system-role message into the conversation context during lesson rendering.

Analysis basis: CC v2.1.165 bundle.js:+11987152

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_sad` (bundle.js:+1010365) |
| Bootstrap telemetry events | `"api_bootstrap_fetch"` (bundle.js:+15724905), `"parse_failed"` (bundle.js:+15724927) |
| Hook registration | `hookRegistry.register` called after lesson display (bundle.js:+60323) |
| File I/O | `fs.mkdir`, `fs.appendFile`, `fs.rename`, `fs.unlink` invoked during lesson log write |
| Debounce timer | `setTimeout` / `clearTimeout` / `setImmediate` used; 1000 ms interval, 100-entry queue cap |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Network | Outbound fetch to bootstrap URL with `Content-Type: application/json`, `User-Agent` headers, 5000 ms timeout |
| System role message | `"system"` role literal injected at registration block (bundle.js:+11987152) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.165 | Initial analysis |

---

## Common Mistakes

1. **Expecting synchronous output**: `/powerup` is backed by an `AsyncFunction` that performs a network fetch. If the bootstrap endpoint is unreachable or slow, the lesson UI may be delayed up to 5000 ms or fall back to a degraded state.
2. **Passing unrecognized model tier names**: The `modelResolver` only recognizes `opusplan`, `[1m]`, `sonnet`, `haiku`, `opus`, and `best` (case-insensitive after normalization). Any other input routes to the default tier silently.
3. **Log directory conflicts**: If the configured log path resolves to a directory rather than a file, the `EISDIR` guard will abort the write without surfacing an explicit user-visible error.
4. **Assuming idempotent file writes**: The `.txt` rotation logic (`fs.rename` + `fs.unlink`) is destructive; running `/powerup` repeatedly in the same session against the same log path will rotate and delete the previous file.
5. **Expecting the hook to persist across sessions**: The hook registered via `hookRegistry.register` is in-process and does not survive a CLI restart.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `RTf` | Primary async handler for `/powerup` (Arbor-resolved, `fqn: claude-2.1.165::RTf`) |
| `H` | Bootstrap fetcher / core fetch orchestrator |
| `v` | Input processing pipeline (normalize, route, write) |
| `icK` | Input validation / sanitization helper |
| `DXA` | Sub-validator called by `icK` |
| `SH` | JSON serialization utility (`JSON.stringify` wrapper) |
| `J4` | Path segment builder / content path resolver |
| `c2A` | Lesson content list mapper (`QcK.map`) |
| `q` | File system unlink helper (`puK.unlinkSync`) |
| `A` | Case normalization helper (`f.toLowerCase`) |
| `ppH` | Write-dispatch helper calling `C2A` |
| `C2A` | Core write emitter (`H.write`) |
| `acK` | Append-file writer with rotation logic |
| `$pH` | Debounce writer (clearTimeout / setTimeout / setImmediate) |
| `d3H` | Log path join and segment builder |
| `Q6` | Auxiliary path resolver called by `acK` |
| `aL6` | EISDIR-aware write helper |
| `s2A` | Path join utility for log files |
| `a2A` | File stat + rename + unlink rotation handler |
| `ocK` | mkdir + appendFile + rotation orchestrator |
| `j9` | Hook registration dispatcher (`zXA.register`) |
| `e$` | Fetch response accessor |
| `Gw_` | String split/trim/indexOf/slice parser |
| `ZHH` | Cache/map presence checker (`c44.has`) |
| `uj` | String replace utility |
| `e1` | Lesson content resolver entry point |
| `D6H` | Lesson data structure builder |
| `x0` | Sub-component of lesson builder |
| `IqH` | Sub-component of lesson builder |
| `yd` | Lesson metadata parser (trim, map, startsWith, includes) |
| `Aq` | Model resolver (tier string → model constant) |
| `o0` | Tier lookup sub-function |
| `_4H` | Forbidden-tier checker (`H4H.includes`) |
| `wI` | Tier branch: opusplan / `[1m]` handler |
| `NQH` | Tier branch: sonnet handler |
| `NE` | Tier branch: firstParty model handler |
| `SX1` | Tier branch: NE wrapper |
| `gM` | Provider tag resolver (`XA`) |
| `Pe6` | Provider inclusion checker (`r1L.includes`) |
| `vQH` | Provider variant handler (`eH`) |
| `eX` | Extended lesson resolver (calls `Aq`, `r0`) |
| `r0` | Full model routing resolver (ZA, P6H, PYH, IQH, NE, z2, gM, XA, Z5, wI) |
| `s6` | Telemetry event emitter (`tengu_feature_sad`) |
| `c` | Telemetry event payload builder |
| `P6` | Telemetry dispatch (`Nu6`) |
| `Nu6` | Low-level telemetry sender |
| `Gw_` | Query string / fragment parser |
| `VR` | Auxiliary string processor called by `v` |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.