---
type: feature-spec
feature: "statusline"
cc_version: 2.1.196
updated: "2026-06-26"
tags: ["statusline", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.193
analysis_basis: "CC v2.1.193 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/statusline`

> Analysis basis: CC v2.1.193 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.193

---

## Overview

The `/statusline` command configures Claude Code's status line UI by spawning a subagent of type `"statusline-setup"`. It reads the user's shell PS1 configuration and instructs the subagent to derive an appropriate status line format from it. The command is a `prompt`-type registration whose handler builds and dispatches a single structured prompt string.

---

## Registration

| Field | Value |
|---|---|
| type | `prompt` |
| name | `statusline` |
| description | `Set up Claude Code's status line UI` |
| aliases | *(none)* |
| handler_method | `getPromptForCommand` |
| handler_method_start (byte) | `12964277` |
| handler_method_end (byte) | `12964898` |
| loc_byte | `12963972` |
| loc_byte_end | `12964899` |
| loc_line | `8833` |
| prompt_body.length | `76` |
| prompt_body.trace | `inline template` |
| prompt_body (citation fragment) | `"…subagent_type \"statusline-setup\"…"` |
| arbor_handler.name | `getPromptForCommand` |
| arbor_handler.kind | `Method` |
| arbor_handler.fqn | `claude-2.1.193::getPromptForCommand` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `1` |
| `handler_method_start` | `12964277` |
| `handler_method_end` | `12964898` |

Analysis basis: CC v2.1.193 bundle.js:+12963972

---

## Input Branching

The command's handler exhibits a modest number of distinct paths: it evaluates the user-supplied input string (trimming whitespace), applies safe-mode checks, and dispatches a single subagent call. Three distinct branches are identifiable from the literals and call graph, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/statusline invoked"]) --> B["Trim user input\n(e.trim — bundle.js:+12964725)"]
    B --> C{Safe-mode active?\n(--safe-mode flag check\nbundle.js:+70258)}
    C -- "Yes (safe mode)" --> D["Suggest safe-mode remediation\n('restart without --safe-mode'\nor 'unset CLAUDE_CODE_SAFE_MODE')\nbundle.js:+70313 / +70343"]
    C -- "No" --> E["Build inline prompt string\nsubagent_type: 'statusline-setup'\nuser prompt: 'Configure my statusLine\nfrom my shell PS1 configuration'\nbundle.js:+12964735"]
    E --> F["Resolve context strings\nvia argumentFormatter (El)\nbundle.js:+12964309"]
    F --> G["Dispatch subagent call\nvia subagentDispatcher (Cb)\nbundle.js:+12964584"]
    G --> H(["Subagent task queued;\nstatus line setup begins"])
    D --> I(["User informed; no subagent launched"])
```

---

## Behavioral Spec

### 1. Handler Entry — `getPromptForCommand`

The Arbor-resolved handler `getPromptForCommand` is the sole entry point for this command (resolution path: `direct`; `n_hits = 1`).

```
function getPromptForCommand(userInput, appContext):
    trimmedInput = userInput.trim()                    # bundle.js:+12964725

    if isSafeModeActive(appContext):                   # bundle.js:+70258
        message = buildSafeModeAdvisory(appContext)    # bundle.js:+70313, +70343
        return message                                 # no subagent is spawned

    promptText = buildStatuslinePrompt(trimmedInput)   # bundle.js:+12964735
    contextBlock = argumentFormatter(promptText)       # bundle.js:+12964309 (El)
    result = subagentDispatcher(contextBlock)          # bundle.js:+12964584 (Cb)
    return result
```

Analysis basis: CC v2.1.193 bundle.js:+12964277

---

### 2. Prompt Construction — `buildStatuslinePrompt`

The prompt body is a short inline template (76 characters; `"inline template"` trace). It embeds:

- A fixed `subagent_type` value of `"statusline-setup"`.
- A fixed inner prompt string: `"Configure my statusLine from my shell PS1 configuration"` (bundle.js:+12964735).

The user's trimmed input is passed to the inner prompt slot. If the user supplied no additional text, the inner prompt defaults to the fixed PS1 configuration string.

```
function buildStatuslinePrompt(trimmedInput):
    innerPrompt = (trimmedInput != "") ? trimmedInput
                                       : "Configure my statusLine from my shell PS1 configuration"
    return templateFill(
        subagent_type = "statusline-setup",
        prompt        = innerPrompt
    )
```

Analysis basis: CC v2.1.193 bundle.js:+12964735, +12963972

---

### 3. Argument Formatting — `argumentFormatter` (El)

The argument formatter (`El`) prepares the prompt text for dispatch. It calls two sub-functions:

- A string coercion utility (`at`, which itself calls `String()` — bundle.js:+29676) to normalise the prompt value.
- A context container constructor (`Ctn` — bundle.js:+70254) that wraps the normalised string into the structure expected by the subagent dispatcher.

The formatter also evaluates the `"--"` separator constant (bundle.js:+70053) and the zero-index sentinel (bundle.js:+70105), which are used to delimit argument boundaries.

```
function argumentFormatter(promptText):
    normalised = coerceToString(promptText)     # at → String()  bundle.js:+29676
    container  = buildContextContainer(normalised)  # Ctn  bundle.js:+70254
    return container
```

Analysis basis: CC v2.1.193 bundle.js:+12964309, +70215, +70254

---

### 4. Safe-Mode Advisory — `buildSafeModeAdvisory` (Ctn / Cb interaction)

When the runtime detects the `--safe-mode` flag (bundle.js:+70258), the handler short-circuits before spawning a subagent and instead produces a human-readable advisory. Two remediation strings are embedded as literals:

- `"restart without --safe-mode"` (bundle.js:+70313)
- `"unset CLAUDE_CODE_SAFE_MODE"` (bundle.js:+70343)

The boolean recognition literals `"yes"` (bundle.js:+29725) and `"on"` (bundle.js:+29731) and the numeric constant `1` (bundle.js:+29635) are used within the safe-mode flag evaluation path.

```
function buildSafeModeAdvisory(appContext):
    if flagValue(appContext, "--safe-mode") in {"yes", "on", 1}:
        return advisoryMessage(
            option_a = "restart without --safe-mode",   # bundle.js:+70313
            option_b = "unset CLAUDE_CODE_SAFE_MODE"    # bundle.js:+70343
        )
```

Analysis basis: CC v2.1.193 bundle.js:+70258, +70313, +70343

---

### 5. Subagent Dispatch — `subagentDispatcher` (Cb)

The subagent dispatcher (`Cb`) is called with the formatted context container. It relays the `subagent_type: "statusline-setup"` payload to the agent runtime. A `text`-typed output is expected in response (literal `"text"` at bundle.js:+12964327). The dispatcher also references `Ctn` (bundle.js:+70294), reusing the same context-container helper seen in the argument formatter.

```
function subagentDispatcher(container):
    response = spawnSubagent(
        type    = "statusline-setup",
        payload = container,
        outputFormat = "text"       # bundle.js:+12964327
    )
    return response
```

Analysis basis: CC v2.1.193 bundle.js:+12964584, +12964327, +70294

---

### 6. Background Jitter — `randomDelayScheduler` (e)

The identifier `e` appears in the call graph with two callees (`Math.random` at bundle.js:+14343447 and `setTimeout` at bundle.js:+14343484) and a numeric constant `2` (bundle.js:+14343445). This pattern is consistent with a randomised retry or polling back-off scheduler used by the subagent infrastructure, not by the `/statusline` handler directly. It is invoked transitively and does not affect the command's visible output.

```
function randomDelayScheduler(callback, baseMs):
    jitter = Math.random() * 2      # bundle.js:+14343445, +14343447
    setTimeout(callback, baseMs + jitter)   # bundle.js:+14343484
```

Analysis basis: CC v2.1.193 bundle.js:+14343447, +14343484

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | *(none found in depth-2 traversal)* |
| Hook registration | None observed at this registration site |
| appState changes | Spawns a `"statusline-setup"` subagent; status line UI updated as a side effect of subagent completion |
| Safe-mode guard | When `--safe-mode` is active, the command produces an advisory and does **not** mutate appState |
| Output type | `"text"` (bundle.js:+12964327) |
| Prompt length | 76 characters (inline template, bundle.js:+12963972) |
| Input trimming | Leading/trailing whitespace stripped before use (bundle.js:+12964725) |
| Background scheduling | Randomised jitter delay via `Math.random` + `setTimeout` in subagent infrastructure (bundle.js:+14343447) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.193 | Initial analysis |

---

## Common Mistakes

1. **Invoking `/statusline` while `--safe-mode` is active** — the command will not spawn a subagent and will instead emit a remediation advisory. Disable safe mode via `unset CLAUDE_CODE_SAFE_MODE` or restart without `--safe-mode` before re-invoking.
2. **Expecting interactive input to override the inner prompt** — the command uses a fixed default inner prompt (`"Configure my statusLine from my shell PS1 configuration"`) when no user input is supplied. Supplying text after `/statusline` replaces this default but must describe a PS1-compatible configuration intent.
3. **Assuming immediate UI changes** — the status line update is completed asynchronously by the `"statusline-setup"` subagent; the command returns as soon as the task is queued, not when the UI has been redrawn.
4. **Confusing `/statusline` with a live toggle** — this command sets up (or re-configures) the status line from the shell PS1; it is not a toggle for enabling/disabling the status line widget.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `__handler_statusline` | Synthetic BFS entry point for the `/statusline` command handler (not a real bundle symbol) |
| `El` | Argument formatter — normalises and wraps the prompt text into a context container |
| `at` | String coercion utility — delegates to `String()` to normalise values |
| `Ctn` | Context container constructor — wraps formatted arguments for subagent dispatch |
| `Cb` | Subagent dispatcher — spawns the `"statusline-setup"` subagent with the prepared payload |
| `e` | Random-delay scheduler — applies `Math.random`-based jitter via `setTimeout` in subagent infrastructure |

---

*Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.*