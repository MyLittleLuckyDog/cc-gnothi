---
type: feature-spec
feature: "feedback"
cc_version: "2.1.163"
updated: "2026-06-05"
tags: ["feedback", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.163 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/feedback`

> Analysis basis: CC v2.1.163 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.163

---

## Overview

The `/feedback` command (also reachable as `/share` or `/bug`) allows users to submit feedback, report a bug, or share a conversation with Anthropic. Before opening the feedback UI, the command performs a multi-stage eligibility check: it consults environment variables, the authentication context, and — for enterprise/team accounts — an organization-level policy flag (`allow_product_feedback`). Only after all gates pass does the handler render the feedback JSX component and dispatch the conversation payload.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `feedback` |
| description | `Submit feedback, report a bug, or share your conversation` |
| argumentHint | `[report]` |
| aliases | `share`, `bug` |
| module_id | `quq` |
| load_inline | `true` |
| loc_byte | `10976026` |
| loc_byte_end | `10976249` |
| loc_line | `7289` |
| arbor_handler.name | `bzf` |
| arbor_handler.fqn | `claude-2.1.163::bzf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.163 bundle.js:+10976026

---

## Input Branching

The command has more than three distinct branches across environment-variable checks, telemetry mode checks, provider checks, and org-policy checks. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/feedback invoked"]) --> B{DISABLE_FEEDBACK_COMMAND\nor DISABLE_BUG_COMMAND set?}
    B -- yes --> ERR1["Show: '/feedback has been disabled via\nthe DISABLE_FEEDBACK/BUG_COMMAND\nenvironment variable'"]
    B -- no --> C{CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC set?}
    C -- yes --> ERR2["Show: '/feedback has been disabled via\nthe CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC\nenvironment variable'"]
    C -- no --> D{Telemetry mode}
    D -- "essential-traffic" --> ERR2b["Same nonessential-traffic disabled message"]
    D -- "no-telemetry" --> ERR2b
    D -- default --> E{Auth provider check}
    E -- "bedrock / foundry /\nanthropicAws / mantle /\nvertex / gateway" --> F["Resolve provider display name\n(Amazon Bedrock, Vertex AI,\nMicrosoft Foundry, Claude Platform on AWS,\nAmazon Bedrock Mantle, an API gateway)"]
    F --> G{No Anthropic credentials\n(no_creds)?}
    G -- yes --> ERR3["Show: provider name +\n'Anthropic auth not used on\nthird-party providers'"]
    G -- no --> H{Organization plan check}
    E -- firstParty --> H
    H -- "enterprise or team plan" --> I{allow_product_feedback\npolicy flag?}
    I -- false --> ERR4["Show: '/feedback has been disabled\nby your organization's policy'"]
    I -- true --> J["Render feedback JSX component\n(handler: bzf → Auq)"]
    H -- other plan --> J
    J --> K["Build payload: bundle, provider,\ntimestamp, conversation data\nHTTP POST (public endpoint)"]
    K --> L([Done])
```

Analysis basis: CC v2.1.163 bundle.js:+10953901, +10953919, +10954060, +10954178, +10954342, +10954949

---

## Behavioral Spec

### 1. Top-level handler dispatch (`bzf` → `Auq`)

The Arbor-resolved handler is `bzf` (AsyncFunction). Its first significant action is to call the UI factory function (`Auq`), which constructs the JSX tree for the feedback panel.

```
async function feedbackHandler(commandArgs):
    timestamp = Date.now()               // loc_byte: 10975396
    uiComponent = buildFeedbackUI(commandArgs, timestamp)
    return uiComponent
```

Analysis basis: CC v2.1.163 bundle.js:+10975857, +10975396

---

### 2. Environment-variable and telemetry gate (`kbH`)

Before any UI is rendered, the eligibility function (`kbH`) validates several environment conditions in order:

```
function checkEligibility(env, authContext, orgPolicy):

    // Gate 1: explicit per-command disable flags
    if env.DISABLE_FEEDBACK_COMMAND == "disabled":
        return error("/feedback has been disabled via the DISABLE_FEEDBACK_COMMAND environment variable")
    if env.DISABLE_BUG_COMMAND == "disabled":
        return error("/feedback has been disabled via the DISABLE_BUG_COMMAND environment variable")

    // Gate 2: non-essential traffic suppression
    if env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC is set:
        return error("/feedback has been disabled via the CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC environment variable")

    // Gate 3: telemetry mode (via Dq / RSA / eH chain)
    mode = resolveTelemetryMode(env)          // returns "essential-traffic", "no-telemetry", or "default"
    if mode in ["essential-traffic", "no-telemetry"]:
        return error("... CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC ...")

    return eligible
```

Analysis basis: CC v2.1.163 bundle.js:+10953901, +10953919, +10954060, +10954178, +1014267, +1014326

---

### 3. Provider detection and credential check (`XA`, `rU`, `ad`)

After the environment gate, the handler determines the authentication provider via the `XA` helper and maps it to a human-readable display name.

```
function resolveProviderLabel(authContext):
    provider = getProviderKind(authContext)   // returns one of the known provider strings
    switch provider:
        case "bedrock"       → label = "Amazon Bedrock"
        case "vertex"        → label = "Vertex AI"
        case "foundry"       → label = "Microsoft Foundry"
        case "anthropicAws"  → label = "Claude Platform on AWS"
        case "mantle"        → label = "Amazon Bedrock (Mantle)"
        case "gateway"       → label = "an API gateway"
        case "firstParty"    → label = null   // no restriction label
    return label
```

For non-firstParty providers the credential availability is also checked. When no Anthropic credentials are present (`no_creds`), the command shows the provider label alongside "Anthropic auth not used on third-party providers" and exits without opening the feedback form.

```
function checkProviderCredentials(authContext):
    label = resolveProviderLabel(authContext)
    if label is not null AND credentialKind(authContext) == "no_creds":
        return error(label + " — no Anthropic credentials")
    return ok
```

Analysis basis: CC v2.1.163 bundle.js:+10954442, +10954457, +10954474, +10954549, +10954620, +10954704, +10954787, +10954872, +10954949, +10954966, +2096693, +2096743, +2096799, +2096853, +2096901, +2096910

---

### 4. Organization policy gate (`W9`, `e4H`)

For accounts on an `enterprise` or `team` plan, the handler queries the `allow_product_feedback` policy key. If the key resolves to false the command is blocked.

```
function checkOrgPolicy(orgContext):
    plan = orgContext.plan   // "enterprise" | "team" | other
    if plan in ["enterprise", "team"]:
        allowed = orgContext.policies.get("allow_product_feedback")
        if not allowed:
            return error("/feedback has been disabled by your organization's policy")
    return ok
```

Analysis basis: CC v2.1.163 bundle.js:+4178044, +4178079, +4178345, +10954342

---

### 5. Feedback UI construction and POST submission (`Auq`, `bzf`)

When all gates pass, the JSX component is constructed (`K8A.createElement`). The outbound POST uses the `public` endpoint classification. The payload is assembled from:

- `bundle` — version string
- `provider` — resolved provider label
- conversation transcript data
- timestamp from `Date.now()`

A 30 000 ms timeout is applied to the network call.

```
async function submitFeedback(payload):
    timeout = 30000                           // loc_byte: 10975415
    response = await httpPost(PUBLIC_ENDPOINT, payload, { timeout })
    return response
```

The endpoint visibility is marked `"public"` (bundle.js:+10975832). The HTTP method is `"post"` (bundle.js:+10955006).

Analysis basis: CC v2.1.163 bundle.js:+10975639, +10975832, +10955006, +10975415

---

### 6. Transcript / conversation log helper (`icK`, `ncK`, `i2A`, `r2A`)

The `icK` subsystem handles reading and rotating the local conversation log that is optionally attached to feedback submissions. Key operations observed in the call graph:

```
function manageConversationLog(logDir):
    logPath = pathJoin(logDir, logFilename)           // r2A
    stat = fs.stat(logPath)                           // i2A: Zy.stat
    if logPath.endsWith(".txt"):
        // rotate: rename to dated copy, unlink old
        rotatedPath = logPath.slice(0, -4) + dateSuffix
        fs.rename(logPath, rotatedPath)               // i2A: Zy.rename
        if byteSize > threshold:
            fs.unlink(rotatedPath)                    // i2A: Zy.unlink
    fs.mkdir(logDir, { recursive: true })             // ncK: Zy.mkdir
    fs.appendFile(logPath, entry)                     // ncK: Zy.appendFile
    bufferByteLength = Buffer.byteLength(entry)       // icK: Buffer.byteLength
```

File rotation uses a `.txt` suffix check and a log-size threshold of 4 bytes for the slice offset.

Analysis basis: CC v2.1.163 bundle.js:+205010, +205021, +205043, +205073, +205113, +205317, +205376, +205469

---

### 7. Bootstrap fetch helper (`H`, `v`)

The `H` → `v` call chain performs a lightweight bootstrap fetch before the main feedback submission. It sets standard HTTP headers (`Content-Type: application/json`, `User-Agent`) and logs `[Bootstrap] Fetching` / `[Bootstrap] Fetch ok` to the debug channel. A 5 000 ms timeout governs this pre-flight.

```
async function bootstrapFetch(url, options):
    timeout = 5000                               // loc_byte: 15724419
    headers = {
        "Content-Type": "application/json",
        "User-Agent":   buildUserAgent()
    }
    log("[Bootstrap] Fetching", url)
    response = await fetch(url, { headers, timeout })
    log("[Bootstrap] Fetch ok")
    return response
```

A parse failure emits the telemetry sub-event `parse_failed` (bundle.js:+15724562) and fires the `api_bootstrap_fetch` event (bundle.js:+15724540).

Analysis basis: CC v2.1.163 bundle.js:+15724218, +15724303, +15724318, +15724337, +15724419, +15724540, +15724562, +15724592

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_sad` (bundle.js:+1010365) — fired on the sad-path (user dissatisfaction signal) |
| Bootstrap telemetry sub-event | `api_bootstrap_fetch` / `parse_failed` (bundle.js:+15724540, +15724562) |
| HTTP POST | Sends conversation payload to the `public` feedback endpoint; method `"post"` |
| Network timeout (feedback) | 30 000 ms (bundle.js:+10975415) |
| Network timeout (bootstrap) | 5 000 ms (bundle.js:+15724419) |
| File I/O | Conversation log append (`fs.appendFile`) and optional rotation (`fs.rename`, `fs.unlink`) under the log directory |
| MXA hook registration | `j9` calls `MXA.register` (bundle.js:+60323) — registers a cleanup/shutdown hook |
| `appState` changes | No direct `appState` mutation observed within depth-2 traversal |
| Sound | None observed |
| Environment variables read | `DISABLE_FEEDBACK_COMMAND`, `DISABLE_BUG_COMMAND`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` |

---

## Version History

| Version | Change |
|---|---|
| v2.1.163 | Initial analysis |

---

## Common Mistakes

1. **Aliased invocations silently obey all the same gates.** Using `/bug` or `/share` is identical to `/feedback` — all three names share the same handler (`bzf`) and undergo the full eligibility check. Setting `DISABLE_FEEDBACK_COMMAND` does **not** also block `/bug`; each has its own dedicated variable.
2. **Enterprise/team accounts need the `allow_product_feedback` policy enabled.** Organizations on those plans will receive a policy-blocked message unless an administrator explicitly enables the flag. Users cannot bypass this with environment variables.
3. **Third-party provider users cannot submit feedback without Anthropic credentials.** Accounts using Amazon Bedrock, Vertex AI, Microsoft Foundry, or similar providers where no Anthropic OAuth/API key is available will hit the `no_creds` gate and see an error rather than the feedback form.
4. **`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` disables feedback.** Because feedback submission is classified as non-essential traffic, setting this variable (or configuring a telemetry mode of `essential-traffic` / `no-telemetry`) will silently block the command even if no feedback-specific environment variable is set.
5. **The 30 000 ms submission timeout is not user-configurable.** Users on slow connections may experience a hard failure with no retry logic visible at depth-2 traversal.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `bzf` | Top-level async handler for `/feedback` (Arbor-resolved entry point) |
| `Auq` | Feedback UI factory — builds the JSX component tree |
| `kbH` | Eligibility gate — checks env vars, telemetry mode, provider, org policy |
| `Dq` | Telemetry mode resolver |
| `RSA` | Telemetry mode string mapper |
| `eH` | Low-level string/enum utility |
| `W9` | Organization policy checker (enterprise/team plan guard) |
| `lL9` | Plan-lookup helper |
| `WIH` | Plan classification dispatcher |
| `EC` | Auth context accessor |
| `XA` | Provider kind extractor |
| `Hf` | Auth header builder helper |
| `DO` | API key / credential resolver |
| `Bj` | OAuth token accessor |
| `e4H` | Policy key reader (`allow_product_feedback`) |
| `rU` | Auth token assembly (builds request auth headers) |
| `ad` | Third-party provider auth guard |
| `Z7` | Provider string normalizer |
| `ZA` | OAuth token fetch helper |
| `zY` | Token refresh / credential pipeline |
| `nR` | Array-based inclusion check utility |
| `NW` | API-key credential path handler |
| `H` | Bootstrap fetch orchestrator |
| `v` | Bootstrap fetch executor (sets headers, fires request) |
| `ccK` | User-agent builder |
| `OXA` | User-agent component assembler |
| `SH` | JSON serialization helper |
| `J4` | Path/header sanitizer (redacts sensitive values) |
| `g2A` | Header map transformer |
| `ppH` | Debug log writer |
| `h2A` | Low-level stream write helper |
| `icK` | Conversation log manager (read/append/rotate) |
| `$pH` | Async I/O queue / debounce scheduler |
| `d3H` | Log entry formatter |
| `Q6` | Log directory resolver |
| `aL6` | EISDIR-safe file-open helper |
| `r2A` | Log file path builder |
| `i2A` | Log file rotation handler (stat → rename → unlink) |
| `ncK` | Log file append worker (mkdir + appendFile) |
| `j9` | Shutdown/cleanup hook registrar (`MXA.register`) |
| `e$` | Session ID accessor |
| `Pw_` | Command argument parser (split/trim/slice) |
| `ZHH` | Feature-flag presence check |
| `uj` | String replacement utility |
| `t1` | Model identifier normalizer |
| `D6H` | Model name tokenizer |
| `x0` | Model token prefix extractor |
| `IqH` | Model capability flag reader |
| `yd` | Model string parser (handles `anthropic.` prefix) |
| `Aq` | Canonical model name resolver |
| `o0` | Model alias lookup |
| `_4H` | Blocked model list checker |
| `wI` | Model tier classifier |
| `NQH` | Sonnet-class model resolver |
| `NE` | Haiku-class model resolver |
| `kX1` | Opus-class model resolver |
| `gM` | Model string builder |
| `Pe6` | Model inclusion validator |
| `vQH` | Model error message formatter |
| `eX` | Model context builder |
| `r0` | Full model resolution pipeline |
| `s6` | Sad-path telemetry dispatcher (fires `tengu_feature_sad`) |
| `c` | Generic telemetry event emitter |
| `P6` | Telemetry payload constructor |
| `Nu6` | Telemetry transport |
| `_uq` | Timestamp snapshot helper (`Date.now`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.