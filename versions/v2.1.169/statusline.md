---
type: feature-spec
feature: "statusline"
cc_version: "2.1.169"
updated: "2026-06-11"
tags: ["statusline", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.169 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/statusline`

> Analysis basis: CC v2.1.169 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.169

---

## Overview

`/statusline` is a `prompt`-type slash command that bootstraps Claude Code's terminal status-line UI by delegating to a dedicated `statusline-setup` subagent. The command reads the user's existing shell PS1 configuration and instructs the subagent to configure a matching status line. The handler is implemented inline as a `getPromptForCommand` ObjectMethod on the registration object.

---

## Registration

| Field | Value |
|---|---|
| type | `prompt` |
| name | `statusline` |
| description | Set up Claude Code's status line UI |
| aliases | *(none)* |
| handler_method | `getPromptForCommand` |
| handler_method_start | `bundle.js:+12869631` |
| handler_method_end | `bundle.js:+12870252` |
| loc_byte | `12869326` |
| loc_byte_end | `12870253` |
| loc_line | `9139` |
| prompt_body.length | 76 characters |
| prompt_body.trace | `inline template` |
| arbor_handler.name | `getPromptForCommand` |
| arbor_handler.fqn | `claude-2.1.169::getPromptForCommand` |
| arbor_handler.kind | `Method` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.169 bundle.js:+12869326

---

## Input Branching

The command has a straightforward linear flow with one internal branch around safe-mode detection. Two branches are present, so numbered pseudocode is appropriate.

1. **Invocation received** — `getPromptForCommand` is called (bundle.js:+12869637).
2. **Safe-mode check** — helper `CK` inspects the runtime environment for the `--safe-mode` flag (bundle.js:+12869663). If safe-mode is active, a hint is injected recommending the user run `restart without --safe-mode` or `unset CLAUDE_CODE_SAFE_MODE` (bundle.js:+64601, +64631) before proceeding.
3. **Prompt assembly** — The handler constructs a fixed-length (76-character) inline template string instructing the agent to create a subagent with `subagent_type "statusline-setup"` and an embedded prompt derived from the literal `"Configure my statusLine from my shell PS1 configuration"` (bundle.js:+12870089).
4. **Text-type return** — The assembled prompt is returned with kind `"text"` (bundle.js:+12869681) for the agent runtime to dispatch.

---

## Behavioral Spec

### Handler Entry: `getPromptForCommand`

```
function getPromptForCommand(commandContext):
    safeMode = checkSafeMode(commandContext)          // CK → xF6
    if safeMode:
        appendSafeModeHint(commandContext)            // FJ → xF6
        // hint contains "restart without --safe-mode"
        // and "unset CLAUDE_CODE_SAFE_MODE"

    userInput = commandContext.userInput.trim()       // H.trim at +12870079

    subagentPrompt = buildStatuslinePrompt(userInput)
    // Builds inline template (length=76) that:
    //   1. Specifies subagent_type as "statusline-setup"
    //   2. Passes the prompt fragment referencing
    //      the user's shell PS1 configuration

    return { type: "text", content: subagentPrompt }
```

Analysis basis: CC v2.1.169 bundle.js:+12869631

---

### Safe-Mode Detection: `checkSafeMode` (`CK`)

```
function checkSafeMode(context):
    flag = parseArgFlag(context.argv, "--safe-mode")  // _6, xF6 at +64546
    return flag !== null && flag !== 0
```

- The `"--safe-mode"` string constant is tested at bundle.js:+64546.
- A separator token `"--"` is recognised at bundle.js:+64341 to stop flag scanning.
- Returns a boolean indicating whether safe-mode is active.

Analysis basis: CC v2.1.169 bundle.js:+64503, +64542, +64546

---

### Safe-Mode Hint Injection: `appendSafeModeHint` (`FJ`)

```
function appendSafeModeHint(context):
    hints = [
        "restart without --safe-mode",    // +64601
        "unset CLAUDE_CODE_SAFE_MODE"     // +64631
    ]
    context.warnings.push(formatHint(hints))
```

Analysis basis: CC v2.1.169 bundle.js:+12869938, +64582, +64601, +64631

---

### Prompt Construction and User-Input Normalisation

The handler trims the raw user input (`H.trim` at bundle.js:+12870079) before embedding it. The prompt body (76 characters, inline template) instructs the agent to:

1. Create a subagent with `subagent_type "statusline-setup"`.
2. Pass an embedded sub-prompt whose semantic content aligns with the literal `"Configure my statusLine from my shell PS1 configuration"` (bundle.js:+12870089).

The returned object carries `type: "text"` (bundle.js:+12869681), which tells the command dispatcher to forward the assembled string directly to the agent as a user turn.

Analysis basis: CC v2.1.169 bundle.js:+12869631–12870252

---

### Subagent Dispatch: `statusline-setup`

The prompt explicitly targets a named subagent type (`"statusline-setup"`). This subagent is responsible for the actual inspection of the user's shell environment (PS1 variable, shell type) and emitting the appropriate status-line configuration. The `/statusline` command itself performs no shell inspection; it only assembles and delivers the delegation prompt.

Analysis basis: CC v2.1.169 bundle.js:+12870089 (prompt_body trace: inline template)

---

### Log / Transcript Writing (`StK` → `TBH`, `htK`)

The call graph reaches a log-writing cluster through `N` → `StK`. This subsystem:

- Manages append-based transcript files via `Mh.appendFile` (bundle.js:+208216).
- Rotates or renames log files when they grow beyond a threshold, using `Mh.rename` / `Mh.unlink` (bundle.js:+207884, +207924).
- Uses `Buffer.byteLength` (bundle.js:+208611) for size accounting.
- Debounces writes using `clearTimeout` / `setTimeout` / `setImmediate` (bundle.js:+61742, +61906, +61999) with a debounce window of 1000 ms (bundle.js:+61630) and a batch limit of 100 items (bundle.js:+61651).
- Registers a process-exit hook via `ZGA.register` through `Z9` (bundle.js:+62328) to flush pending writes on shutdown.
- Filters content marked `"debug"` at log level (bundle.js:+208891).

Analysis basis: CC v2.1.169 bundle.js:+208403, +208428, +208611, +208661

---

### Bootstrap Fetch Utility (`H` cluster)

A secondary call chain from `H` handles an API bootstrap fetch (literal `"[Bootstrap] Fetching"` at bundle.js:+16097956). Key details:

- Sets `Content-Type: application/json` and `User-Agent` headers (bundle.js:+16098041, +16098075).
- Applies a 5000 ms timeout (bundle.js:+16098157).
- Emits telemetry event `"api_bootstrap_fetch"` with outcomes `"parse_failed"` or `"[Bootstrap] Fetch ok"` (bundle.js:+16098278, +16098300, +16098330).
- Uses a `MA.get` cache lookup before attempting a live fetch (bundle.js:+16097992).
- Data field label `"data"` and a chunk size of 1024 bytes (bundle.js:+16412958, +16413011) govern response streaming.
- Path segments are truncated to 40 characters (bundle.js:+16533353).

Analysis basis: CC v2.1.169 bundle.js:+16097954

---

### Model-Tier Resolution (`M9` → `Cc` → `c9`)

The call graph traverses a model-tier resolution chain. Recognised tier literals found in the traversal:

| Literal | Location |
|---|---|
| `"opusplan"` | bundle.js:+2252174 |
| `"[1m]"` | bundle.js:+2252200 |
| `"sonnet"` | bundle.js:+2252215 |
| `"haiku"` | bundle.js:+2252254 |
| `"opus"` | bundle.js:+2252293 |
| `"best"` | bundle.js:+2252330 |
| `"firstParty"` | bundle.js:+2248333 |
| `"anthropicAws"` | bundle.js:+2105867 |
| `"gateway"` | bundle.js:+2105887 |
| `"mantle"` | bundle.js:+2249023 |

The resolver normalises model names to lowercase (`.toLowerCase` at bundle.js:+2252089), strips whitespace (`.trim` at bundle.js:+2252078), and replaces alias tokens. The `"anthropic."` prefix (bundle.js:+2246054) is tested via `K.startsWith` (bundle.js:+2246041) to distinguish first-party from third-party models.

Analysis basis: CC v2.1.169 bundle.js:+2248110, +2252078

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_sad` (bundle.js:+1014069) |
| Subagent dispatch | Creates a `statusline-setup` subagent via prompt delegation |
| Log / transcript write | Append-based log file updated through debounced writer (`StK`/`TBH`/`htK`) |
| Process-exit hook | `ZGA.register` called via `Z9` (bundle.js:+62328) to flush transcript on exit |
| Safe-mode warning | Hint messages injected when `--safe-mode` flag is detected |
| API bootstrap fetch | Conditional fetch with 5000 ms timeout; result cached in `MA` map |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.169 | Initial analysis |

---

## Common Mistakes

1. **Running in safe-mode**: Invoking `/statusline` while `--safe-mode` is active will cause the command to inject warning hints about restarting or unsetting `CLAUDE_CODE_SAFE_MODE`. The subagent prompt is still dispatched, but safe-mode restrictions may prevent the subagent from reading shell configuration files.
2. **Expecting direct shell integration**: `/statusline` does not itself parse the PS1 variable or modify shell configuration. It delegates entirely to the `statusline-setup` subagent; any failure in that subagent will not produce a fallback from the slash command itself.
3. **Confusing the prompt length with its effect**: The prompt body is intentionally short (76 characters) and is a delegation directive, not a detailed configuration spec. The actual configuration logic resides in the `statusline-setup` subagent handler.
4. **Assuming the command is interactive**: The command assembles a fixed prompt and returns immediately. There is no follow-up prompt loop or interactive clarification step within `/statusline` itself.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `__handler_statusline` | Synthetic BFS entry point for the `/statusline` command handler |
| `CK` | Safe-mode flag checker (inspects `--safe-mode` CLI argument) |
| `_6` | Argument flag parser primitive (string coercion helper) |
| `xF6` | Flag value resolver / formatter shared by `CK` and `FJ` |
| `FJ` | Safe-mode hint injector |
| `H` | Composite utility namespace (trim, includes, replace, bootstrap fetch, etc.) |
| `N` | Prompt normalization / log routing dispatcher |
| `ItK` | Inner normalization sub-dispatcher |
| `vGA` | Normalization variant handler (calls `yoK`, `hoK`) |
| `CH` | JSON serialization helper (wraps `JSON.stringify`) |
| `R4` | Text redaction / truncation utility |
| `qZA` | Mapped-segment builder for redacted output |
| `q` | Argument/token array with `.at` accessor |
| `A` | Path or model-name string (lowercase form) |
| `rBH` | Write-trigger wrapper calling `lEA` |
| `lEA` | Low-level file write dispatcher (`H.write`) |
| `StK` | Debounced transcript/log writer orchestrator |
| `TBH` | Core debounce engine (clearTimeout / setTimeout / setImmediate) |
| `_4H` | Log-path builder (joins segments, resolves via `I6`) |
| `l6` | Log-level filter constant or helper |
| `n56` | Error-code handler (tests `"EISDIR"`) |
| `MZA` | Log file path resolver (uses `P6H.join` and `I6`) |
| `Vo8` | Log rotation handler (stat → rename / unlink) |
| `htK` | Append-file writer (mkdir → appendFile → rotate) |
| `Z9` | Process-exit hook registrar (calls `ZGA.register`) |
| `P$` | Request or context parameter bag |
| `w2_` | Input string splitter / trimmer / indexer |
| `u6H` | Set membership checker (`vO4.has`) |
| `n3` | Text replacement helper (`H.replace`) |
| `M9` | Model-tier resolution entry point |
| `Cc` | Model-name normalizer and tier classifier |
| `tY` | Tier classification sub-helper |
| `pU` | Provider-prefix parser |
| `CC` | Model-name mapping and alias expander |
| `c9` | Core model-string normalizer (trim, lowercase, replace) |
| `u2` | ZLH-based model lookup helper |
| `TLH` | Tier inclusion tester (`GLH.includes`) |
| `Mk` | Model-alias resolver (`zM`, `F5`) |
| `QcH` | Alternate alias resolver (uses `F5`) |
| `AE` | Model-alias entry builder (`zM`, `F5`, `YA`) |
| `dG1` | Alias-delegation wrapper (calls `AE`) |
| `zM` | Provider enum / tag resolver (calls `YA`) |
| `__8` | Tier allowlist checker (`Q5L.includes`) |
| `dcH` | Decode/convert helper (calls `_6`) |
| `eD` | Extended-dispatch normalizer (calls `c9`, `hG`) |
| `hG` | Full model-descriptor builder |
| `o6` | Telemetry / event emitter (fires `tengu_feature_sad`) |
| `d` | Telemetry event payload builder |
| `K6` | Telemetry transport (calls `c76`) |
| `c76` | Low-level telemetry send primitive |
| `sBH` | Normalization side-effect helper (called by `N`) |
| `ItK` | Secondary normalization sub-path |
| `RI` | Shared resolve-or-identity utility |
| `fZA` | Fallback-value helper |
| `yoK` | Normalization variant A (called by `vGA`) |
| `hoK` | Normalization variant B (called by `vGA`) |
| `StK` | Log writer orchestrator (also listed above) |
| `$h` | Shared state or configuration accessor |
| `$ZA` | Size-cap enforcement utility |
| `Qg6` | Async promise chain anchor in log writer |
| `htK` | Append-file writer (also listed above) |
| `_M6` | Path-segment constant or resolver |
| `A_` | Path join auxiliary |
| `I6` | Absolute path resolver |
| `E8` | File system error classifier |
| `k8` | Rotation decision helper |
| `P6H` | Node `path` module alias |
| `Mh` | Node `fs/promises` module alias |
| `ZGA` | Process-lifecycle / exit-handler registry |
| `MA` | Bootstrap-fetch response cache (Map) |
| `YY5` | Post-fetch processing helper |
| `$1` | Streaming chunk accumulator |
| `ZLH` | Model-lookup table |
| `GLH` | Allowed-tier list constant |
| `Q5L` | Allowlist array for tier gate |
| `F5` | Model descriptor factory |
| `YA` | Provider tag factory |
| `FA` | Model-family classifier |
| `N68` | Name collision guard |
| `gcH` | Model-group classifier |
| `QG1` | Model-group entry builder |
| `B5L` | Capability-flag setter |
| `F5L` | Feature-flag applicator |
| `x2` | Descriptor field setter |
| `yA` | Descriptor initializer |
| `h8H` | Hash or fingerprint helper |
| `cDH` | Capability descriptor helper |
| `ccH` | Context-length / capability constant |
| `$ZA` | Log size-cap utility (also listed above) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.