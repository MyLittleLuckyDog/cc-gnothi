---
type: feature-spec
feature: "design-login"
cc_version: "2.1.191"
updated: "2026-06-25"
tags: ["design-login", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.191 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/design-login`

> Analysis basis: CC v2.1.191 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.191

---

## Overview

`/design-login` initiates an OAuth authorization flow that grants Claude Code access to the design-system API (`/design-sync`) using the user's claude.ai account credentials. It opens a browser-based OAuth session, presents a manual code-entry fallback, and persists the resulting token to secure storage — completely separately from the main session's authentication.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `design-login` |
| description | `Authorize design-system access for /design-sync with your claude.ai account` |
| loc_byte | `11739677` |
| loc_byte_end | `11739876` |
| loc_line | `7716` |
| module_id | `rLl` |
| load_inline | `true` |
| arbor_handler.name | `sLl` |
| arbor_handler.fqn | `claude-2.1.191::sLl` |
| arbor_handler.kind | `Function` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `1` |
| handler_name | `pHf` |

Analysis basis: CC v2.1.191 bundle.js:+11739677

---

## Input Branching

The command UI passes through more than three distinct states (`starting`, `waiting_for_login`, `about_to_retry`, `processing`, `success`, error, cancelled), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A[/design-login invoked] --> B{OAuth client ID configured?}
    B -- No --> ERR0["Show config error:\n'Claude Design OAuth client\nnot configured in this build'"]
    B -- Yes --> C{Existing design credential\nalready stored?}
    C -- Yes --> WARN["Warn: 'A design credential is\nalready stored — completing this\nflow replaces it.'"]
    WARN --> D
    C -- No --> D[State: starting → waiting_for_login\nOpen browser OAuth URL]
    D --> E{User action within timeout?}
    E -- "Escape key" --> CANCEL["State: cancelled\nEmit 'Design login cancelled.'"]
    E -- "Browser callback / manual code entered" --> F{Validate auth code format}
    F -- "Invalid code\n(< 6 chars or wrong format)" --> RETRY["State: about_to_retry\nShow 'Invalid code. Please make\nsure the full code was copied'\nWait 3000 ms, then retry"]
    RETRY --> D
    F -- "Valid code" --> G[State: processing\nPOST to token endpoint\nwith refresh_token grant\nTimeout: 5000 ms]
    G -- "HTTP error / axios error" --> TOKENERR["State: error\nEmit tengu_design_oauth_login_error\nShow network error detail"]
    G -- "Success but missing\nrefresh_token or expiry" --> STORAGEFAIL["Show: 'The token response was\nmissing a refresh token or expiry'"]
    G -- "Valid token response" --> H[Call credential store writer\nAttempt secure storage write]
    H -- "Storage write failed" --> SAVEFAIL["Show: 'Could not save the design\ncredential to secure storage.'\nWait 1500 ms"]
    H -- "Storage write succeeded" --> SUCCESS["State: success\nEmit tengu_design_oauth_login_success\nShow 'Design-system access authorized.'\nCall r.cleanup()"]
```

---

## Behavioral Spec

### Component Initialization

```
function designLoginComponent(props):
    state = useState("starting")     // starting | waiting_for_login | about_to_retry |
                                     // processing | success | error
    manualCodeRef = useRef(null)
    clockContext = useClock()        // from ClockProvider
    terminalSize = useTerminalSize() // from Ink App context
    maxWidth = max(50, terminalSize.columns)

    if CLAUDE_CODE_DESIGN_OAUTH_CLIENT_ID is not set:
        render config-error message   // bundle.js:+11734529
        return

    on mount (useEffect):
        call startOAuthFlow(props)
```

Analysis basis: CC v2.1.191 bundle.js:+11733416

### OAuth Flow Startup

```
function startOAuthFlow(props):
    resolve oauthClientId from environment
    build authorization URL using oauthClientId and encodeURIComponent
    attempt to open browser at authorization URL

    set state to "waiting_for_login"    // bundle.js:+11734233
    if existing design credential exists:
        show replacement warning         // bundle.js:+11736751

    render URL below prompt:
        "Browser didn't open? Use the url below to sign in"   // bundle.js:+11737002
        render URL string
        render copy button (copies URL to clipboard)
        if clipboard copy succeeded: show "(Copied!)"          // bundle.js:+11737098
```

Analysis basis: CC v2.1.191 bundle.js:+11734752

### Key Input Handling

```
function handleKeyInput(key, input, manualCodeRef, state, props):
    if key == "escape":
        set state to cancelled
        display "Design login cancelled."    // bundle.js:+11733896
        call props.onDone()
        return

    if key == "return" and state == "about_to_retry":
        // re-trigger code submission
        return

    if input characters typed:
        // accumulate into manual auth code buffer via handleManualAuthCodeInput
        // emit tengu_design_oauth_manual_entry when user manually enters code
        //   bundle.js:+11734319
```

Analysis basis: CC v2.1.191 bundle.js:+11733710

### Auth Code Validation and Token Exchange

```
function handleManualAuthCodeInput(rawCode):
    trimmedCode = rawCode.split and trim

    if code length < minimum threshold:
        set state to "about_to_retry"
        display "Invalid code. Please make sure the full code was copied"  // bundle.js:+11734160
        schedule retry after 3000 ms                                        // bundle.js:+11734854
        return

    set state to "processing"        // bundle.js:+11735059

    tokenResponse = await exchangeCodeForToken(rawCode)

function exchangeCodeForToken(code):
    POST to token endpoint:
        grant_type: "refresh_token"      // bundle.js:+2146554
        code: code
        Content-Type: "application/json" // bundle.js:+2146609
    timeout: 5000 ms                     // bundle.js:+2146652

    if axios error:
        emit tengu event via i1 (token-exchange function)
        categorize as "network" error    // bundle.js:+2146786
        set state to error
        return

    return tokenResponse
```

Analysis basis: CC v2.1.191 bundle.js:+11735022

### Token Persistence

```
function persistDesignCredential(tokenResponse):
    if tokenResponse.refresh_token is missing OR tokenResponse.expiry is missing:
        display "The token response was missing a refresh token or expiry…"  // bundle.js:+10198751
        // vbo logic: filter cse, join joined tokens
        return failure

    result = await writeToSecureStorage(tokenResponse)
    // Secure storage writer (Uzs) attempts:
    //   1. Primary secure store write
    //   2. On transient primary failure: skip fallback  → "primary_transient_skip_fallback"
    //   3. On hard primary failure:      use plaintext  → "plaintext_fallback_used"
    //   4. Both failed:                               → "primary_and_fallback_failed"
    // Emits: "secure_storage_credentials_write"       // bundle.js:+2341025

    if result == failure:
        display "Could not save the design credential to secure storage."  // bundle.js:+11735364
        await sleep(1500)         // bundle.js:+11735589
        return

    emit tengu_design_oauth_login_success             // bundle.js:+11735460
    display "Design-system access authorized."        // bundle.js:+11733731
    call cleanup()
```

Analysis basis: CC v2.1.191 bundle.js:+11735086

### Success and Cleanup

```
function onSuccess():
    set state to "success"                          // bundle.js:+11733699
    emit tengu_design_oauth_login_success
    display "Design-system access authorized."

    call r.cleanup()                                 // bundle.js:+11736158
    clear pending I (key listener set) via I.forEach / I.clear  // bundle.js:+11736170
```

Analysis basis: CC v2.1.191 bundle.js:+11735460

### Clipboard Copy Helper

```
function copyUrlToClipboard(url):
    platform = detect OS (macos | linux | windows | wsl | tmux | screen)
    select clipboard command:
        macos:   pbcopy
        linux:   wl-copy, xclip, or xsel depending on availability
        windows: powershell.exe -NoProfile -NonInteractive -Command ...
        wsl:     powershell.exe via WSL bridge
        tmux:    tmux load-buffer -w
        osc52:   terminal escape sequence
    write url to selected clipboard backend
    on success: set copied indicator for "(Copied!)" display
```

Analysis basis: CC v2.1.191 bundle.js:+11737171

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_design_oauth_manual_entry` | Fired when the user manually enters an OAuth code instead of using the browser callback (bundle.js:+11734319) |
| Telemetry: `tengu_design_oauth_login_success` | Fired on successful token exchange and storage write (bundle.js:+11735460) |
| Telemetry: `tengu_design_oauth_login_error` | Fired when token exchange fails (network or HTTP error) (bundle.js:+11735613) |
| Telemetry: `tengu_api_success` | Fired by underlying API layer on successful HTTP call (bundle.js:+8938998) |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` | General feature-level outcome signals emitted by the feature-gate layer |
| Secure storage write | Writes design OAuth tokens to system keychain; falls back to plaintext on transient failure; emits `"secure_storage_credentials_write"` |
| Browser open side-effect | Attempts to open the OS default browser to the OAuth authorization URL |
| Clipboard side-effect | Optionally copies the OAuth URL to the system clipboard; shows "(Copied!)" on success |
| OAuth credential replacement | If a design credential already exists, completing the flow overwrites it with the new token |
| Session authentication unchanged | This flow is explicitly separate from the main Claude Code session auth (bundle.js:+11736512) |
| Timeout: manual code retry delay | 3000 ms pause before re-prompting after invalid code (bundle.js:+11734854) |
| Timeout: storage failure display | 1500 ms display pause after storage write failure (bundle.js:+11735589) |
| Timeout: token exchange HTTP | 5000 ms request timeout for POST to token endpoint (bundle.js:+2146652) |
| appState changes | UI state machine transitions: `starting → waiting_for_login → processing → success / error / about_to_retry` |

---

## Version History

| Version | Change |
|---|---|
| v2.1.191 | Initial analysis |

---

## Common Mistakes

1. **Missing `CLAUDE_CODE_DESIGN_OAUTH_CLIENT_ID`**: If this environment variable is not set, the command immediately renders a configuration error and stops — no OAuth flow is initiated. The error message explicitly instructs users to set the variable or update their build (bundle.js:+11734529).
2. **Pressing Escape accidentally**: The `Escape` key cancels the entire flow immediately with no confirmation prompt. Any partially entered code is discarded.
3. **Partial code paste**: Pasting an incomplete authorization code triggers the `about_to_retry` state with a 3-second delay; the user must re-paste the full code. Ensure the complete code string is copied before submission.
4. **Assuming this flow logs in to Claude Code**: The description and the UI text both stress this authorization is for design-system access only (`/design-sync`) and is entirely separate from the main session's authentication (bundle.js:+11736512). Running `/design-login` does not change API keys or general session tokens.
5. **Ignoring the credential-replacement warning**: If a design credential already exists, the flow silently replaces it upon success. Users who manage multiple design accounts should be aware the prior token is permanently overwritten.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `pHf` | Top-level handler / call-graph entry for `design-login` (arbor: `sLl`) |
| `nLl` | Main React component implementing the design-login UI |
| `e` | Inner async login orchestrator called from handler |
| `L6o` | Conversation/message serialization utility |
| `gsm` | Token setter sub-utility within message serialization |
| `msm` | Auto-classifier input builder |
| `wN` | API request builder / side-query dispatcher |
| `oW` | HTTP client / Anthropic SDK transport layer |
| `Kdn` | Proxy auth helper resolver (checks workspace trust) |
| `Iud` | Request session / UUID tracker |
| `TZe` | WIF credential resolver; issues fetch with AbortSignal |
| `ACe` | Provider-specific token exchange (WIF token exchange) |
| `fy` | Auth header builder (Proxy-Authorization, Bearer) |
| `yud` | API backend selector (anthropicAws, vertex, foundry, gateway, firstParty) |
| `SCe` | Session expiry / reconnect checker |
| `b2e` | Model-inclusion filter (claude-3-, opus-4, sonnet-4) |
| `lie` | Structured-output header injector |
| `vOr` | Foundry resource URL normalizer |
| `SHo` | SHA-256 request hash generator |
| `Ghn` | User-Agent string builder |
| `aIn` | API key inliner |
| `aje` | Side-query request builder |
| `wD` | Request deduplication / cache wrapper |
| `Txe` | Cache-control annotation injector |
| `P4` | Random bytes / prompt-cache key generator |
| `etn` | Token array push helper |
| `u7e` | Token array pop helper |
| `LOr` | OAuth header parser / `_r` credential lookup |
| `l7s` | Authorization scope string parser |
| `wOr` | OAuth scope set tracker |
| `ws` | Clock context accessor (`useClock`) |
| `gr` | Terminal size context accessor (`useTerminalSize`) |
| `zjt` | Ink rendering helper for login UI |
| `SVn` | Secure-token string format validator |
| `xs` | Auth code format checker / error thrower |
| `i1` | Token-exchange HTTP POST (refresh_token grant) |
| `vbo` | Design credential token response validator |
| `yVn` | Secure storage write orchestrator for design tokens |
| `Wl` | Credential store writer (primary + fallback strategy) |
| `Uzs` | Low-level secure storage read/write with fallback |
| `JFe` | Secure storage async read helper |
| `Sgt` | Cleanup / post-success state handler |
| `hv` | Clipboard copy utility dispatcher |
| `pPt` | Clipboard Yh-terminal backend selector |
| `Nxi` | OSC-52 clipboard writer |
| `Nn` | Native clipboard writer (pbcopy / wl-copy / xclip) |
| `Kr` | Platform-specific clipboard command executor |
| `vGr` | Linux clipboard tool resolver |
| `Cf` | Wayland/X11 clipboard backend picker |
| `hSd` | Clipboard write result handler |
| `CGr` | Clipboard terminal escape sequence builder |
| `fPt` | Clipboard fallback writer |
| `Jw` | Clipboard content sanitizer (replaceAll) |
| `dE` | Clipboard data joiner |
| `E` | MCP server connection manager (useEffect in component) |
| `yd` | Daemon/session context accessor |
| `L` | Background worker lifecycle sweep |
| `Le` | Worker error logger |
| `Nzt` | Memory check utility |
| `I3e` | Stale cache file pruner |
| `D` | Terminal output writer |
| `v` | Window-focus / blur timeout tracker |
| `x` | Request-cache entry manager (60 s TTL) |
| `_y` | Session state store (ANTHROPIC_API_KEY, apiKeyHelper, etc.) |
| `Ooe` | OS/environment classifier |
| `T` | HTTP header builder / debug logger |
| `ke` | JSON.stringify wrapper |
| `ol` | String coercion utility |
| `_r` | Base request options builder |
| `uu` | User-metadata formatter |
| `$hn` | AsyncLocalStorage context reader |
| `rt` | String conversion utility |
| `Mz` | User-agent suffix appender |
| `GPr` | URL component encoder |
| `Ng` | Token refresh scheduler |
| `XKs` | Boolean coercion helper |
| `Cs` | CLI error emitter (`process.exit(1)`) |
| `har` | Surrogate-pair / character-code sanitizer |
| `hx` | Unicode code-point slicer |
| `p` | Forced-shutdown / timeout controller |
| `BG` | Graceful-shutdown race (Promise.race) |
| `jn` | Timeout-with-abort helper |
| `c` | Background-session stop handler |
| `An` | Background session state label |
| `pF` | Daemon event emitter |
| `v5r` | Random UUID event builder |
| `ohe` | MCP daemon shutdown trigger |
| `fhe` | clearTimeout / O2o cleanup |