---
type: feature-spec
feature: "statusline"
cc_version: "2.1.162"
updated: "2026-06-04"
tags: ["statusline", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.162 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/statusline`

> Analysis basis: CC v2.1.162 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.162

---

## Overview

`/statusline` is a `prompt`-type slash command that bootstraps the Claude Code status line UI by dispatching a subagent with type `"statusline-setup"`. Its primary purpose is to configure the shell status-line display from the user's existing shell PS1 configuration, delegating the actual setup work to a dedicated subagent prompt rather than performing it inline.

---

## Registration

| Field | Value |
|---|---|
| type | `prompt` |
| name | `statusline` |
| description | `Set up Claude Code's status line UI` |
| aliases | `[]` (none) |
| handler_method | `getPromptForCommand` |
| handler_method_start (byte) | `12647635` |
| handler_method_end (byte) | `12647843` |
| loc_byte | `12647330` |
| loc_byte_end | `12647844` |
| loc_line | `8938` |
| prompt_body.length | `76` characters |
| prompt_body.trace | `inline template` |
| prompt_body.summary | Creates a subagent with `subagent_type "statusline-setup"` and a fixed inner prompt instructing configuration from the shell PS1 (≤30-char cite: `"Configure my statusLine…"`) |
| arbor_handler.name | `getPromptForCommand` |
| arbor_handler.fqn | `claude-2.1.162::getPromptForCommand` |
| arbor_handler.kind | `Method` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `1` |
| `handler_method_start` | `12647635` |
| `handler_method_end` | `12647843` |

Analysis basis: CC v2.1.162 bundle.js:+12647330

---

## Input Branching

The handler performs a trim of any user-supplied argument text, then constructs and dispatches a fixed subagent prompt regardless of that input content. There are only two meaningful paths (argument present vs. absent after trim), making a numbered pseudocode representation appropriate here.

1. **User invokes `/statusline` with no argument (or whitespace only)**
   - Argument string trims to empty.
   - Handler proceeds with the fixed subagent prompt body.

2. **User invokes `/statusline <arg>`**
   - Argument string is trimmed.
   - The trimmed value is embedded into the inline template (as the inner prompt field sent to the subagent).
   - Handler constructs and returns the final prompt for dispatch.

In both cases the `subagent_type` field is hardcoded to `"statusline-setup"` and the outer instruction to the agent is derived from the inline template literal found at bundle.js:+12647680.

---

## Behavioral Spec

### Handler Entry: `getPromptForCommand`

The Arbor handler resolved directly inside the registration byte range (`direct` resolution, `n_hits: 1`). It is the sole implementation entry point.

```
method getPromptForCommand(userInput):
    trimmedInput = userInput.trim()                    // H.trim @ +12647670

    innerPrompt = "Configure my statusLine from my shell PS1 configuration"
                                                       // literal @ +12647680

    promptBody = buildSubagentTemplate(
        subagent_type = "statusline-setup",
        prompt        = innerPrompt
    )
    // inline template, length=76, trace="inline template" @ +12647635–12647843

    return promptBody                                  // type="text" @ +12647751
```

Analysis basis: CC v2.1.162 bundle.js:+12647635

---

### Subagent Dispatch Pipeline

After `getPromptForCommand` returns the prompt body, the framework routes it through the standard prompt-type command dispatch path. The call graph shows the following chain is invoked:

```
function dispatchPromptCommand(promptBody):

    // 1. Build the outbound HTTP fetch request
    requestContext = bootstrapFetch(
        headers = {
            "Content-Type": "application/json",        // literal @ +15591093
            "User-Agent":   "<agent-string>"           // literal @ +15591112
        },
        timeout = 5000                                 // literal @ +15591194
    )
    // "[Bootstrap] Fetching" logged at entry           // literal @ +15590993

    // 2. Resolve model tier for the subagent
    modelTier = resolveModelTier(promptBody)
    // Tier selection tests for tokens: "opusplan", "sonnet",
    // "haiku", "opus", "best" against normalized model string
    // literals @ +2240470, +2240511, +2240550, +2240589, +2240626

    // 3. Write prompt to filesystem staging area
    stagePromptToFile(
        promptBody,
        format = "text"                                // literal @ +12647751
    )
    // Uses atomic rename/unlink pattern (HPA: jy.rename, jy.unlink @ +204817, +204857)
    // File suffix ".txt" observed                     // literal @ +204765
    // EISDIR guard active                             // literal @ +175445

    // 4. Register the subagent task
    registerSubagent(
        subagent_type = "statusline-setup",
        prompt        = innerPrompt
    )
    // jJA.register call @ +60123

    // 5. Return result type "text" to command framework
    return { type: "text", content: promptBody }
```

Analysis basis: CC v2.1.162 bundle.js:+15590991, +204817, +60123

---

### Filesystem Write Path

The staging write for the prompt body uses an asynchronous, atomic write-and-rotate mechanism:

```
async function stagePromptToFile(content, directory):

    byteLen = Buffer.byteLength(content)               // @ +205513

    // Ensure directory exists
    await mkdir(directory, { recursive: true })        // jy.mkdir @ +205060

    // Append content to working file
    await appendFile(targetPath, content)              // jy.appendFile @ +205119

    // Rotate file when size threshold reached
    stat = await stat(targetPath)                      // jy.stat @ +204661

    if targetPath.endsWith(".txt"):                    // H.endsWith @ +204754
        rotatedPath = targetPath.slice(0, -4)          // H.slice @ +204776, literal 4 @ +204787
        await rename(targetPath, rotatedPath)          // jy.rename @ +204817
    else:
        await unlink(staleFile)                        // jy.unlink @ +204857

    // Debounce flush using setTimeout/setImmediate
    scheduleFlush(
        debounce_ms  = 1000,                           // literal @ +59425
        max_queue    = 100                             // literal @ +59446
    )
    // clearTimeout + setTimeout + setImmediate @ +59537, +59701, +59794
```

Analysis basis: CC v2.1.162 bundle.js:+205060, +204817, +59537

---

### Model Tier Resolution

The subagent's model tier is resolved by normalizing the model name and matching against known tier strings:

```
function resolveModelTier(modelIdentifier):
    normalized = modelIdentifier.trim().toLowerCase()  // qq: H.trim, _.toLowerCase @ +2240374

    // Strip provider prefix "anthropic."              // literal @ +2234431
    if normalized.startsWith("anthropic."):
        normalized = normalized.replace("anthropic.", "")

    // Tier classification (ordered by priority)
    if matches(normalized, "opusplan"):  return TIER_OPUS_PLAN   // @ +2240470
    if normalized includes "[1m]":       return TIER_LONG_CTX    // literal @ +2240496
    if matches(normalized, "sonnet"):    return TIER_SONNET      // @ +2240511
    if matches(normalized, "haiku"):     return TIER_HAIKU       // @ +2240550
    if matches(normalized, "opus"):      return TIER_OPUS        // @ +2240589
    if matches(normalized, "best"):      return TIER_BEST        // @ +2240626

    // Provider-type sub-classification
    if providerType == "firstParty":     return FIRST_PARTY      // @ +2236678
    if providerType == "anthropicAws":   return AWS_TIER         // @ +2094587
    if providerType == "gateway":        return GATEWAY_TIER     // @ +2094607
    if providerType == "mantle":         return MANTLE_TIER      // @ +2237319

    return DEFAULT_TIER
```

Analysis basis: CC v2.1.162 bundle.js:+2240374, +2240470

---

### Bootstrap Fetch & Telemetry

```
function bootstrapFetch(url, options):
    log("[Bootstrap] Fetching", url)                   // literal @ +15590993
    response = await fetch(url, options)

    if parse fails:
        emit telemetry("api_bootstrap_fetch",          // literal @ +15591315
                       status="parse_failed")          // literal @ +15591337
        return error

    log("[Bootstrap] Fetch ok")                        // literal @ +15591367
    return response
```

Analysis basis: CC v2.1.162 bundle.js:+15591315

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_sad` (bundle.js:+1008376) — emitted on a sad/failure path within the `c`→`Z6`→`Zx6` call chain |
| Telemetry | `api_bootstrap_fetch` with status `parse_failed` (bundle.js:+15591315) — emitted when the bootstrap HTTP response cannot be parsed |
| Subagent registration | `jJA.register` called to enqueue a `"statusline-setup"` subagent task (bundle.js:+60123) |
| Filesystem writes | Prompt body staged to a `.txt` file via `appendFile` + atomic `rename`/`unlink` rotation (bundle.js:+205060–205245) |
| Debounce timer | `setTimeout` (1000 ms) + `setImmediate` used to schedule deferred flush of staged writes; queue capped at 100 entries (bundle.js:+59425, +59446) |
| Buffer accounting | `Buffer.byteLength` called to track byte size of staged content (bundle.js:+205513, +205212) |
| Hook registration | `jJA.register` binding observed in `J9` (bundle.js:+60123) — registers a lifecycle hook for the subagent |
| appState changes | No direct `appState` mutations observed within depth-2 traversal |
| Sound | No audio side-effects observed within depth-2 traversal |
| Redaction | The string `"[REDACTED]"` appears in the path-shortening logic inside the filesystem staging pipeline (bundle.js:+197925) |
| Debug log level | `"debug"` log level string used in the staging write path (bundle.js:+205793) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.162 | Initial analysis — `prompt`-type command dispatching subagent `"statusline-setup"` with 76-character inline template |

---

## Common Mistakes

1. **Expecting interactive output**: `/statusline` is a `prompt`-type command — it returns a prompt body to the agent framework rather than producing immediate terminal output. The actual status-line configuration is performed by the spawned subagent, not inline.
2. **Passing a custom configuration argument**: The inner prompt sent to the subagent (`"Configure my statusLine…"`) is a hardcoded literal. Any user-supplied argument after `/statusline` is trimmed and embedded into the template, but the primary instruction string is fixed and cannot be overridden by argument text alone.
3. **Confusing `/statusline` with a display toggle**: This command sets up (bootstraps) the status line from the user's shell PS1; it does not toggle visibility or modify an already-configured status line. Re-running it re-triggers the setup subagent.
4. **Assuming synchronous completion**: The filesystem staging path uses asynchronous `appendFile`, `rename`, and debounced flush scheduling (1000 ms `setTimeout`). The status-line configuration is not applied instantaneously.
5. **Ignoring shell environment dependency**: The inner prompt explicitly references the shell PS1 configuration. Invoking `/statusline` in an environment without a meaningful PS1 may produce an incomplete or default status-line configuration.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `__handler_statusline` | Synthetic BFS entry node representing the `/statusline` command handler (not a real bundle symbol) |
| `H` | Core utility / HTTP fetch helper; also reused as `H.trim`, `H.includes`, `H.endsWith`, `H.slice`, `H.replace`, `H.write` in multiple contexts |
| `v` | Prompt-type command dispatch orchestrator; coordinates model resolution, file staging, and subagent launch |
| `PgK` | Sub-dispatcher within `v`; manages branching of the outbound request |
| `PJA` | Request construction helper called by `PgK`; invokes `GUK` and `EUK` |
| `SH` | JSON serialisation helper (wraps `JSON.stringify`) |
| `V4` | Path-shortening / redaction utility; trims path segments and applies `[REDACTED]` replacement |
| `rXA` | Maps over a list of path segments (used by `V4`) |
| `q` | File-system unlink helper; calls `OCK.unlinkSync` |
| `A` | Case-normalisation helper; calls `f.toLowerCase`; also used as `A.map`, `A.lastIndexOf`, `A.slice`, `A.replace` |
| `WpH` | Write-pipeline entry point; delegates to `pXA` |
| `pXA` | Low-level write executor; calls `H.write` |
| `EgK` | Asynchronous file-staging manager; coordinates mkdir, appendFile, rotate, debounce, and subagent hook registration |
| `dmH` | Debounced flush scheduler; manages `clearTimeout`, `setTimeout`, `setImmediate`, and internal write queues (`$`, `L`, `j`) |
| `E3H` | Path-join and segment helper used within `EgK`; calls `_p6`, `Qe.join`, `s8`, `S6` |
| `i6` | Internal helper called by `EgK` during staging setup |
| `zL6` | EISDIR-guard utility; checks for `"EISDIR"` error code (calls `V8`) |
| `_PA` | Path construction helper; calls `Qe.join` and `S6` |
| `HPA` | File-rotation handler; performs stat → rename/unlink cycle with `.txt` suffix detection |
| `GgK` | Async append-and-rotate loop; mirrors `EgK`'s write cycle for continuation writes |
| `J9` | Subagent hook registrar; calls `jJA.register` |
| `_3` | Internal state accessor used by the fetch/bootstrap helper `H` |
| `AY_` | Argument-splitting utility; splits, trims, and slices input strings |
| `LHH` | Set-membership check helper (calls `Y94.has`) |
| `bJ` | String replacement utility (calls `H.replace`) |
| `a1` | Top-level model/provider resolution entry; calls `oHH`, `qq`, `rX` |
| `oHH` | Provider object builder; assembles provider descriptor from `k0`, `OqH`, `yA`, `Dd` |
| `k0` | Provider primitive constructor used by `oHH` |
| `OqH` | Provider field accessor used by `oHH` |
| `Dd` | Model metadata parser; extracts model name parts, checks `"anthropic."` prefix, calls `Ua6`, `KQH`, `SJ1`, `M8L`, `pKH`, `qq`, `$8L` |
| `qq` | Model name normaliser and tier classifier; trim + toLowerCase + tier-string matching |
| `Q0` | Tier-lookup helper called by `qq`; delegates to `BKH` |
| `pKH` | Provider-type inclusion check; tests against `mKH` list |
| `qI` | Model descriptor builder calling `UM` and `G5` |
| `LQH` | Secondary model descriptor builder; calls `G5` |
| `PE` | Provider-type classifier; calls `UM`, `G5`, `wA`; produces `"firstParty"` classification |
| `RJ1` | Tier-resolution wrapper; delegates to `PE` |
| `UM` | Provider utility calling `wA` |
| `Xt6` | Tier inclusion checker; tests against `z8L` list |
| `fQH` | Fallback tier handler; calls `tH` |
| `rX` | Model-resolution branch dispatcher; calls `qq` and `g0` |
| `g0` | Full model-descriptor assembler; calls `WA`, `H6H`, `ozH`, `MQH`, `PE`, `A2`, `UM`, `wA`, `G5`, `qI` |
| `t6` | Bootstrap telemetry emitter; calls `c` and `Z6`; emits `api_bootstrap_fetch` / `parse_failed` |
| `c` | Telemetry primitive; emits `tengu_feature_sad` (bundle.js:+1008376) |
| `Z6` | Telemetry routing helper; calls `Zx6` |
| `Zx6` | Low-level telemetry dispatch sink |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.