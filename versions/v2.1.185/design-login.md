---
type: feature-spec
feature: "design-login"
cc_version: "2.1.185"
updated: "2026-06-21"
tags: ["design-login", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.185 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/design-login`

> Analysis basis: CC v2.1.185 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.185

---

## Overview

`/design-login` is a local JSX command that authorizes Claude Code to access the design-system on behalf of the user's `claude.ai` account. It launches an OAuth flow (browser-based or manual code entry), exchanges the resulting authorization code for tokens, and persists the resulting credential to secure storage so that `/design-sync` can subsequently operate without re-authentication.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `design-login` |
| description | `Authorize design-system access for /design-sync with your claude.ai account` |
| loc_byte | `11862537` |
| loc_byte_end | `11862736` |
| loc_line | `7630` |
| module_id | `bdl` |
| load_inline | `true` |
| arbor_handler.name | `Idl` |
| arbor_handler.fqn | `claude-2.1.185::Idl` |
| arbor_handler.kind | `Function` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.185 bundle.js:+11862537

> **Note on handler resolution:** The Arbor symbol graph resolves the handler to `Idl` via `direct` resolution (symbol falls inside the registration byte range `[11862537, 11862736]`). The call-graph entry point `d7p` is the React component (UI renderer); the true command handler is `Idl`. Pseudocode and the appendix mapping table use `Idl` / `designLoginHandler` accordingly.

---

## Input Branching

The command follows 5+ distinct states during execution; a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/design-login invoked"]) --> B{OAuth client ID\nconfigured?}
    B -- No --> ERR1["Display error:\n'Claude Design OAuth client\nnot configured in this build'"]
    B -- Yes --> C{Existing design\ncredential stored?}
    C -- Yes --> WARN["Display warning:\n'A design credential is already stored\n— completing this flow replaces it'"]
    C -- No --> D
    WARN --> D["Call r.startOAuthFlow()\nOpen browser to authorization URL"]
    D --> E{Browser opened\nsuccessfully?}
    E -- Yes --> F["Show URL + '(Copied!)' hint\nState = waiting_for_login"]
    E -- No --> F2["Show manual URL with\n'Browser didn't open?' message"]
    F --> G{User action}
    F2 --> G
    G -- "Pastes full callback URL\nor authorization code" --> H["Parse code from callback URL\nor manual entry field"]
    G -- "Escape key" --> CANCEL["State = cancelled\nDisplay 'Design login cancelled.'"]
    H --> I{Code valid\n(non-empty)?}
    I -- No --> INVALID["Display 'Invalid code.\nPlease make sure the full\ncode was copied'"]
    INVALID --> G
    I -- Yes --> J["Exchange code for tokens\nvia token endpoint (POST)\nState = processing"]
    J --> K{Token response\ncontains refresh_token\nand expiry?}
    K -- No --> ERR2["Display error:\n'token response missing\nrefresh_token or expiry'"]
    K -- Yes --> L["Persist tokens to\nsecure / config storage\nc4n / T9t path"]
    L --> M{Save succeeded?}
    M -- No --> ERR3["Display 'Could not save the\ndesign credential to\nsecure storage.'"]
    M -- Yes --> SUCCESS["State = success\nDisplay 'Design-system access authorized.'\nEmit tengu_design_oauth_login_success"]
    ERR2 --> DONE([End])
    ERR3 --> DONE
    SUCCESS --> DONE
    CANCEL --> DONE
    ERR1 --> DONE
```

Analysis basis: CC v2.1.185 bundle.js:+11856203 – +11859031

---

## Behavioral Spec

### 1. Command Entry Point (`designLoginHandler` / `Idl`)

The command registration lives at byte range `[11862537, 11862736]` and `load_inline: true` means the handler is resolved inline. The Arbor-resolved handler `Idl` bootstraps the React JSX component `renderDesignLogin` (`d7p`).

```
function designLoginHandler():
    return createElement(renderDesignLogin, props)
```

Analysis basis: CC v2.1.185 bundle.js:+11862303

---

### 2. React Component Initialization (`renderDesignLogin` / `d7p` → `Sdl`)

The primary UI logic lives in `Sdl`. On mount it establishes React state and context hooks.

```
function renderDesignLogin(props):
    [authState, setAuthState] = useState("starting")   // initial state literal
    [retryCount, setRetryCount] = useState(0)
    clockContext = useClock()          // via Ns → QIi.useContext
    terminalSize = useTerminalSize()   // via fr → ECi.useContext
    inputRef = useRef(null)
    progressWidth = Math.max(50, terminalSize.columns * 4)

    useEffect(startOAuthSequence, [])
    useEffect(handleCleanup, [])       // r.cleanup on unmount

    return <DesignLoginUI state=authState ... />
```

Analysis basis: CC v2.1.185 bundle.js:+11856203

---

### 3. OAuth Client ID Validation (`Ps` / `oauthClientResolver`)

Before starting the flow, the implementation validates that the design OAuth client ID is available in the build or environment.

```
function oauthClientResolver(env):
    if env == "prod":
        baseUrl = resolveProductionUrl()    // port 8205 path
    elif env == "staging":
        baseUrl = resolveStagingUrl()
    else:
        baseUrl = resolveLocalUrl()         // localhost:8000 / 4000 / 3000

    clientId = process.env.CLAUDE_CODE_DESIGN_OAUTH_CLIENT_ID
    if not clientId:
        throw Error(
            "The Claude Design OAuth client is not configured in this build. " +
            "Set CLAUDE_CODE_DESIGN_OAUTH_CLIENT_ID to the registered client id, " +
            "or update to a build with the registered client."
        )
    return { baseUrl, clientId }
```

Analysis basis: CC v2.1.185 bundle.js:+11857316 (error literal), +860969 (env resolution)

---

### 4. OAuth Flow Start (`r.startOAuthFlow`)

```
async function startOAuthFlow(oauthParams):
    authState = "waiting_for_login"
    url = await buildAuthorizationUrl(oauthParams)
    copied = await copyToClipboard(url)    // zv clipboard subsystem
    openBrowser(url)
    if browserFailed:
        show "Browser didn't open? Use the url below to sign in"
    else:
        show url + "(Copied!)" hint
    // 3000 ms timeout guard registered via p.setTimeout
    scheduleTimeout(3000, onTimeout)
```

Analysis basis: CC v2.1.185 bundle.js:+11857539, +11857618, +3000 literal at +11857641

---

### 5. Keyboard Input Handling

The component registers keyboard handlers for:

| Key / Input | Action |
|---|---|
| `escape` | Set state to cancelled; display "Design login cancelled." |
| `return` | Submit current input field value as authorization code |
| Any text | Append to manual code input field |

```
function onKeyPress(key, input):
    if key == "escape":
        setAuthState("cancelled")
        display("Design login cancelled.")
        return

    if key == "return":
        code = inputRef.current.trim()
        if code == "":
            setError("Invalid code. Please make sure the full code was copied")
            return
        submitCode(code)
        return

    // Otherwise: update manual input field
    updateInput(input)
```

Manual code entry also emits `tengu_design_oauth_manual_entry` when the user submits via the return key.

Analysis basis: CC v2.1.185 bundle.js:+11856594 ("escape"), +11856683 ("Design login cancelled."), +11856747 ("return"), +11856947 ("Invalid code…"), +11857106 (telemetry)

---

### 6. Authorization Code Exchange (`zpo` / `tokenExchange`)

```
async function tokenExchange(code, oauthParams):
    // Filter out placeholder / nil client IDs starting with "00000000-"
    validClientIds = Ipe.filter(id => not id.startsWith("00000000-"))

    response = await p1(POST, tokenEndpoint, {
        grant_type: "refresh_token",   // token exchange shape
        code: code,
        ...oauthParams
    }, headers={
        "Content-Type": "application/json"
    }, timeout=5000)

    if response missing refresh_token or expiry:
        throw Error("The token response was missing a refresh token or expiry — " +
                    "cannot store a usable design credential.")

    return response.tokens
```

Analysis basis: CC v2.1.185 bundle.js:+10176875, +10177258 (error literal), +2138570 ("refresh_token"), +2138640 ("application/json"), +2138668 (5000 ms timeout)

---

### 7. Token Persistence (`c4n` / `saveDesignTokens` and `T9t` / `saveDesignConfig`)

```
async function saveDesignTokens(tokens):
    try:
        // Attempt secure storage write (dc path)
        await secureStore.write("design_oauth", tokens)
    catch err:
        // Fallback: write to global config via T9t
        result = await saveDesignConfig(tokens)
        if not result.ok:
            setError("Could not save the design credential to secure storage.")
            emit("tengu_design_oauth_login_error")
            return false
    return true
```

Analysis basis: CC v2.1.185 bundle.js:+11858151 (error literal), +10173555 (c4n), +10173391 (T9t)

---

### 8. Success Path

```
function onLoginSuccess():
    setAuthState("success")
    display("Design-system access authorized.")
    emit("tengu_design_oauth_login_success")
    // 1500 ms delay before auto-close
    scheduleTimeout(1500, closeCommand)
```

Analysis basis: CC v2.1.185 bundle.js:+11856518 ("Design-system access authorized."), +11858247 (telemetry), +11858376 (1500 literal)

---

### 9. Callback URL Parsing (`vBd` / `callbackUrlParser`)

The component also accepts a full redirect URL (for remote/headless sessions where `localhost` callback cannot load):

```
function parseCallbackUrl(rawUrl):
    parsed = new URL(rawUrl)
    code = parsed.searchParams.get("code")
    if not code:
        throw Error(
            "Invalid callback URL: missing authorization code. " +
            "Ask the user to paste the full redirect URL from their " +
            "browser's address bar, including the `?code=...&state=...` query string."
        )
    return code
```

Analysis basis: CC v2.1.185 bundle.js:+6623857 ("code"), +6623943 (error literal), +6622837–+6622980 (remote session instruction literals)

---

### 10. Clipboard Subsystem (`zv` / `clipboardWriter`)

The authorization URL is copied to the clipboard automatically. The subsystem detects the platform:

```
function copyToClipboard(text):
    platform = detectPlatform()   // "macos" | "linux" | "windows" | "wsl" | "tmux"

    if platform == "macos":
        spawn("pbcopy", stdin=text)
    elif platform == "linux" and wayland:
        spawn("wl-copy", text)
    elif platform == "linux" and x11:
        spawn("xclip", "-selection", "clipboard", text)
        // fallback: xsel
    elif platform == "wsl":
        spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ...])
    elif platform == "tmux":
        spawn("tmux", ["load-buffer", "-w", ...])
    else:
        useOsc52Escape(text)      // terminal escape sequence fallback
```

Analysis basis: CC v2.1.185 bundle.js:+3537606 ("pbcopy"), +3536566 ("wl-copy"), +3536634 ("xclip"), +3536674 ("xsel"), +3538003 ("powershell.exe"), +3536853 ("tmux"), +3536449 ("osc52")

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_design_oauth_manual_entry` | Fired when user submits auth code via the return key (manual entry path); loc: +11857106 |
| Telemetry: `tengu_design_oauth_login_success` | Fired when tokens are successfully persisted; loc: +11858247 |
| Telemetry: `tengu_design_oauth_login_error` | Fired when token save fails; loc: +11858400 |
| Telemetry: `tengu_daemon_config_reload` | Fired in background when daemon config reloads (side effect of MCP state machinery); loc: +17290895 |
| Telemetry: `tengu_mcp_skills` | Fired by MCP skill enumeration called transitively; loc: +6624964 |
| Telemetry: `tengu_config_auth_loss_prevented` | Fired by config-save guard (GH #3117 protection); loc: +13963654 |
| Auth state transitions | `starting` → `waiting_for_login` → `processing` → `success` \| `cancelled` \| error |
| Secure storage write | Design OAuth tokens written to secure store or global config on success |
| Existing credential | Replaced silently if already present (user warned via UI before confirmation) |
| Clipboard side effect | Authorization URL copied to system clipboard on flow start |
| Browser launch | Attempts to open the system browser to the authorization URL |
| Timeout (3000 ms) | Guard registered on OAuth flow start; triggers `process.exit` if flow stalls |
| Timeout (1500 ms) | Auto-close delay after success |
| Hook cleanup | `r.cleanup` called on component unmount; pending promise sets cleared via `I.clear` |
| MCP auth-cache | `mcp-needs-auth-cache.json` consulted/updated by transitive MCP connection logic |

---

## Version History

| Version | Change |
|---|---|
| v2.1.185 | Initial analysis |

---

## Common Mistakes

1. **Missing OAuth client ID.** If the environment variable `CLAUDE_CODE_DESIGN_OAUTH_CLIENT_ID` is not set and the build does not embed the registered client, the command will immediately show the "not configured in this build" error and offer no way to proceed except upgrading or setting the variable.

2. **Pasting a partial code.** The manual entry field validates only that the input is non-empty. If the user copies only part of the `?code=...` value, the token exchange will fail at the server side, not locally. Users should paste the full callback URL so the built-in URL parser can extract the code correctly.

3. **Remote / headless sessions.** On SSH or remote environments, the `localhost` redirect URL the browser is sent to after authorization will not load. This is expected: the user must copy the full URL from the browser address bar (including `?code=…&state=…`) and paste it into the CLI prompt. The UI surfaces this with the "Browser didn't open?" message.

4. **Replacing an existing credential.** Running `/design-login` again while a valid token already exists will replace it. The UI shows a warning before starting the flow, but the replacement is not reversible from within the CLI.

5. **3-second stall timeout.** If the OAuth flow does not complete within approximately 3 seconds of starting (e.g., due to a network issue building the authorization URL), the timeout guard may trigger an exit. This is a hard process exit, not a graceful cancellation.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Idl` | Arbor-resolved command handler / entry point (designLoginHandler) |
| `d7p` | React component renderer for the design-login UI (renderDesignLogin) |
| `Sdl` | Main OAuth UI component with full state machine (designLoginComponent) |
| `Ns` | Clock context accessor (useClock hook wrapper) |
| `fr` | Terminal size context accessor (useTerminalSize hook wrapper) |
| `I` | Input event / keyboard handler dispatcher |
| `k` | File-change / mtime watcher utility |
| `Uuc` | Filesystem realpath+stat checker |
| `Mn` | ENOENT error helper |
| `Gp` | Generic utility (called in watcher path) |
| `T` | HTTP/fetch request builder |
| `QHc` | Request pipeline (FO + ssr + j2o) |
| `Pe` | JSON.stringify wrapper |
| `Kc` | URL/path normalizer with redaction |
| `Hqe` | Secondary normalization helper (s9o) |
| `n_c` | File read/buffer helper with chunked reading |
| `De` | Log writer / stderr output |
| `Ho` | Error-to-string converter |
| `st` | String coercion helper |
| `ra` | Essential-traffic queue helper (eJo) |
| `Bzc` | FIFO queue (shift/push) |
| `j6f` | BUn-based claude version path resolver |
| `BUn` | Path joiner for `claude/versions` |
| `d` | File write / supervisor writer |
| `Aje` | File stat + MIME type validator |
| `r` | Data stream writer (Fs) |
| `qDl` | Column width / padding calculator |
| `i` | Channel handle (get/set/delete) |
| `y` | Process watcher (l1t / xht) |
| `E` | Throttle/debounce controller (min/max math) |
| `Puc` | Heartbeat scheduler (zse) |
| `s` | Promise tracker (add/delete/finally) |
| `a` | MCP state applier / orchestrator |
| `n3e` | MCP server connection manager (core loop) |
| `dW` | MCP slot diff applicator |
| `Ort` | MCP server option resolver (bP + Gpe) |
| `W7` | Individual MCP server connector |
| `k5` | SDK-type server enumerator |
| `NLn` | MCP warning/error colorizer (red/yellow) |
| `Mrt` | MCP server registry updater |
| `Nk` | MCP tool capability resolver (P_ + EKr) |
| `P_` | Credential / token fetcher (zue + Ct + Fa) |
| `o` | Column padding formatter |
| `Wn` | Generic async wrapper (t) |
| `pra` | MCP server probe / connection init |
| `w7r` | MCP probe helper (ci + d0n + Gt) |
| `Vwe` | MCP config hash builder (sha256/hex) |
| `Phn` | MCP param schema resolver (Rse + Az) |
| `Ohn` | Schema + hash combiner |
| `EI` | Hash computer (Gni.createHash) |
| `Mhn` | Schema type mapper (dc) |
| `dc` | Low-level type descriptor (D3s) |
| `on` | MCP debug logger (hKe.push + QJ.logMCPDebug) |
| `oxn` | OAuth tool injector (Lr + CBd + vBd) |
| `Lr` | OAuth tool list builder |
| `CBd` | OAuth "authenticate" tool handler |
| `vBd` | OAuth "complete_authentication" tool / callback URL parser |
| `Sra` | MCP server post-connect finalizer |
| `ci` | Async-local store accessor (L0u.getStore) |
| `d0n` | Cache path builder (u0n.join + tr) |
| `OKr` | MCP error classifier |
| `Ee` | String coercion (String) |
| `m` | Active server map iterator |
| `n` | Lowercase key normalizer |
| `Uk` | MCP skill enumerator (ct → tengu_mcp_skills) |
| `ct` | Skill aggregator with telemetry |
| `yKr` | "needs-auth" state resolver (pn) |
| `pn` | Config auth reader (W7n + vx + LMe + _ko + oWt) |
| `w` | Background worker scheduler |
| `kz` | Worker state tracker |
| `L` | Background sweep loop (shift grace clocks, retire, prewarm) |
| `v` | Worker lifecycle helper |
| `Dec` | Array tail accessor (e.at) |
| `Cu` | MCP error logger (hKe.push + QJ.logMCPError) |
| `gra` | MCP schema validator (U8) |
| `U8` | Zod-style schema runtime (TypeError + AggregateError) |
| `Hot` | parseInt-based version parser (major) |
| `p0n` | parseInt-based version parser (minor) |
| `uZn` | MCP connection result applicator |
| `t3e` | Config hash comparator (Vwe) |
| `fw` | MCP slot cleanup runner (hot + Uk) |
| `hot` | Single-slot cleanup (Vwe + o.cleanup) |
| `mta` | MCP transport adapter (Szr) |
| `l` | Daemon status writer (k0l) |
| `k0l` | Status file writer (CQ + ci + Mjt + Pe) |
| `CQ` | Config reader (vfe) |
| `Mjt` | Daemon status path builder (x0l.join + tr) |
| `B1o` | MCP client connection orchestrator |
| `jLn` | Tool capability set checker (X2d + LKr) |
| `Bn` | Timeout-with-abort helper |
| `c` | Abort signal handler (Tn) |
| `I9t` | OAuth URL builder (d4n) |
| `d4n` | OAuth endpoint resolver (Ps) |
| `Ps` | OAuth client ID + base URL resolver |
| `Oqo` | Production OAuth URL builder |
| `uUc` | OAuth URL validator helper |
| `p` | Timeout + process.exit guard |
| `WT` | Force-shutdown label ("forced shutdown") |
| `u` | Daemon abort controller |
| `ke` | Feature-ok telemetry emitter (tengu_feature_ok) |
| `Ue` | Feature telemetry base (ogt) |
| `Re` | Feature-bad telemetry emitter (tengu_feature_bad) |
| `rF` | Daemon control telemetry emitter (tengu_daemon_control) |
| `T4` | Transport builder (uB) |
| `gFe` | First-party transport marker (BR) |
| `MNr` | UUID + event emitter (kNr.randomUUID + e.emit) |
| `SG` | Daemon graceful shutdown orchestrator |
| `Lme` | MCP shutdown helper (wme.shutdown) |
| `Nme` | Cleanup timer canceller (clearTimeout + Cko) |
| `p1` | Token POST request helper (mo.post + ke + mo.isAxiosError) |
| `Pt` | Feature-sad telemetry emitter (tengu_feature_sad) |
| `zpo` | Token exchange orchestrator (Ipe filter + p1 + join) |
| `c4n` | Design token save (dc + t.onlyIf + T + Ee) |
| `Rd` | Theme/style context hook |
| `zv` | Clipboard writer (platform dispatch) |
| `d0t` | Clipboard base helper (b_) |
| `b_` | Low-level clipboard write primitive |
| `SHi` | OSC52 / terminal clipboard writer |
| `Un` | Clipboard platform detector (qr + Mt) |
| `qr` | Platform-specific clipboard resolver |
| `Mt` | Clipboard method selector (Qen + Ar) |
| `xFr` | Linux clipboard dispatcher (_A) |
| `_A` | Wayland/X11 chooser (Fqo) |
| `ged` | Generic clipboard executor (Un + T) |
| `LFr` | OSC52 escape-sequence builder (b_) |
| `p0t` | Clipboard path selector (d0t + zt) |
| `EL` | Text pre-processor for clipboard (replaceAll) |
| `aE` | Multi-segment clipboard joiner (EHi + e.join) |
| `EHi` | Segment builder (b_) |
| `T9t` | Design config persister (dc + T + Ee) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.