---
type: feature-spec
feature: "statusline"
cc_version: "2.1.191"
updated: "2026-06-25"
tags: ["statusline", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.191 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/statusline`

> Analysis basis: CC v2.1.191 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.191

---

## Overview

`/statusline` is a `prompt`-type slash command that configures Claude Code's status line UI by spawning a dedicated subagent of type `"statusline-setup"`. The handler builds a prompt derived from the user's shell PS1 configuration and delegates execution to the subagent infrastructure, allowing the status bar appearance to be tailored to the user's existing shell prompt style.

---

## Registration

| Field | Value |
|---|---|
| type | `prompt` |
| name | `statusline` |
| description | `Set up Claude Code's status line UI` |
| aliases | `[]` (none) |
| handler_method | `getPromptForCommand` |
| handler_method_start (byte) | `12861386` |
| handler_method_end (byte) | `12862007` |
| loc_byte | `12861081` |
| loc_byte_end | `12862008` |
| loc_line | `8633` |
| prompt_body.length | `76` |
| prompt_body.trace | `inline template` |
| arbor_handler.name | `getPromptForCommand` |
| arbor_handler.kind | `Method` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.fqn | `claude-2.1.191::getPromptForCommand` |
| arbor_handler.n_hits | `1` |
| `handler_method_start` | `12861386` |
| `handler_method_end` | `12862007` |

Analysis basis: CC v2.1.191 bundle.js:+12861081

---

## Input Branching

The handler exhibits two primary branches: one that prepares a content block of type `"text"` (carrying the constructed prompt) and one that finalises and returns the prompt object. The flow is essentially linear with a single conditional guard on the trimmed prompt string before assembly.

```
1. Invoke getPromptForCommand with command context
2. Retrieve the "safe-mode" flag state via hl/QZt helpers
3. Build a text content block (type = "text") from the inline template
4. Trim the resulting prompt string (e.trim at +12861834)
5. If trimmed string is non-empty → assemble final prompt payload
6. Return the assembled prompt object to the REPL
```

Because there are fewer than 3 meaningfully distinct branches, numbered pseudocode is used above.

---

## Behavioral Spec

### Handler Entry — `getPromptForCommand`

The handler is an `ObjectMethod` living inline on the registration object; the Arbor symbol graph resolved it via `direct` path with a single hit.

```
function getPromptForCommand(commandContext):
    # Step 1 – safe-mode guard
    safeModeActive = checkSafeMode()          # hl → QZt (+12861418)
    if safeModeActive:
        return safeModeDeniedResponse()       # lb → QZt (+12861693)

    # Step 2 – build the prompt string
    # The inline template (76 chars) references:
    #   subagent_type = "statusline-setup"
    #   inner prompt  ≈ "Configure my statusLine from my shell PS1 configuration"
    rawPrompt = buildInlineTemplate(
        subagentType = "statusline-setup",
        innerPrompt  = PS1_HINT              # literal @ +12861844
    )

    # Step 3 – sanitise
    trimmedPrompt = rawPrompt.trim()         # +12861834

    # Step 4 – wrap in content block
    contentBlock = {
        type:    "text",                     # literal @ +12861436
        content: trimmedPrompt
    }

    # Step 5 – return prompt payload
    return { role: "user", content: [contentBlock] }
```

Analysis basis: CC v2.1.191 bundle.js:+12861386

---

### Safe-Mode Helpers

Two small helpers gate execution when `--safe-mode` is active.

```
function checkSafeMode():            # hl  @ +12861418
    flag = rt(...)                   # rt  @ +69737 — normalise flag value
    return QZt(flag)                 # QZt @ +69776 — resolve boolean

function safeModeDeniedResponse():   # lb  @ +12861693
    return QZt(                      # QZt @ +69816
        message = "restart without --safe-mode",   # literal @ +69835
        alt     = "unset CLAUDE_CODE_SAFE_MODE"    # literal @ +69865
    )
```

Relevant string constants confirmed in literals:
- `"--safe-mode"` — bundle.js:+69780
- `"restart without --safe-mode"` — bundle.js:+69835
- `"unset CLAUDE_CODE_SAFE_MODE"` — bundle.js:+69865

Analysis basis: CC v2.1.191 bundle.js:+69737

---

### Subagent Dispatch — `wN` (subagent runner)

After the prompt payload is returned by `getPromptForCommand`, the REPL dispatches it through the subagent pipeline. The call graph shows `wN` is reached from the handler context (`e → wN` at +16670796).

```
function dispatchSubagent(promptPayload):
    # Identify the target subagent
    agentType = "statusline-setup"

    # Resolve API client (oW) and session metadata
    client = buildApiClient(oW)             # +8937295

    # Hash-based deduplication of the request
    requestHash = SHo.hash(promptPayload)   # SHo → JVa.createHash("sha256") @ +8936317

    # Launch subagent execution
    result = await executeAgent(
        client      = client,
        agentType   = agentType,
        prompt      = promptPayload,
        maxRetries  = 2,                    # literal @ +8937154
        cacheWindow = "1h"                  # literal @ +8938216
    )

    return result
```

Analysis basis: CC v2.1.191 bundle.js:+8937282

---

### API Client Construction — `oW` (API orchestrator)

The `oW` function assembles the outbound HTTP request with the following notable characteristics derived from literals found in its call graph:

- **User-Agent header**: `"User-Agent"` — bundle.js:+3025859
- **Session ID header**: `"X-Claude-Code-Session-Id"` — bundle.js:+3025877
- **Agent ID header**: `"x-claude-code-agent-id"` — bundle.js:+3026035
- **Parent agent ID header**: `"x-claude-code-parent-agent-id"` — bundle.js:+3026098
- **Base URL**: `"https://api.anthropic.com"` — bundle.js:+2350582
- **WIF token exchange mode**: `"wif_token_exchange"` — bundle.js:+2351361
- **OAuth token check log messages** confirmed at +3026414 and +3026468
- **Timeout on proxy auth helper**: 30000 ms — bundle.js:+1865944
- **Session refresh timeout**: 600000 ms — bundle.js:+3026786

Analysis basis: CC v2.1.191 bundle.js:+3025805

---

### Prompt String Details

The `prompt_body` is an inline template of length 76 characters. Key facts:

- **subagent_type**: `"statusline-setup"` (hardcoded)
- **Inner prompt hint**: the literal `"Configure my statusLine from my shell PS1 configuration"` (bundle.js:+12861844) forms the core instruction delivered to the subagent.
- The template is short (76 chars); most semantic weight is carried by the `subagent_type` routing and the PS1 hint.

Analysis basis: CC v2.1.191 bundle.js:+12861386 — +12862007

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_api_success` | Fired on successful subagent API round-trip (bundle.js:+8938998) |
| Telemetry — `tengu_prompt_cache_1h_config` | Fired when the 1-hour prompt cache window is configured (bundle.js:+13616098) |
| Telemetry — `tengu_lone_surrogate_sanitized` | Fired if lone Unicode surrogates are found and stripped from the prompt (bundle.js:+8938694) |
| Telemetry — `tengu_context_tip_classifier_outcome` | Fired after context-tip classification runs on the response (bundle.js:+16672225) |
| Telemetry — `tengu_bg_retire_pinned_low_mem` | Fired when background workers are retired due to low memory during dispatch (bundle.js:+17375231) |
| Telemetry — `tengu_bg_prewarm_per_sweep` | Fired during background worker pre-warm sweeps (bundle.js:+17375352) |
| Telemetry — `tengu_bg_retire_grace_bridged_min` | Fired when background worker grace retirement is bridged (bundle.js:+13163592) |
| Telemetry — `tengu_bg_attach_upgrade` | Fired when a background worker is upgraded/attached (bundle.js:+13163664) |
| Telemetry — `tengu_feature_ok` / `tengu_feature_bad` | Feature flag audit events (bundle.js:+1025725 / +1025792) |
| Safe-mode guard | When `--safe-mode` is active, the command returns a denial message instructing the user to restart without `--safe-mode` or unset `CLAUDE_CODE_SAFE_MODE`; no subagent is spawned |
| Subagent type | Creates a subagent of type `"statusline-setup"` — this is a distinct agent slot, not the main REPL thread |
| Prompt cache | Uses a 1-hour prompt cache window (`"1h"` literal at +8938216) |
| API headers mutated | `X-Claude-Code-Session-Id`, `x-claude-code-agent-id`, `x-claude-code-parent-agent-id` are set on the outgoing request |
| No appState write | No direct `appState` write was found within depth-2 traversal of this command |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.191 | Initial analysis |

---

## Common Mistakes

1. **Invoking in `--safe-mode`**: The command silently returns a denial when `CLAUDE_CODE_SAFE_MODE` is set or `--safe-mode` is passed. The UI will display instructions to restart without the flag; no statusline configuration will occur.
2. **Expecting instant UI changes**: `/statusline` delegates to a `"statusline-setup"` subagent that runs asynchronously. The shell PS1 reflection may not appear until the subagent completes its setup turn.
3. **Missing PS1 in the environment**: The inner prompt references the shell PS1 configuration. If PS1 is not set or is minimal, the statusline setup may produce a generic default rather than a customised layout.
4. **Confusing with a settings command**: `/statusline` is a `prompt`-type command, not a settings toggle. It does not expose key/value pairs; it instructs a subagent to perform setup on the user's behalf.
5. **Re-running unnecessarily**: Because the command spawns a subagent and may cache the request for up to 1 hour (`"1h"` cache window), repeated rapid invocations within that window may return a cached response rather than re-running setup.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `__handler_statusline` | Synthetic BFS entry point for the `/statusline` command handler |
| `hl` | Safe-mode flag checker (depth-1 from handler) |
| `rt` | Boolean/flag normaliser utility |
| `QZt` | Safe-mode flag resolver (used by both `hl` and `lb`) |
| `lb` | Safe-mode denial response builder |
| `L6o` | Conversation/message slice utility (token window management) |
| `gsm` | Message store setter |
| `Cs` | CLI error emitter / process exit wrapper |
| `har` | Message content handler / tool result assembler |
| `hx` | Character-level string slicer (surrogate-aware) |
| `msm` | Auto-classifier input transformer |
| `ke` | JSON stringifier wrapper |
| `wN` | Subagent runner / main API dispatch loop |
| `xf` | API fetch wrapper (depth-1 from `wN`) |
| `wt` | HTTP transport utility |
| `oW` | API client / request orchestrator |
| `mz` | Provider mode selector |
| `p3r` | Header key/value parser |
| `Ks` | Auth context resolver |
| `Mz` | Error message formatter (GitHub issues link) |
| `GPr` | URL encoder for API paths |
| `T` | Request header builder / model string formatter |
| `Ng` | OAuth token refresher |
| `XKs` | Boolean coercion helper |
| `_y` | API key / credential resolver |
| `_ud` | Token utility / Zod schema checker |
| `Kdn` | Proxy auth helper executor |
| `Iud` | Streaming response handler / SSE parser |
| `PH` | Mantle provider handler |
| `G2` | Provider capability lookup |
| `fy` | Request retry orchestrator |
| `Tud` | Streaming state machine |
| `yud` | Background subagent session manager |
| `SCe` | Session expiry / cloud gateway handler |
| `Rdr` | Timestamp / request ID generator |
| `pMt` | HTTP header normaliser (lowercase) |
| `dve` | SDK error logger |
| `BSn` | Response finaliser |
| `D` | Supervisor / output writer |
| `x` | Request deduplication / cache store |
| `v` | Focus/blur state tracker (token refresh window) |
| `Ooe` | Provider prefix matcher |
| `nv` | Input handler utility |
| `yA` | Agent session launcher |
| `ACe` | WIF token exchange handler |
| `TZe` | WIF credentials resolver / federated auth fetcher |
| `I` | Token bucket / rate-limit tracker |
| `h` | Side-query stream handler |
| `b2e` | Model capability checker (Claude 3/4 series) |
| `ao` | Application inference profile resolver |
| `o1` | Request context builder |
| `lie` | Auth header injector |
| `$At` | Auth token store |
| `vOr` | Foundry resource ID normaliser |
| `_` | Feature flag registry |
| `a` | Feature flag evaluator |
| `CBp` | Model list finder |
| `SHo` | SHA-256 hash utility (request deduplication) |
| `Ghn` | API response header extractor |
| `ol` | String coercion utility |
| `_r` | React/render helper |
| `uu` | ANSI/terminal formatter |
| `$hn` | AsyncLocalStorage store accessor |
| `hCe` | Response content extractor |
| `aIn` | Input validator |
| `aje` | Agent invocation entry (REPL main thread) |
| `To` | Agent type router |
| `dpr` | Dispatch pre-processor |
| `nt` | Agent notification / state tracker |
| `ppr` | Post-processor |
| `wD` | Worker dispatch coordinator |
| `C3r` | Worker context builder |
| `A2e` | Worker result accumulator |
| `L` | Background worker lifecycle manager |
| `V` | Worker pool controller |
| `Nzt` | Memory pressure monitor |
| `J8l` | Worker retirement grace-period manager |
| `I3e` | File-based conversation loader |
| `Le` | Conversation log writer |
| `U` | Worker identity set |
| `Gn` | Worker heartbeat |
| `W` | Global state store |
| `j` | Worker instance |
| `Xer` | Worker attach/upgrade handler |
| `q` | Keyboard event / worker respawn handler |
| `ZVa` | Zone/context identifier |
| `sp` | String sanitiser (replace control chars) |
| `XSn` | Subagent context injector |
| `av` | Argument mapper |
| `Txe` | Tool execution context builder |
| `P4` | Tool invocation randomiser |
| `Sc` | Tool scheduler |
| `etn` | Content block stack (push/pop) |
| `Qen` | Content block validator |
| `iD` | Structured clone utility |
| `u7e` | Content block normaliser |
| `Zen` | Content replacement handler |
| `Ve` | Event emitter |
| `eze` | Base event bus |
| `LOr` | OAuth response parser |
| `l7s` | Scope string parser |
| `wOr` | Token capability checker |
| `mbe` | Metrics batch emitter |
| `Tr` | Terminal renderer |
| `lh` | Layout helper |
| `Oo` | Output object |
| `H1t` | History/session tracker |
| `v3i` | Version index helper |
| `Rot` | Rotation/rollover handler |
| `h1t` | History item builder |
| `NF` | Named agent resolver |
| `nOd` | Agent prefix decoder |
| `xD` | Agent path prefix checker |
| `kAt` | Cache control tagger |
| `S4` | Side-query runner |
| `ev` | Event dispatcher |
| `PPr` | Prompt payload builder |
| `zp` | Prompt schema validator |
| `usm` | User message serialiser |
| `csm` | Content serialiser (map) |
| `hsm` | History serialiser (push/join) |
| `M6n` | Model selector (find) |
| `cSt` | Context state tracker |
| `Pe` | Provider event emitter |
| `Re` | Response event emitter |
| `D6n` | Response schema parser (safeParse) |
| `we` | Write event emitter |
| `Ae` | String assertion helper |