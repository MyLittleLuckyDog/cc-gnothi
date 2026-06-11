---
type: feature-spec
feature: "statusline"
cc_version: "2.1.168"
updated: "2026-06-11"
tags: ["statusline", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.168 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/statusline`

> Analysis basis: CC v2.1.168 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.168

---

## Overview

`/statusline` is a prompt-type slash command that sets up Claude Code's terminal status line UI by delegating to a dedicated subagent. When invoked, it reads the user's shell PS1 configuration and dispatches a `statusline-setup` subagent with a targeted prompt instructing it to configure the status line accordingly. The command requires no arguments and performs all setup work through the subagent mechanism.

---

## Registration

| Field | Value |
|---|---|
| type | `prompt` |
| name | `statusline` |
| description | `Set up Claude Code's status line UI` |
| aliases | `[]` (none) |
| handler_method | `getPromptForCommand` |
| handler_method_start (byte) | `12747713` |
| handler_method_end (byte) | `12747921` |
| loc_byte | `12747408` |
| loc_byte_end | `12747922` |
| loc_line | `9094` |
| prompt_body.length | `76` characters |
| prompt_body.trace | `inline template` |
| arbor_handler.name | `getPromptForCommand` |
| arbor_handler.fqn | `claude-2.1.168::getPromptForCommand` |
| arbor_handler.kind | `Method` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `1` |
| `handler_method_start` | `12747713` |
| `handler_method_end` | `12747921` |

Analysis basis: CC v2.1.168 bundle.js:+12747408

---

## Input Branching

The command has a simple, near-linear flow: the user provides no meaningful argument (or an optional hint string that maps to the PS1 configuration context). There are two primary paths based on whether user input is present.

```
flowchart:
  1. User invokes /statusline [optional-input]
     |
     +--> Trim input string
          |
          +--> [Input present] Incorporate trimmed input into prompt template
          |
          +--> [No input]     Use default PS1-based prompt text
          |
          v
     Build subagent invocation object:
       subagent_type = "statusline-setup"
       prompt        = <constructed prompt string>
          |
          v
     Return prompt object to agent runner
```

Because there are only two branches (input present / input absent) this is described as numbered pseudocode per the writing rules.

1. Trim any user-supplied argument string (`H.trim`, Analysis basis: CC v2.1.168 bundle.js:+12747748).
2. If trimmed string is non-empty, embed it in the template; otherwise use the default literal `"Configure my statusLine from my shell PS1 configuration"` (Analysis basis: CC v2.1.168 bundle.js:+12747758).
3. Construct and return the prompt object containing `subagent_type: "statusline-setup"` and the assembled prompt string.

---

## Behavioral Spec

### Handler: `getPromptForCommand`

The Arbor-resolved handler is `getPromptForCommand` (resolution path: `direct`; Analysis basis: CC v2.1.168 bundle.js:+12747713).

```
function getPromptForCommand(userInput):
    trimmedInput = trim(userInput)

    if trimmedInput is non-empty:
        promptText = buildPromptWithUserHint(trimmedInput)
    else:
        promptText = "Configure my statusLine from my shell PS1 configuration"

    return buildSubagentInvocation(
        subagent_type = "statusline-setup",
        prompt        = promptText
    )
```

Analysis basis: CC v2.1.168 bundle.js:+12747713–12747921

The prompt body (76 characters, inline template) instructs the agent to create a subagent of type `"statusline-setup"` and supplies it with a prompt string. The default prompt text asks the agent to configure the status line from the shell's PS1 configuration (Analysis basis: CC v2.1.168 bundle.js:+12747758).

---

### Sub-feature: Prompt Template Construction

The handler uses an inline template (trace: `"inline template"`) rather than loading an external resource. The template is short (76 chars) and references two runtime slots: the subagent type string and the user-facing prompt content.

```
function buildSubagentInvocation(subagentType, prompt):
    return {
        subagent_type: subagentType,   // "statusline-setup"
        prompt:        prompt,
        type:          "text"          // literal "text" at +12747829
    }
```

Analysis basis: CC v2.1.168 bundle.js:+12747829

---

### Sub-feature: Argument Pre-processing (`H.trim`)

Before the prompt template is filled, the raw command argument is passed through a trim utility. This utility (`H`) is the general-purpose argument preprocessor also used across other prompt commands. Its call graph reaches model-selection helpers (`snK`, `IPA`) and JSON serialisation (`RH → JSON.stringify`) at depth 2, suggesting the argument may be further normalised (case-folded, format-detected) before being embedded.

```
function preprocessArgument(rawArg):
    trimmed = rawArg.trim()                    // H.trim at +12747748
    // Further normalisation performed by downstream
    // utilities (snK, IPA, RH) if needed
    return trimmed
```

Analysis basis: CC v2.1.168 bundle.js:+12747748

---

### Sub-feature: Model / Provider Resolution (`snK` → `IPA`)

Reached at depth 2 from the argument preprocessor, `snK` coordinates model selection by calling `KI` (provider lookup), `M0A` (model options), and `IPA` (provider-aware selector). `IPA` in turn calls `edK` and `HcK`. These are not invoked directly by the handler but form part of the shared argument-processing pipeline.

```
function resolveModelForSubagent(context):
    provider   = lookupProvider(context)        // KI at +205174
    modelOptions = getModelOptions(context)     // M0A at +205288
    selected   = selectProviderAwareModel(      // IPA at +205301
                     provider, modelOptions,
                     edK, HcK)
    return selected
```

Analysis basis: CC v2.1.168 bundle.js:+206594 (IPA→edK), +206612 (IPA→snK)

---

### Sub-feature: Persistent Log / File Write (`EUH` → `nWA`)

At depth 2 the call graph shows `EUH` delegating to `nWA`, which calls `H.write`. This indicates that the subagent invocation (or its result) may be persisted to a writable stream, consistent with Claude Code's general pattern of logging subagent dispatches.

```
function persistSubagentDispatch(data):
    writeableHandle = getWriteHandle()   // EUH at +206741
    writeHandle.write(data)              // nWA → H.write at +193301
```

Analysis basis: CC v2.1.168 bundle.js:+206741, +193365

---

### Sub-feature: Append-log Rotation (`_iK` cluster)

`_iK` is the append-log manager reached from the argument preprocessor. It orchestrates:

- **Directory setup** — `IHH.dirname` resolves the log directory; `HiK` creates it with `ny.mkdir` and appends via `ny.appendFile`.
- **Size accounting** — `Buffer.byteLength` measures the chunk before write.
- **Rotation** — `ll8` checks the `.txt` extension, renames the active log with `ny.rename`, and removes the old file with `ny.unlink`.
- **Byte-range path joining** — `$0A` and `B76` construct full filesystem paths using `IHH.join` and `R6`.
- **Throttle / debounce** — `npH` uses `clearTimeout` / `setTimeout` / `setImmediate` with a 1000 ms coalesce window and a 100-item queue limit.
- **Signal registration** — `j9` calls `NPA.register` to register a process-exit handler ensuring any buffered log data is flushed.

```
function appendLogManager(chunk):
    dir      = path.dirname(logFilePath)    // IHH.dirname at +206115
    path.mkdir(dir, {recursive:true})       // HiK → ny.mkdir at +205836
    size     = Buffer.byteLength(chunk)     // +206290
    rotate   = shouldRotate(logFilePath,    // ll8 at +206284
                            size, ".txt",   // ".txt" literal at +205511
                            maxSlice=4)     // 4 at +205533
    if rotate:
        ny.rename(active, rotated)          // ny.rename at +205563
        ny.unlink(old)                      // ny.unlink at +205603
    ny.appendFile(logFilePath, chunk)       // HiK → ny.appendFile at +205895
    schedule(flush, debounceMs=1000,        // +59671
             maxQueue=100)                  // +59692
    registerExitHandler(NPA.register)       // j9 at +206445
```

Analysis basis: CC v2.1.168 bundle.js:+206082 (_iK), +205407 (ll8→ny.stat)

---

### Sub-feature: Bootstrap / API Fetch (`H` → `v`)

The top-level argument handler `H` also triggers an API bootstrap fetch at depth 1 (`v` at +15797656). This is shared infrastructure, not specific to `/statusline`. It:

- Logs `"[Bootstrap] Fetching"` (literal at +15797658).
- Sets `Content-Type: application/json` and `User-Agent` headers (+15797743, +15797777).
- Times out after 5 000 ms (+15797859).
- Emits telemetry event `api_bootstrap_fetch` on success and `parse_failed` on JSON parse error (+15797980, +15798002).
- Logs `"[Bootstrap] Fetch ok"` on success (+15798032).

```
function bootstrapFetch(url):
    log("[Bootstrap] Fetching", url)
    response = fetch(url, {
        headers: {
            "Content-Type": "application/json",
            "User-Agent":   userAgentString
        },
        timeout: 5000
    })
    if response.ok:
        log("[Bootstrap] Fetch ok")
        emit("api_bootstrap_fetch")
        return parseJSON(response)
    else:
        emit("parse_failed")
        throw error
```

Analysis basis: CC v2.1.168 bundle.js:+15797656

---

### Sub-feature: Model-name Normalisation (`s9`)

`s9` is the model-name normaliser reached transitively through `H9` → `s9`. It:

1. Trims and lower-cases the raw model string (+2247412, +2247423).
2. Checks for known tier keywords: `"opusplan"` (+2247508), `"[1m]"` (+2247534), `"sonnet"` (+2247549), `"haiku"` (+2247588), `"opus"` (+2247627), `"best"` (+2247664).
3. Applies regex replacements (`A.replace` at +2247451, `_.replace` at +2247754).
4. Checks `AKL.includes` for allow-listed names (`NH8` at +2247950).

```
function normaliseModelName(raw):
    s = raw.trim().toLowerCase()
    for tier in ["opusplan","[1m]","sonnet","haiku","opus","best"]:
        if s matches tier:
            return canonicalTierName(tier)
    s = applyRegexReplacement(s)
    if not isAllowListed(s):
        raise InvalidModel(s)
    return s
```

Analysis basis: CC v2.1.168 bundle.js:+2247412

---

### Sub-feature: Telemetry Error Path (`o6` → `l`)

`o6` is reached from `H` (depth 1, +15797977). It calls `l` (the telemetry dispatcher), which emits `tengu_feature_sad` (+1011093) when a feature encounters a non-recoverable error condition. This is a shared sad-path reporter, not specific to `/statusline`, but it is wired into the command's call graph.

```
function reportFeatureError(context):
    emitTelemetry("tengu_feature_sad", context)  // l at +1011091
    logErrorDetails(context)                      // J6 → hm6 at +3628
```

Analysis basis: CC v2.1.168 bundle.js:+1011091, +1011093

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_sad` (error path only; emitted by `l` at bundle.js:+1011093) |
| Telemetry (bootstrap) | `api_bootstrap_fetch` (success), `parse_failed` (JSON parse failure) — emitted by bootstrap fetch utility at +15797980, +15798002 |
| Subagent dispatch | Creates a subagent of type `"statusline-setup"` with a 76-char prompt; this is the primary side effect of the command |
| File I/O | Append-log manager (`_iK`) may write to a `.txt` rotation log on disk; uses `ny.appendFile`, `ny.rename`, `ny.unlink` |
| Process exit handler | `j9 → NPA.register` registers an exit hook to flush buffered log data (+60369) |
| Timer / scheduler | `npH` sets debounced write timers: coalesce window 1 000 ms, queue cap 100 items (+59671, +59692) |
| Directory creation | `HiK → ny.mkdir` creates the log directory recursively if absent (+205836) |
| Hook registration | `j9 → NPA.register` (process signal hook) at +60369 |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | Not observed in traversal |
| Network | Bootstrap API fetch with 5 000 ms timeout; sets `Content-Type` and `User-Agent` headers |

---

## Version History

| Version | Change |
|---|---|
| v2.1.168 | Initial analysis |

---

## Common Mistakes

1. **Passing a shell PS1 string with leading/trailing whitespace**: the handler trims the argument, so extra whitespace is harmless, but it will not be preserved in the constructed prompt.
2. **Expecting `/statusline` to apply changes directly**: the command only dispatches a `statusline-setup` subagent. Actual UI changes depend on the subagent completing successfully; errors in the subagent will not surface as an immediate command failure in all cases.
3. **Assuming the command requires an argument**: the default prompt (`"Configure my statusLine from my shell PS1 configuration"`) is used when no argument is supplied, so the command is valid with zero arguments.
4. **Confusing this command with a pure display command**: `/statusline` is a setup/configuration command, not a read-only status display. It actively mutates terminal UI configuration state via the subagent.
5. **Re-running `/statusline` expecting idempotent results**: because the subagent reads the live PS1 at invocation time, running the command after changing the shell prompt will trigger a fresh configuration pass, potentially overwriting prior status-line customisations.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `__handler_statusline` | Synthetic BFS entry point for the `/statusline` handler (not a real bundle symbol) |
| `H` | Top-level argument preprocessor / API fetch coordinator |
| `v` | API bootstrap fetch implementation |
| `snK` | Model-selection coordinator (provider + options) |
| `IPA` | Provider-aware model selector |
| `RH` | JSON serialisation helper (wraps `JSON.stringify`) |
| `G4` | String/path manipulation utility |
| `K0A` | Array-map helper used by `G4` |
| `q` | File-handle / unlink utility |
| `A` | Lower-case string / filesystem path helper |
| `EUH` | Subagent dispatch / write-stream initiator |
| `nWA` | Write-stream flusher (calls `H.write`) |
| `_iK` | Append-log manager (mkdir, appendFile, rotation, debounce, exit hook) |
| `npH` | Debounced write scheduler (setTimeout / setImmediate queue) |
| `YKH` | Path join and token helper inside log manager |
| `d6` | Internal config/state accessor in log manager |
| `B76` | Filesystem path builder (`V8`-backed) |
| `$0A` | Path join helper using `IHH.join` and `R6` |
| `ll8` | Log-rotation decision and rename/unlink handler |
| `HiK` | Directory-creation and append-file writer |
| `j9` | Process exit-signal handler registrar (`NPA.register`) |
| `Y3` | Utility reached from top-level argument handler |
| `mj_` | String split/trim/indexOf/slice helper |
| `lHH` | Set-membership checker (`o74.has`) |
| `uj` | String replacement helper |
| `H9` | Model-name pipeline coordinator |
| `m6H` | Model metadata assembler (`Q0`, `aqH`, `yA`, `qB`) |
| `Q0` | Model metadata field accessor |
| `aqH` | Model attribute resolver |
| `qB` | Model-name parser and tier classifier |
| `s9` | Model-name normaliser (trim, lower-case, tier keywords, regex, allow-list) |
| `Y2` | Model alias resolver (`R4H`) |
| `h4H` | Allow-list membership checker (`y4H.includes`) |
| `CI` | Model tier resolver (`lM`, `N5`) |
| `DdH` | Tier-name formatter (`N5`) |
| `bT` | Model tier builder (`lM`, `N5`, `MA`) |
| `lP1` | Model tier list constructor (calls `bT`) |
| `lM` | Model alias mapper (`MA`) |
| `NH8` | Allow-list gate (`AKL.includes`) |
| `wdH` | Replacement-string builder (`_6`) |
| `FJ` | Composite model-name resolver (`s9`, `_G`) |
| `_G` | Full model descriptor assembler (`GA`, `g6H`, `gYH`, `jdH`, `bT`, `z2`, `lM`, `MA`, `N5`, `CI`) |
| `o6` | Feature-error telemetry reporter |
| `l` | Telemetry event dispatcher (emits `tengu_feature_sad`) |
| `J6` | Error detail logger (calls `hm6`) |
| `hm6` | Low-level error formatting utility |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.