---
type: feature-spec
feature: "statusline"
cc_version: "2.1.165"
updated: "2026-06-05"
tags: ["statusline", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.165 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/statusline`

> Analysis basis: CC v2.1.165 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.165

---

## Overview

`/statusline` is a `prompt`-type slash command that configures Claude Code's terminal status line UI by dispatching a subagent with type `"statusline-setup"`. When invoked, the handler trims any user-supplied argument text, embeds it (alongside a fixed instructional prompt) into a structured agent request, and delegates the actual shell PS1 integration work to the spawned subagent.

---

## Registration

| Field | Value |
|---|---|
| type | `prompt` |
| name | `statusline` |
| description | `Set up Claude Code's status line UI` |
| aliases | `[]` (none) |
| handler_method | `getPromptForCommand` |
| handler_method_start (byte) | `12711211` |
| handler_method_end (byte) | `12711419` |
| loc_byte | `12710906` |
| loc_byte_end | `12711420` |
| loc_line | `9080` |
| prompt_body.length | `76` characters |
| prompt_body.trace | `inline template` |
| prompt_body.text (citation fragment) | `"…subagent_type \"statusline-setup\"…"` |
| arbor_handler.name | `getPromptForCommand` |
| arbor_handler.fqn | `claude-2.1.165::getPromptForCommand` |
| arbor_handler.kind | `Method` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `1` |
| `handler_method_start` | `12711211` |
| `handler_method_end` | `12711419` |

Analysis basis: CC v2.1.165 bundle.js:+12710906

---

## Input Branching

The handler has two distinct branches — argument text present vs. absent — making numbered pseudocode the appropriate representation.

1. **User invokes `/statusline` with no argument text** → the trimmed input is an empty string; the prompt body uses the fixed instructional string `"Configure my statusLine from my shell PS1 configuration"` (bundle.js:+12711256) as the embedded user prompt.
2. **User invokes `/statusline <arg>`** → the trimmed non-empty argument is embedded directly into the subagent prompt field in place of (or alongside) the default text.

```
function getPromptForCommand(userInput):
    trimmedInput = userInput.trim()                     // bundle.js:+12711246

    if trimmedInput is empty:
        embeddedPrompt = DEFAULT_PS1_INSTRUCTION        // "Configure my statusLine from my shell PS1 configuration"
    else:
        embeddedPrompt = trimmedInput

    return buildSubagentRequest(
        subagent_type = "statusline-setup",
        prompt        = embeddedPrompt,
        content_type  = "text"                          // bundle.js:+12711327
    )
```

Analysis basis: CC v2.1.165 bundle.js:+12711211 – +12711419

---

## Behavioral Spec

### 1. Handler Entry — `getPromptForCommand`

The Arbor-resolved handler `getPromptForCommand` (resolution path: `direct`) is an ObjectMethod defined inline on the registration object. It is reached from the synthetic BFS entry `__handler_statusline` via two immediate calls: the handler method itself and a `.trim()` on the raw input string.

```
function getPromptForCommand(rawInput):
    // Step 1 — sanitise input
    cleaned = rawInput.trim()               // bundle.js:+12711246

    // Step 2 — build the prompt payload (inline template, length 76)
    payload = constructPromptBody(
        subagent_type = "statusline-setup",
        user_prompt   = cleaned OR DEFAULT_INSTRUCTION
    )                                       // bundle.js:+12711217

    return payload
```

Analysis basis: CC v2.1.165 bundle.js:+12711217

---

### 2. Default Instruction Constant

When no argument is supplied, a hardcoded default instruction string is used as the embedded user prompt delivered to the subagent.

- Default value: `"Configure my statusLine from my shell PS1 configuration"` (bundle.js:+12711256)
- This string is 54 characters; the total prompt body length of 76 characters accounts for the surrounding template literal scaffolding (`subagent_type` field label and quote delimiters).

Analysis basis: CC v2.1.165 bundle.js:+12711256

---

### 3. Subagent Dispatch — status-line writer pipeline

The call graph from `getPromptForCommand` reaches a deep pipeline responsible for writing, rotating, and registering output files. Key sub-functions in this pipeline (referred to by descriptive names):

```
function statusLineWriterPipeline(promptPayload):

    // Phase A — output stream management (statusLineWriter, bundle.js:+193190)
    outputStream = getOrCreateOutputStream()
    outputStream.write(promptPayload)

    // Phase B — debounced flush (debouncedFlush, bundle.js:+59737–+60152)
    clearTimeout(existingFlushTimer)
    flushBuffer  = joinBufferChunks()
    newTimer     = setTimeout(flushAndEmit, FLUSH_DELAY_MS)
    setImmediate(drainRemainder)

    // Phase C — file rotation (fileRotator, bundle.js:+204917–+205113)
    stat = filesystem.stat(targetPath)
    if targetPath.endsWith(".txt"):          // bundle.js:+205021
        rotatePath = targetPath.slice(0, -4) // trim 4 chars, bundle.js:+205043
    filesystem.rename(currentFile, rotatePath)
    filesystem.unlink(oldFile)

    // Phase D — append + size tracking (fileAppender, bundle.js:+205317–+205502)
    filesystem.mkdir(outputDir, { recursive: true })
    filesystem.appendFile(outputPath, data)
    byteSize = Buffer.byteLength(data)       // bundle.js:+205771

    // Phase E — hook registration (hookRegistrar, bundle.js:+60323)
    hookRegistry.register(statusLineHook)
```

Analysis basis: CC v2.1.165 bundle.js:+193190, +59737, +204917, +205317, +60323

---

### 4. Bootstrap Fetch (supporting utility)

The call graph passes through a bootstrap HTTP fetch utility used to retrieve configuration or model metadata:

```
function bootstrapFetch(url):
    log("[Bootstrap] Fetching", url)          // bundle.js:+15724583
    response = httpGet(url, {
        headers: {
            "Content-Type": "application/json",  // bundle.js:+15724668
            "User-Agent":   userAgentString      // bundle.js:+15724702
        },
        timeout: 5000                            // bundle.js:+15724784
    })
    if response.ok:
        log("[Bootstrap] Fetch ok")              // bundle.js:+15724957
        return response.json()
    else:
        telemetry.emit("api_bootstrap_fetch", { status: "parse_failed" })
        // bundle.js:+15724905, +15724927
```

Analysis basis: CC v2.1.165 bundle.js:+15724583

---

### 5. Model Resolution (supporting utility)

The call graph reaches a model-resolution utility (`Aq` → descriptive name: `resolveModelAlias`) that normalises model shorthand strings. Known alias constants found in scope:

- `"opusplan"` (bundle.js:+12243249)
- `"sonnet"` (bundle.js:+2243290)
- `"haiku"` (bundle.js:+2243329)
- `"opus"` (bundle.js:+2243368)
- `"best"` (bundle.js:+2243405)
- Token-window marker `"[1m]"` (bundle.js:+2243275)

```
function resolveModelAlias(rawModelName):
    normalized = rawModelName.trim().toLowerCase()   // bundle.js:+2243153
    normalized = applyProviderPrefix(normalized)
    alias      = lookupAlias(normalized)             // checks opusplan, sonnet, haiku, opus, best
    return alias ?? normalized
```

Analysis basis: CC v2.1.165 bundle.js:+2243153

---

### 6. Debug Mode Flag

A string constant `"debug"` is present at bundle.js:+206051 within the call graph's reachable scope, indicating the pipeline supports a debug logging mode that can be activated via an environment or config flag.

Analysis basis: CC v2.1.165 bundle.js:+206051

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_sad` (bundle.js:+1010365) — emitted on a sad-path branch within the supporting command infrastructure (`s6` / `c`) |
| Telemetry (bootstrap) | `api_bootstrap_fetch` with `parse_failed` status (bundle.js:+15724905, +15724927) |
| Hook registration | `hookRegistry.register()` called via `hookRegistrar` (`j9` → `zXA.register`, bundle.js:+60323); registers a status-line update hook |
| File system — append | `filesystem.appendFile` to status-line output file (bundle.js:+205376) |
| File system — rotate | `filesystem.rename` + `filesystem.unlink` for log rotation of `.txt` output files (bundle.js:+205073, +205113) |
| File system — mkdir | `filesystem.mkdir` (recursive) to ensure output directory exists (bundle.js:+205317) |
| Buffer accounting | `Buffer.byteLength` called to track cumulative output size (bundle.js:+205771) |
| Debounce timer | `clearTimeout` + `setTimeout` + `setImmediate` used to debounce file writes; delay value: `1000` ms base, `100` ms inner (bundle.js:+59625, +59646) |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.165 | Initial analysis |

---

## Common Mistakes

1. **Passing a full shell PS1 string expecting direct substitution** — the command delegates to a `"statusline-setup"` subagent; it does not apply PS1 changes itself. The subagent may require additional context or tools to complete the configuration.
2. **Assuming the command is synchronous** — the file-write pipeline is debounced (1 000 ms timer, bundle.js:+59625) and uses `setImmediate` for draining; callers should not assume the status line file is updated immediately after the command returns.
3. **Omitting argument text when a custom prompt is desired** — with no argument the default instruction `"Configure my statusLine from my shell PS1 configuration"` is used verbatim; to target a non-default shell or configuration, pass the relevant details as an argument.
4. **Expecting `.txt` rotation to be idempotent** — the file-rotation logic strips exactly 4 characters from the end of paths ending in `.txt` (bundle.js:+205021, +205043). Paths using different extensions will not trigger rotation and may accumulate unboundedly.
5. **Confusing the `"debug"` log mode with a command flag** — `"debug"` (bundle.js:+206051) is an internal pipeline constant, not a user-facing `/statusline --debug` option.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `__handler_statusline` | Synthetic BFS entry point for the `/statusline` command handler |
| `H` | Top-level command executor / bootstrap fetch orchestrator |
| `v` | Status-line output pipeline coordinator |
| `icK` | Inner pipeline stage (delegates to file-rotation helpers) |
| `DXA` | File-path manipulation utility (calls `rgK`, `ogK`) |
| `SH` | JSON serialisation helper (wraps `JSON.stringify`) |
| `J4` | Path normaliser / truncator (replace, slice, lastIndexOf) |
| `c2A` | Path-segment mapper (maps over `QcK`) |
| `q` | File-handle / path utility (calls `puK.unlinkSync`) |
| `A` | Lowercase file-path resolver (calls `f.toLowerCase`) |
| `ppH` | Output stream writer wrapper (delegates to `C2A`) |
| `C2A` | Raw stream writer (calls `H.write`) |
| `acK` | Main file-append + rotation orchestrator |
| `$pH` | Debounced flush manager (clearTimeout / setTimeout / setImmediate) |
| `d3H` | Status-line content assembler (joins `KHH`, calls `a8`, `S6`) |
| `Q6` | Configuration or path resolver called from `acK` |
| `aL6` | EISDIR-aware file writer (bundle.js:+175638) |
| `s2A` | Path-join helper (calls `KHH.join`, `S6`) |
| `a2A` | File rotator (stat → rename → unlink) |
| `ocK` | File appender (mkdir → appendFile → rotate → size-track) |
| `j9` | Hook registrar (calls `zXA.register`) |
| `e$` | Sub-helper called from bootstrap fetch orchestrator |
| `Gw_` | Command-string parser (split, trim, indexOf, slice) |
| `ZHH` | Feature-flag / set membership checker (calls `c44.has`) |
| `uj` | String sanitiser (calls `H.replace`) |
| `e1` | Prompt-parsing entry point (calls `D6H`, `Aq`, `eX`) |
| `D6H` | Prompt-structure builder (calls `x0`, `IqH`, `SA`, `yd`) |
| `x0` | Structural node constructor called from `D6H` |
| `IqH` | Structural node constructor called from `D6H` |
| `yd` | Prompt-segment processor (split, trim, startsWith, includes) |
| `Aq` | Model-alias resolver (trim, toLowerCase, replace) |
| `o0` | Model-tier lookup (calls `q4H`) |
| `_4H` | Provider inclusion checker (calls `H4H.includes`) |
| `wI` | Model variant selector (calls `gM`, `Z5`) |
| `NQH` | Fallback model selector (calls `Z5`) |
| `NE` | Provider-aware model factory (calls `gM`, `Z5`, `XA`) |
| `SX1` | Model selector entry (delegates to `NE`) |
| `gM` | Model object factory (calls `XA`) |
| `Pe6` | Provider list inclusion checker (calls `r1L.includes`) |
| `vQH` | Provider enum wrapper (calls `eH`) |
| `eX` | Extended prompt parser (calls `Aq`, `r0`) |
| `r0` | Full model-resolution pipeline (ZA, P6H, PYH, IQH, NE, gM, XA, Z5, wI) |
| `s6` | Sad-path / error reporter (emits `tengu_feature_sad`) |
| `c` | Inner sad-path helper called from `s6` |
| `P6` | Bootstrap / version-info loader (calls `Nu6`) |
| `Nu6` | Version constant provider (bundle.js:+3628) |