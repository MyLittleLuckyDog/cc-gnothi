---
type: feature-spec
feature: "feedback"
cc_version: "2.1.160"
updated: "2026-06-02"
tags: ["feedback", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.160 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/feedback`

> Analysis basis: CC v2.1.160 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.160

---

## Overview

The `/feedback` command (also accessible as `/share` and `/bug`) allows users to submit feedback, report bugs, or share their conversation with Anthropic. It opens an interactive UI component that collects the submission, performs multiple eligibility checks before launching, and routes the payload through authenticated HTTP. The command is subject to several independent disable conditions — environment variables, network policy flags, organizational policy, and provider restrictions — that gate whether the UI ever appears.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `feedback` |
| description | `Submit feedback, report a bug, or share your conversation` |
| argumentHint | `[report]` |
| aliases | `share`, `bug` |
| module_id | `Oy1` |
| load_inline | `true` |
| loc_byte | `10853486` |
| loc_byte_end | `10853709` |
| loc_line | `7140` |
| arbor_handler.name | `SKf` |
| arbor_handler.fqn | `claude-2.1.160::SKf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.160 bundle.js:+10853486

---

## Input Branching

The command has 5+ distinct gate branches before reaching the submission UI. A Mermaid flowchart is required.

```mermaid
flowchart TD
    A["/feedback invoked"] --> B{DISABLE_FEEDBACK_COMMAND\nor DISABLE_BUG_COMMAND set?}
    B -- "yes (env var)" --> C["Return disabled message:\n'/feedback has been disabled via the\nDISABLE_FEEDBACK_COMMAND env var'"]
    B -- no --> D{CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC set?}
    D -- yes --> E["Return disabled message:\n'/feedback has been disabled via the\nCLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC env var'"]
    D -- no --> F{Telemetry policy check:\nnetwork mode = 'no-telemetry'?}
    F -- yes --> G["Return disabled (no-telemetry mode)"]
    F -- no --> H{Organization policy:\nallow_product_feedback = false?}
    H -- "false (enterprise/team plan)" --> I["Return disabled message:\n'/feedback has been disabled by your\norganization's policy'"]
    H -- true or N/A --> J{Provider check:\nbedrock / vertex / foundry /\nanthropicAws / mantle / gateway?}
    J -- "third-party provider" --> K["Annotate provider name\n(Amazon Bedrock, Vertex AI, etc.)\nNo Anthropic credentials → flag 'no_creds'"]
    J -- "first-party / direct API" --> L[Resolve auth token or API key]
    K --> M[Open feedback JSX UI component\n(30 000 ms timeout)"]
    L --> M
    M --> N{User submits form?}
    N -- cancelled --> O[No-op]
    N -- submitted --> P["HTTP POST 'post' to feedback endpoint\nwith conversation payload + auth headers"]
    P --> Q{Response ok?}
    Q -- success --> R[Show confirmation]
    Q -- failure --> S[Show error / retry]
```

Analysis basis: CC v2.1.160 bundle.js:+10831461, +10831479, +10831620, +10831738, +10831902, +10832566

---

## Behavioral Spec

### Top-level handler (`SKf` → `feedbackCommandHandler`)

The Arbor-resolved handler `SKf` is an `AsyncFunction` that delegates immediately to the UI assembly function (`$y1` / `feedbackUILauncher`).

Analysis basis: CC v2.1.160 bundle.js:+10853317

```
async function feedbackCommandHandler(commandArgs, context):
    return feedbackUILauncher(commandArgs, context)
```

### Disable-gate evaluation (`HCH` / `disableGateEvaluator`)

Called first by `feedbackUILauncher`. Evaluates conditions in priority order and returns an early-exit message string when any gate is triggered.

```
function disableGateEvaluator(context):
    // Gate 1: explicit env-var disable
    if env.DISABLE_FEEDBACK_COMMAND == "disabled":
        return "/feedback has been disabled via the DISABLE_FEEDBACK_COMMAND environment variable"
    if env.DISABLE_BUG_COMMAND == "disabled":
        return "/feedback has been disabled via the DISABLE_BUG_COMMAND environment variable"

    // Gate 2: non-essential traffic disable
    if env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC is truthy:
        return "/feedback has been disabled via the CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC environment variable"

    // Gate 3: telemetry/network policy
    networkMode = resolveNetworkMode(context)   // calls n9 → KNA → FH
    if networkMode == "no-telemetry":
        return disabled_message
    if networkMode == "essential-traffic":
        // partial restriction; continues but may limit payload

    // Gate 4: organizational policy (enterprise/team plans)
    if orgPlan in ["enterprise", "team"]:
        if NOT orgPolicy.allow_product_feedback:
            return "/feedback has been disabled by your organization's policy"

    return null   // all gates passed
```

Analysis basis: CC v2.1.160 bundle.js:+10831461, +10831479, +10831620, +10831738, +10831902, +970142, +970201, +4146184, +4146219, +4146460

### Network-mode resolver (`n9` → `KNA` → `FH` / `networkModeResolver`)

Determines the effective network policy string. Returns one of `"no-telemetry"`, `"essential-traffic"`, or `"default"`.

```
function networkModeResolver(config):
    raw = config.networkMode
    if raw == "no-telemetry":  return "no-telemetry"
    if raw == "essential-traffic":  return "essential-traffic"
    return "default"
```

Analysis basis: CC v2.1.160 bundle.js:+970142, +970201, +970275, +970306

### Provider detection and credential resolution (`jA` / `providerResolver`, `IU` / `authHeaderBuilder`)

After all gates pass, the handler identifies the active provider and resolves an appropriate auth token or API key.

```
function providerResolver(apiConfig):
    providerType = apiConfig.providerType
    match providerType:
        "bedrock"      → label = "Amazon Bedrock"
        "vertex"       → label = "Vertex AI"
        "foundry"      → label = "Microsoft Foundry"
        "anthropicAws" → label = "Claude Platform on AWS"
        "mantle"       → label = "Amazon Bedrock (Mantle)"
        "gateway"      → label = "an API gateway"
        "firstParty"   → label = null   // direct Anthropic
    return { providerType, label }
```

Analysis basis: CC v2.1.160 bundle.js:+10832034, +10832109, +10832180, +10832264, +10832347, +10832432, +2047861, +2047911, +2047967, +2048021, +2048069, +2048078

```
function authHeaderBuilder(providerInfo, oauthToken, apiKey):
    if providerInfo.providerType != "firstParty":
        // Third-party: Anthropic auth not used
        // flag credential status as "no_creds" if no key present
        return { credentialStatus: "no_creds" }

    if oauthToken available:
        return { "anthropic-beta": <token>, authMode: "user_oauth" }

    if apiKey available:
        return { "x-api-key": apiKey }

    throw "No API key available"
```

Analysis basis: CC v2.1.160 bundle.js:+10832509, +10832526, +3021439, +3021554, +3021638, +3021704, +3021789, +3021829, +2985341, +2985414

### Feedback UI component (`$y1` / `feedbackUILauncher` + `My1` / `timestampGenerator`)

Renders the JSX component after gate evaluation succeeds.

```
function feedbackUILauncher(args, context):
    disableReason = disableGateEvaluator(context)
    if disableReason != null:
        renderText(disableReason)
        return

    providerInfo  = providerResolver(context.apiConfig)
    authHeaders   = authHeaderBuilder(providerInfo, context.oauthToken, context.apiKey)
    timestamp     = Date.now()                // via My1, loc_byte 10852856
    timeoutMs     = 30000                     // loc_byte 10852875

    component = createElement(FeedbackUIComponent, {
        providerInfo,
        authHeaders,
        timestamp,
        timeoutMs,
        visibility: "public"                  // loc_byte 10853292
    })

    return renderJSX(component)
```

Analysis basis: CC v2.1.160 bundle.js:+10853055, +10853078, +10853099, +10852856, +10852875, +10853292

### HTTP submission (`G9` / `feedbackSubmitter`)

Called when the user confirms submission inside the UI component.

```
async function feedbackSubmitter(payload, authHeaders, sessionCache):
    // Check dedup cache (vSL.has) before sending
    if submissionCache.has(payload.hash):
        return   // already submitted

    httpMethod = "post"                      // loc_byte 10832566
    response   = await httpPost(feedbackEndpoint, payload, authHeaders)
    if response.ok:
        submissionCache.add(payload.hash)
        showConfirmation()
    else:
        handleError(response)
```

Analysis basis: CC v2.1.160 bundle.js:+10832566, +4146413, +4146429, +4146442

### Conversation serialization (`gq` / `conversationSerializer`, `K1` / `messageNormalizer`)

Before transmission the conversation transcript is serialized. Sensitive header values are redacted.

```
function conversationSerializer(messages, config):
    normalized = messages.map(m => messageNormalizer(m))
    serialized = JSON.stringify(normalized)   // via SH, loc_byte 183798
    return serialized

function messageNormalizer(message):
    role    = message.role.toLowerCase().trim()
    content = message.content.trim()
    // Redact API key-like strings → "[REDACTED]"   loc_byte 196350
    // Truncate path segments to last 2 components   loc_byte 196379
    // Trim paths longer than 40 chars               loc_byte 15873361
    return { role, content }
```

Analysis basis: CC v2.1.160 bundle.js:+196350, +196379, +15873361, +183798

### Transcript file persistence (`rmK` / `transcriptLogger`)

A local transcript may be written/rotated for the submission.

```
function transcriptLogger(transcriptDir, content):
    dir = path.dirname(transcriptDir)
    ensureDir(dir)                          // Hy.mkdir
    if existingFile ends with ".txt":       // loc_byte 203195
        rotate file (Hy.rename, Hy.unlink)  // loc_byte 203247, 203287
    append content (Hy.appendFile)          // loc_byte 203549
    // File rotation threshold: 4 segments  // loc_byte 203217
    byteLen = Buffer.byteLength(content)
```

Analysis basis: CC v2.1.160 bundle.js:+203195, +203217, +203247, +203287, +203490, +203549

### Bootstrap fetch helper (`H` / `bootstrapFetcher`)

Used to pre-fetch any runtime configuration needed by the feedback endpoint.

```
async function bootstrapFetcher(url, options):
    log("[Bootstrap] Fetching", url)        // loc_byte 15451800
    headers = {
        "Content-Type": "application/json", // loc_byte 15451885, 15451900
        "User-Agent":   <userAgent>          // loc_byte 15451919
    }
    timeout = 5000                          // loc_byte 15451991
    response = await fetch(url, { headers, timeout })
    if !response.ok:
        trackEvent("api_bootstrap_fetch", "parse_failed")  // loc_byte 15452112, 15452134
        throw error
    log("[Bootstrap] Fetch ok")             // loc_byte 15452164
    return response.json()
```

Analysis basis: CC v2.1.160 bundle.js:+15451800, +15451885, +15451900, +15451919, +15451991, +15452112, +15452134, +15452164

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_sad` — fired when the network-mode resolver detects a degraded or restricted traffic state (bundle.js:+966258) |
| Disable env vars | `DISABLE_FEEDBACK_COMMAND`, `DISABLE_BUG_COMMAND`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` — any truthy value disables the command |
| Org policy flag | `allow_product_feedback` evaluated for `enterprise` and `team` plan accounts |
| Submission dedup cache | `vSL` (Set) — prevents duplicate feedback POSTs within a session (bundle.js:+4146429) |
| Transcript file | Written/rotated under a local directory via `Hy.appendFile` / `Hy.rename` / `Hy.unlink`; rotation triggered at 4-segment threshold |
| Bootstrap fetch | One-shot async GET before UI opens; 5 000 ms timeout; failure recorded as `api_bootstrap_fetch / parse_failed` |
| UI timeout | JSX component auto-closes after 30 000 ms (bundle.js:+10852875) |
| Timestamp | `Date.now()` captured at launch to stamp the submission (bundle.js:+10852856) |
| Visibility tag | Payload tagged `"public"` (bundle.js:+10853292) |
| Hook registration | `HDA.register` called via `O9` — registers a cleanup/unload hook (bundle.js:+59048) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.160 | Initial analysis |

---

## Common Mistakes

1. **Setting `DISABLE_FEEDBACK_COMMAND` or `DISABLE_BUG_COMMAND` without a value** — the gate checks for the string `"disabled"` exactly; an empty string will not block the command.
2. **Expecting `/feedback` to work on third-party providers with full Anthropic auth** — when the provider is `bedrock`, `vertex`, `foundry`, `anthropicAws`, `mantle`, or `gateway`, Anthropic credentials are not forwarded; the submission is flagged `no_creds` and may be sent anonymously or rejected.
3. **Confusing `/share` and `/bug` with separate commands** — both are aliases for `/feedback` and share identical behavior and disable logic.
4. **Attempting feedback under `no-telemetry` network mode** — the command is fully disabled in this mode; no UI will appear.
5. **Expecting feedback to work under enterprise/team plans without policy approval** — the `allow_product_feedback` org policy must be explicitly enabled; absence is treated as denial.
6. **Submitting the same feedback twice** — the dedup Set (`vSL`) caches payload hashes for the session lifetime; repeated submissions are silently dropped.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `SKf` | Top-level async handler for `/feedback` (Arbor-resolved, `module_id` path) |
| `$y1` | Feedback UI launcher — assembles JSX component after gate checks |
| `HCH` | Disable-gate evaluator — checks env vars, network mode, and org policy |
| `n9` | Network-mode resolver (calls `KNA`) |
| `KNA` | Network-policy string mapper |
| `FH` | String utility / toString helper |
| `G9` | Feedback submitter — performs dedup check and HTTP POST |
| `Jq9` | HTTP request builder for feedback endpoint |
| `wj6` | HTTP request dispatcher (calls `_C`, `Yj6`, `DLH`) |
| `_C` | Core HTTP client / fetch wrapper |
| `jA` | Provider type resolver |
| `C7` | Request configuration builder |
| `e3` | Auth credential resolver (API key / OAuth / WIF) |
| `hJ` | OAuth token accessor |
| `f4H` | Response handler / error mapper |
| `IU` | Auth header builder |
| `wd` | Third-party provider credential guard |
| `bM` | Provider info accessor |
| `EA` | OAuth token retriever |
| `bD` | Credential chain evaluator |
| `IR` | Array / include utility used in credential checks |
| `$W` | API key fallback resolver |
| `H` | Bootstrap fetcher |
| `N` | Bootstrap fetch inner logic |
| `lmK` | Fetch request constructor |
| `ADA` | Platform/environment tag builder |
| `SH` | JSON serializer helper |
| `_` | Generic string variable (context-dependent) |
| `x4` | Path/header sanitizer (redacts sensitive values) |
| `xwA` | Header map builder |
| `A` | Generic array/string variable (context-dependent) |
| `PmH` | Output writer |
| `ZwA` | Stream write helper |
| `rmK` | Transcript logger — manages local file write/rotate |
| `QuH` | Debounce / throttle timer helper |
| `R$H` | Transcript directory path resolver |
| `d6` | Directory utility |
| `A46` | File-system guard (EISDIR check) |
| `gwA` | Transcript path builder |
| `FwA` | Transcript file rotator (stat → rename → unlink) |
| `imK` | Transcript append writer |
| `O9` | Cleanup hook registrar (calls `HDA.register`) |
| `o$` | App-state accessor |
| `Ce` | Feature-flag cache checker (`F64.has`) |
| `wj` | URL/string replacer |
| `gq` | Conversation serializer |
| `GHH` | Message formatter |
| `DN` | Content decoder |
| `p9H` | Paragraph builder |
| `lQ` | Message content parser |
| `K1` | Message normalizer (trim, lowercase, redact, truncate) |
| `C0` | Model-name resolver |
| `DKH` | Domain inclusion checker |
| `dN` | Timestamp formatter |
| `_gH` | Duration formatter |
| `tT` | Token/model alias resolver |
| `XDq` | Model alias lookup |
| `xM` | Role mapper |
| `xa6` | Sensitive-string classifier |
| `AgH` | Field formatter |
| `yP` | Full message renderer |
| `R0` | Composite message builder |
| `t6` | Debug logger |
| `d` | Low-level log sink |
| `My1` | Timestamp generator (`Date.now()`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.