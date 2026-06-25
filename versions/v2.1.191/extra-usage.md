---
type: feature-spec
feature: "extra-usage"
cc_version: "2.1.191"
updated: "2026-06-25"
tags: ["extra-usage", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.191 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/extra-usage`

> Analysis basis: CC v2.1.191 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.191

---

## Overview

`/extra-usage` is a hidden, deprecated alias that was renamed to `/usage-credits`. When invoked, it resolves immediately via a `Promise.resolve` path and delegates its actual rendering to the same JSX-based credits/usage display component used by `/usage-credits`. The command is marked hidden so it does not appear in the slash-command picker.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `extra-usage` |
| description | `"Renamed to /usage-credits"` |
| isHidden | `true` |
| module_id | `A_o` |
| load_inline | `true` |
| loc_byte | `9108292` |
| loc_byte_end | `9108477` |
| loc_line | `3459` |
| arbor_handler.name | `w9p` |
| arbor_handler.fqn | `claude-2.1.191::w9p` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.191 bundle.js:+9108292

---

## Input Branching

This command has a simple linear flow (no conditional branching on user input). The handler resolves immediately and renders a static JSX column layout.

```
1. Command is invoked (no user arguments processed).
2. Handler (w9p / usageCreditsHandler) enters async execution.
3. Promise.resolve() is called immediately — no async I/O at the top level.
4. JSX rendering helpers (_Gn.jsxs, _Gn.jsx) are called to produce
   a column-layout UI component displaying usage/credits information.
5. The rendered JSX element is returned to the CLI shell for display.
```

Analysis basis: CC v2.1.191 bundle.js:+9107302 (Promise.resolve), +9107417 (_Gn.jsxs), +9107462 (_Gn.jsx)

---

## Behavioral Spec

### Handler Resolution

The registration object uses a `load_inline` shape, meaning the handler is not exported as a named module entry but is instead inlined as `Promise.resolve({ call: handlerIdent })`. Arbor resolved the handler via `module_id → A_o → w9p`.

```
function resolveHandler():
    return Promise.resolve({ call: usageCreditsHandler })
```

Analysis basis: CC v2.1.191 bundle.js:+9107302, +9107332

### Main Handler — usageCreditsHandler (w9p)

The handler is an `AsyncFunction`. Based on the call graph, it:

1. Resolves a reference to a named-export token (`X6t`) — likely the credits/usage data accessor or React context value.
2. Reads a secondary value (`n`) — possibly the current session's usage counters.
3. Accesses another context object (`e`) — likely app-state or theming context.
4. Calls `_Gn.jsxs` to compose a wrapper element with child elements arranged in a `"column"` layout (the string literal `"column"` appears at `bundle.js:+9107443`).
5. Calls `_Gn.jsx` for leaf JSX nodes inside that column.
6. Returns the composed JSX tree to the shell renderer.

```
async function usageCreditsHandler(context):
    creditsToken  = resolveCreditsToken(X6t)   // data or context hook
    usageCounters = readUsageCounters(n)
    appContext     = readAppContext(e)

    return jsxCompose(
        layout  = "column",
        children = [
            jsxLeaf(creditsToken, usageCounters),
            ...
        ]
    )
```

Analysis basis: CC v2.1.191 bundle.js:+9107332 (X6t), +9107352 (n), +9107361 (e), +9107417 (_Gn.jsxs), +9107443 ("column"), +9107462 (_Gn.jsx)

### Alias / Deprecation Mechanism

The `description` field is set to `"Renamed to /usage-credits"` and `isHidden: true` is set at registration time. This pattern in CC means:

- The command is NOT listed in `/help` or the autocomplete picker.
- Typing `/extra-usage` exactly will still dispatch the handler.
- No runtime redirect or error is thrown; the same rendering path as `/usage-credits` is executed.

Analysis basis: CC v2.1.191 bundle.js:+9108292 (registration object open), +9108477 (registration object close)

### Loader Dispatch

The top-level loader (`L9p`) wraps the inline load:

```
function commandLoader():
    return Promise.resolve(S_o)   // module wrapper
        .then(mod => mod[handlerKey](e))
```

Where `S_o` is the module container and `e` is the execution context passed by the CLI dispatcher.

Analysis basis: CC v2.1.191 bundle.js:+9107538 (Promise.resolve), +9107568 (S_o), +9107588 (e)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | No `tengu_*` events found in depth-2 traversal of `w9p` directly. Events in scope via shared infrastructure: `tengu_api_success` (+8938998), `tengu_lone_surrogate_sanitized` (+8938694), `tengu_context_tip_classifier_outcome` (+16672225), `tengu_feature_ok` (+1025725), `tengu_feature_bad` (+1025792) — all emitted by shared call-graph utilities, not by this command specifically. |
| Hook registration | None observed in `w9p` call graph at depth ≤ 2. |
| appState changes | None observed; handler appears read-only (renders existing state). |
| Sound | None observed. |
| Visibility | `isHidden: true` — excluded from autocomplete and `/help` listings. |
| Network I/O | None at the command handler level; any usage data is read from local state, not fetched on demand here. |

---

## Version History

| Version | Change |
|---|---|
| v2.1.191 | Initial analysis. Command registered as hidden alias pointing to the same JSX renderer as `/usage-credits`. |

---

## Common Mistakes

1. **Assuming `/extra-usage` is fully removed**: The command is hidden but still functional in v2.1.191. Users who type it verbatim will get the same output as `/usage-credits`.
2. **Expecting a redirect message**: The description `"Renamed to /usage-credits"` is metadata for tooling only; no user-visible deprecation warning is emitted at runtime by this handler.
3. **Treating `load_inline: true` as a separate module**: The handler `w9p` is inlined via `Promise.resolve({ call: w9p })` inside module `A_o`, not exported as a standalone module entry — looking for it by module ID alone in a fresh bundle grep may miss it.
4. **Confusing `L9p` with the real handler**: `L9p` is the loader/dispatch wrapper (call graph entry point); the actual rendering logic lives in `w9p` as resolved by Arbor (`arbor_handler.resolution_path: "module_id"`).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `w9p` | Main async handler for `/extra-usage` (usageCreditsHandler); resolved by Arbor via module_id `A_o` |
| `L9p` | Command loader wrapper; dispatches via `Promise.resolve` to `S_o` module |
| `S_o` | Module container holding the inlined handler reference |
| `X6t` | Credits/usage token or data accessor called inside `w9p` |
| `_Gn` | JSX runtime namespace (provides `.jsx` and `.jsxs` renderers) |
| `e` | Execution/app context object passed into the handler |
| `n` | Usage counters or secondary context value read inside `w9p` |
| `L6o` | Conversation/message formatting utility (shared, called via `e`) |
| `gsm` | Map setter helper used in message processing |
| `msm` | Auto-classifier input builder |
| `wN` | API request orchestrator (shared infrastructure) |
| `oW` | HTTP client / Anthropic SDK wrapper |
| `TZe` | WIF credentials resolve / token fetch utility |
| `ACe` | Provider-aware credentials helper |
| `Kdn` | Proxy auth helper with trust-acceptance check |
| `Iud` | Request session manager (UUID-keyed) |
| `PH` | Mantle/session handler |
| `BSn` | Auth/session state helper |
| `yud` | Provider routing helper (anthropicAws, vertex, foundry, gateway, firstParty) |
| `SCe` | Side-query / parallel request dispatcher |
| `fy` | OAuth token refresh helper |
| `Ghn` | User-agent / request header builder |
| `aje` | Main API call entry with feature-flag checks |
| `Txe` | Tool-call formatter / structured output handler |
| `etn` | Message content normalizer (push/pop path) |
| `u7e` | Alternate message normalizer |
| `wD` | Request deduplication wrapper |
| `C3r` | Request dedup key builder |
| `A2e` | Request dedup executor |
| `NF` | Agent-type resolver (builtin/custom/repl) |
| `nOd` | Agent prefix parser (`agent:builtin:`, `agent:custom:`) |
| `xD` | Thread-type checker (`repl_main_thread`) |
| `H1t` | Background worker / sweep manager |
| `L` | Worker pool sweep function |
| `Nzt` | Memory-pressure checker (freemem) |
| `I3e` | Cache file lifecycle manager (lstat/rm/readFile) |
| `Le` | Worker lifecycle utility |
| `Xer` | Worker attach/upgrade helper |
| `v3i` | Worker creation utility |
| `Rot` | Worker rotation handler |
| `h1t` | Worker heartbeat helper |
| `nt` | Background task queue / worker registry |
| `D` | Output stream / supervisor message writer |
| `x` | Request expiry cache (Date.now + 60 s TTL) |
| `v` | Focus/blur rate-limiter (blurred/focused states, 3 600 000 ms window) |
| `Cs` | CLI error exit handler (calls `process.exit(1)`) |
| `Ooe` | Model prefix checker (`claude-3-`, etc.) |
| `pMt` | Header normalizer (lowercases keys via `Object.entries`) |
| `hx` | Surrogate-pair character inspector |
| `har` | High-surrogate range checker (55296–56319) |
| `LOr` | OAuth token parser |
| `l7s` | Token field splitter/validator |
| `wOr` | Token scope/permission checker |
| `SHo` | SHA-256 hash builder (`JVa.createHash`) |
| `CBp` | Model capability finder |
| `lie` | Token header injector |
| `vOr` | Foundry resource URL rewriter |
| `ao` | Application-inference-profile checker |
| `b2e` | Bedrock model compatibility validator |
| `iD` | Deep-clone wrapper (`structuredClone`) |
| `ZVa` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `XSn` | Temperature-setting / model-config helper |
| `av` | Content-array mapper |
| `sp` | URL-encoding helper (`e.replace`) |
| `GPr` | URL builder with `encodeURIComponent` |
| `Vs` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `XKs` | Boolean coercion wrapper |
| `_y` | Session/auth state manager |
| `_ud` | Auth token fetch helper |
| `e_` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `xr` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `G2` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `nv` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `yA` | OAuth flow / user-auth orchestrator |
| `dve` | SDK error logger (`console.error`) |
| `mbe` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `Tr` | Response stream wrapper |
| `lh` | Stream element helper |
| `Oo` | Output formatter |
| `ol` | String coercion utility |
| `_r` | Request record builder |
| `rt` | String conversion wrapper |
| `uu` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `$hn` | Async-local-storage store getter (`YKs.getStore`) |
| `hCe` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `aIn` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `To` | Render target selector |
| `dpr` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `ppr` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `J8l` | Worker queue entry point |
| `Ve` | JSX utility wrapper |
| `eze` | JSX element factory (base) |
| `Pe` | JSX primitive renderer |
| `we` | JSX conditional renderer |
| `Re` | JSX list renderer |
| `cSt` | JSX composite layout builder |
| `S4` | Usage summary formatter |
| `PPr` | Usage panel renderer |
| `zp` | Credits display component |
| `usm` | Usage statistics mapper |
| `csm` | Usage category mapper |
| `hsm` | Usage row builder (push/join) |
| `M6n` | Model name finder |
| `D6n` | Schema-safe parser for usage data |
| `dsm` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `Ae` | String coercion for display values |
| `ke` | JSON.stringify wrapper |
| `kAt` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.