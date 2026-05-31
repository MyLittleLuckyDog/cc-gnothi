---
type: feature-spec
feature: "ultrareview"
cc_version: "2.1.132"
updated: "2026-05-31"
tags: ["ultrareview", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.132 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultrareview`

> Analysis basis: CC v2.1.132 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.132

---

## Overview

`/ultrareview` initiates a deep, automated bug-finding review of the current branch by launching a remote Claude Code session in the cloud ("teleport"). It performs a multi-stage preflight check — verifying remote-session policy, OAuth authentication, git repository state, repository size, GitHub connectivity, and billing eligibility — before bundling and uploading local repository state to a cloud environment and streaming back review findings as a background task. Estimated cost is in the $10–$20 USD range and the operation takes approximately 10–20 minutes.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultrareview` |
| description | ` ... · Est. cost ... USD · Finds and verifies bugs in your branch. Runs in Claude Code on the web. See ...` |
| module_id | `Y4q` |
| load_inline | `true` |
| handler (Arbor) | `nM7` (AsyncFunction, resolved via `module_id`) |
| loc_byte span | `10959211` – `10959470` |
| loc_line | `6671` |
| `loc_byte_end` | `10959470` |
| `arbor_handler.name` | `nM7` |
| `arbor_handler.kind` | `AsyncFunction` |
| `arbor_handler.resolution_path` | `module_id` |
| `arbor_handler.fqn` | `claude-2.1.132::nM7` |
| `arbor_handler.n_hits` | `1` |

Analysis basis: CC v2.1.132 bundle.js:+10959211

---

## Input Branching

The handler `nM7` resolves through a layered decision tree. Each stage can abort with a user-visible error before proceeding to the next.

```mermaid
flowchart TD
    A["/ultrareview invoked"] --> B{allow_remote_sessions\npolicy enabled?}
    B -- No --> B1["Error: Remote sessions disabled\nby organization policy"]
    B -- Yes --> C{Random jitter delay\n(Math.random × 2)}
    C --> D[Run precondition checks\nvia preconditionChecker]
    D --> E{Network mode:\nessential-traffic-only?}
    E -- Yes --> E1["Error: Ultrareview unavailable\nin essential-traffic mode"]
    E -- No --> F{OAuth token present?\n(Claude.ai account)}
    F -- No --> F1["Error: Run /login to authenticate\n(no_oauth_token)"]
    F -- Yes --> G{Org UUID obtainable?}
    G -- No --> G1["Error: API key auth insufficient;\nneed Claude.ai OAuth"]
    G -- Yes --> H[API preflight call\n'api_ultrareview_preflight'\n(5 000 ms timeout)]
    H --> I{Preflight result}
    I -- schema_mismatch --> I1["Abort: schema_mismatch"]
    I -- request_failed --> I2["Abort: request_failed"]
    I -- blocked / server\n'Unavailable for org' --> I3["Error: Ultrareview unavailable\nfor your organization"]
    I -- needs-confirm --> I4["Show cost/time estimate dialog\n($10-$20, ~10-20 min)\nAwait user confirm / cancel"]
    I4 -- cancelled --> I5["Ultrareview cancelled."]
    I4 -- confirmed --> J
    I -- proceed --> J
    J[Run remote session setup\nteleportToRemote]
    J --> K{In git repo?}
    K -- No --> K1["Error: not_in_git_repo"]
    K -- Yes --> L{Git remote present?}
    L -- No --> L1["Error: no_git_remote"]
    L -- Yes --> M{GitHub remote\n(github.com)?}
    M -- No GitHub --> M1["Warn / fallback path\n(no_github_remote /\nghes_optimistic)"]
    M -- Yes --> N{GitHub App installed?}
    N -- No --> N1["Error: github_app_not_installed"]
    N -- Yes --> O{Repo size ≤ 5 000 000 bytes?}
    O -- Too large --> O1["Error: Repo is too large.\nPush a PR and use\n/ultrareview PR# instead"]
    O -- OK --> P[Bundle & upload git state\nteleportGitBundleUpload]
    P --> Q[Create remote session\ncreateRemoteSession]
    Q --> R{Session created?}
    R -- No --> R1["Error: Ultrareview failed to\nlaunch the remote session"]
    R -- Yes --> S[Poll remote session\nmonitorRemoteSession\n(max 1 800 000 ms / 30 min)]
    S --> T{Session status}
    T -- completed --> T1["Deliver review findings\nvia task-notification"]
    T -- error --> T2["Error: remote session\nreturned an error"]
    T -- timeout --> T3["Error: remote session\nexceeded 30 minutes"]
    T -- no output --> T4["Error: no review output —\norchestrator may have exited early"]
```

Analysis basis: CC v2.1.132 bundle.js:+10956998 (handler entry `nM7`)

---

## Behavioral Spec

### 1. Handler Entry and Policy Gate

```
async function ultrareviewHandler(context):
    // Check organization remote-session policy flag
    if NOT context.config["allow_remote_sessions"]:
        display error: "Remote sessions are disabled by your organization's policy.
                        Contact your organization admin to enable them."
        return

    // Introduce a small random startup jitter
    wait for randomDelay(base=2)   // uses Math.random, setTimeout

    // Run the full precondition + execution pipeline
    result = await runPreconditionsAndExecute(context)
    return result
```

Analysis basis: CC v2.1.132 bundle.js:+10956998, +10957001, +10957033

---

### 2. Precondition Checks (`preconditionChecker` / `checkRemotePreconditions`)

Preconditions are evaluated in sequence; the first failure short-circuits execution and emits `tengu_review_remote_precondition_failed`.

```
async function checkRemotePreconditions(context):
    emit telemetry("tengu_review_remote_precondition_failed") on any failure

    // 2a. Network mode check
    telemetryMode = getTelemetryMode()   // "essential-traffic", "no-telemetry", "default"
    if telemetryMode == "essential-traffic":
        return { status: "blocked",
                 message: "Ultrareview runs in Claude Code on the web and is
                           unavailable when essential-traffic-only mode is active." }

    // 2b. OAuth token check
    token = getOAuthToken()
    if NOT token:
        return { status: "no_oauth_token",
                 message: "Ultrareview requires a Claude.ai account. Run /login." }

    // 2c. API preflight call
    orgUUID = getOrganizationUUID()
    if NOT orgUUID:
        return error "Unable to get organization UUID"

    preflightResponse = await POST "/api_ultrareview_preflight"
        headers: { "x-organization-uuid": orgUUID }
        timeout: 5000 ms

    if preflightResponse.status == "schema_mismatch":
        return { status: "schema_mismatch" }
    if preflightResponse.status == "request_failed":
        return { status: "request_failed" }
    if preflightResponse.status in ["blocked", "server"]:
        return { status: preflightResponse.status,
                 message: "Ultrareview is unavailable for your organization." }

    // 2d. Overage / billing gate
    if isOverBillingLimit(context):
        emit telemetry("tengu_review_overage_blocked")
        show overage-blocked UI; return

    if preflightResponse.status == "needs-confirm":
        emit telemetry("tengu_review_overage_dialog_shown")
        userChoice = await showCostConfirmDialog(
            estimatedCost:  "$10-$20",
            estimatedTime:  "~10–20 min"
        )
        if userChoice != "confirm":
            return { status: "cancelled", message: "Ultrareview cancelled." }

    return { status: "proceed" }
```

Analysis basis: CC v2.1.132 bundle.js:+10919023, +10917160, +10917724, +10917751, +10917882, +10917953, +10918048, +10918193, +10918226, +10918350, +10921605, +10921823, +10921918, +10921985, +10957300, +10957635

---

### 3. Bug-Hunter Configuration (`bughunterConfig`)

Before launching the remote session, the handler loads the review configuration object (logged as `tengu_review_bughunter_config`).

```
function loadBughunterConfig():
    config = {
        tag:             "ultrareview",
        costEstimate:    "$10-$20",
        timeEstimate:    "~10–20 min",
        // progress tick parameters (used by UI progress bar)
        tickMin:         5,
        tickMax:         20,
        tickMidpoint:    25,
        tickDurationMin: 600,
        tickDurationMax: 1800,
        tickPercentLow:  22,
        tickPercentHigh: 27,
    }
    emit telemetry("tengu_review_bughunter_config")
    return config
```

Analysis basis: CC v2.1.132 bundle.js:+10917160, +10917277, +10917369, +10923190, +10923192, +10923256, +10923319, +10923323, +10923392, +10923395

---

### 4. Git State Collection (`collectGitContext`)

```
async function collectGitContext():
    // Verify inside a git work tree
    run git("rev-parse", "--is-inside-work-tree")

    // Obtain remote URL
    remoteUrl = run git("config", "--get", "remote.origin.url")
    if NOT remoteUrl:
        return error "No git remote URL found"

    // Sanitize credentials from URL  (replaces "://***@" pattern)
    sanitizedUrl = redactCredentials(remoteUrl)

    // Determine default branch
    defaultBranch = run git("symbolic-ref", "--short", "refs/remotes/origin/HEAD")
    if NOT defaultBranch:
        defaultBranch = firstOf("main", "master") that exists via git("show-ref")

    // Determine current branch
    currentBranch = run git("branch", "--abbrev-ref", "HEAD")

    // Compute merge-base diff stats
    mergeBase = run git("merge-base", defaultBranch, currentBranch)
    diffStats = run git("diff", "--shortstat", mergeBase)

    return { remoteUrl: sanitizedUrl, defaultBranch, currentBranch, mergeBase, diffStats }
```

Analysis basis: CC v2.1.132 bundle.js:+6439498, +6439510, +999593, +999602, +999610, +999739, +1002324, +1007337, +1007352, +1007509, +1007524, +1007534, +1007647, +1007654, +10920273, +10920284, +10920674, +10921189, +10921196

---

### 5. Repository Size Check

```
async function checkRepoSize():
    // git count-objects -v returns object count and pack sizes in KiB
    stats = run git("count-objects", "-v")
    sizeKiB = parse Number from stats

    bytesEstimate = sizeKiB * 1024   // 1 KiB = 1024 bytes

    if bytesEstimate > 5_000_000:
        emit telemetry("tengu_ccr_bundle_max_bytes")
        return {
            tooLarge: true,
            message: "Repo is too large to bundle. Push a PR and use
                      `/ultrareview <PR#>` instead."
        }
    return { tooLarge: false }
```

Repo size limit: **5 000 000 bytes** (bundle.js:+7795739)

Analysis basis: CC v2.1.132 bundle.js:+7795213, +7795298, +7795314, +7795513, +7795739, +10920143

---

### 6. GitHub App Preflight (`checkGithubAppInstalled`)

```
async function checkGithubAppInstalled(orgUUID, accessToken):
    if NOT accessToken:
        log "checkGithubAppInstalled: No access token found, assuming app not installed"
        return false

    if NOT orgUUID:
        log "checkGithubAppInstalled: No org UUID found, assuming app not installed"
        return false

    response = await GET github-app-check endpoint
        headers: { "x-organization-uuid": orgUUID }

    if response.isAxiosError AND response.status == 400:
        return false   // app not installed

    return response.status == 200
```

Analysis basis: CC v2.1.132 bundle.js:+6439612, +6439645, +6439758, +6440015, +6440362, +6440416

---

### 7. Git Bundle Upload (`teleportGitBundleUpload`)

```
async function teleportGitBundleUpload(repoPath, sessionId):
    emit telemetry("tengu_ccr_bundle_upload")

    // Validate repository has commits
    hasCommits = run git("for-each-ref", "--count=1", "refs/")
    if NOT hasCommits:
        return error "Repository has no commits yet"

    // Optional: stash uncommitted changes
    stashRef = run git("stash", "create")

    // Write seed stash refs for upload
    run git("update-ref", "refs/seed/stash", stashRef)   // if stash present
    run git("update-ref", "refs/seed/root", headRef)

    // Create bundle file  (written as "ccr-seed.bundle" → "_source_seed.bundle")
    bundleFile = writeTempFile(randomBytes(hex), suffix=".bundle")
    run git("bundle", "create", bundleFile, /* refs */)

    // Upload bundle via multipart POST
    uploadResult = await uploadBundleToSession(sessionId, bundleFile)

    // Clean up temp refs
    run git("update-ref", "-d", "refs/seed/stash")
    run git("update-ref", "-d", "refs/seed/root")

    // Remove temp file
    unlink(bundleFile)

    return {
        mode: oneOf("head", "fallback_head", "squashed", "fallback_squashed"),
        status: oneOf("success", "failed", "upload_failed", "stash_failed", "empty_repo")
    }
```

Analysis basis: CC v2.1.132 bundle.js:+7798297, +7798326, +7798358, +7798398, +7798416, +7798449, +7798500, +7798527, +7798704, +7798782, +7798790, +7799079, +7799436, +7799447, +7799739, +7800033

---

### 8. Remote Session Creation (`createRemoteSession`)

```
async function createRemoteSession(params):
    // Determine bundle transport mode
    bundleMode = decide(
        "bundle" | "explicit_env_bundle" | "git_repository" |
        "too_large" | "explicit_source_url" | "no_git_at_all"
    )
    emit telemetry("tengu_teleport_bundle_mode", { mode: bundleMode })

    // Select or auto-create cloud environment
    environments = await listEnvironments()   // "teleport_environments_list"
    if environments is empty:
        env = await createDefaultEnvironment({
            name:    "Default",
            network: "anthropic_cloud",
            homedir: "/home/user",
            python:  "3.11",
            node:    "20"
        })   // "teleport_default_environment_create"
        if env creation failed:
            warn "Could not create a cloud environment. Set one up at
                  https://claude.ai/code/onboarding?magic=env-setup"
            emit "env_create" error

    // Build session payload
    sessionPayload = {
        type:           "Remote task",
        permissionMode: "set" | "unset",
        event:          "control_request",
        action:         "set_permission_mode",
    }

    // POST to create session (expects HTTP 201)
    response = await POST createSessionEndpoint(sessionPayload)
        headers: {
            "anthropic-beta":           "ccr-byoc-2025-07-29",
            "anthropic-client-platform": <platform>,
            "x-organization-uuid":       orgUUID
        }

    if response.status != 201:
        return error "Server returned a malformed session response (no session id)"

    emit telemetry("tengu_ccr_session_link")
    return { sessionId: response.body.id }
```

Analysis basis: CC v2.1.132 bundle.js:+7813288, +7813649, +7813781, +7813833, +7814046, +7814509, +7814601, +7814891, +7815031, +7815066, +7815243, +7815347, +7816198, +7816236, +7816833, +7816933, +7816955, +7808100

---

### 9. Session Monitoring (`monitorRemoteSession`)

```
async function monitorRemoteSession(sessionId):
    TIMEOUT_MS = 1_800_000   // 30 minutes

    session = await openRemoteAgentSession(sessionId)
    // session type: "remote_agent"
    startTime = Date.now()

    loop:
        status = await pollSession(sessionId)

        switch status:
            case "starting" | "pending":
                continue polling
            case "running":
                // emit progress hook events: hook_started, hook_progress, hook_response
                continue polling
            case "idle":
                // SessionStart acknowledged
                continue polling
            case "completed":
                result = extractResult(status.messages)
                if result is empty:
                    return error "no review output — orchestrator may have exited early"
                return { success: true, result }
            case "archived":
                return error "remote session returned an error"
            case "error":
                return error "remote session returned an error"

        if Date.now() - startTime > TIMEOUT_MS:
            return error "remote session exceeded 30 minutes"

        await sleep(pollingInterval)
```

Session timeout: **1 800 000 ms (30 minutes)** (bundle.js:+7827651)

Analysis basis: CC v2.1.132 bundle.js:+7826053, +7826056, +7826164, +7827651, +7827922, +7828095, +7828170, +7828602, +7828785, +7828814, +7829221, +7829305, +7829395, +7829622, +7830173, +7830214, +7830251

---

### 10. Result Delivery and Post-Invocation Prompt

After the remote session completes, the handler constructs a follow-up prompt that instructs the local agent to briefly acknowledge visible output without repeating the target URL or billing note, and that findings will arrive via task-notification. The agent is told the output is "already visible to the user" and to acknowledge concisely (≤ "briefly acknowledge it" behavior).

Analysis basis: CC v2.1.132 bundle.js:+10956661

---

### 11. Cancellation

If the user declines the cost confirmation dialog, the command exits with the message `"Ultrareview cancelled."` and emits no further telemetry.

Analysis basis: CC v2.1.132 bundle.js:+10957940

---

### 12. Admin Settings Redirect

When overage is blocked, the UI presents a link to `/admin-settings/` for the organization administrator.

Analysis basis: CC v2.1.132 bundle.js:+10957422

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_review_bughunter_config` | Fired when bughunter config is loaded (bundle.js:+10917160) |
| Telemetry: `tengu_review_remote_precondition_failed` | Fired on any precondition failure before launch (bundle.js:+10919038) |
| Telemetry: `tengu_review_overage_blocked` | Fired when billing overage blocks execution (bundle.js:+10957300) |
| Telemetry: `tengu_review_overage_dialog_shown` | Fired when cost-confirmation dialog is displayed (bundle.js:+10957635) |
| Telemetry: `tengu_review_remote_teleport_failed` | Fired when remote teleport fails to launch (bundle.js:+10924470) |
| Telemetry: `tengu_review_remote_launched` | Fired on successful remote session launch (bundle.js:+10924954) |
| Telemetry: `tengu_ccr_bundle_max_bytes` | Fired when repo size exceeds 5 000 000 bytes (bundle.js:+7795213) |
| Telemetry: `tengu_ccr_bundle_seed_enabled` | Fired when seed-bundle path is active (bundle.js:+6442133) |
| Telemetry: `tengu_ccr_bundle_upload` | Fired during git bundle upload (bundle.js:+7798590) |
| Telemetry: `tengu_teleport_bundle_mode` | Records which bundle transport mode was chosen (bundle.js:+7813684) |
| Telemetry: `tengu_ccr_session_link` | Fired after session creation with link info (bundle.js:+7808100) |
| Telemetry: `tengu_teleport_source_decision` | Records the source-bundle decision (bundle.js:+7818580) |
| Telemetry: `tengu_slate_kestrel` | Fired during first-party eligibility evaluation (bundle.js:+9766163) |
| Telemetry: `tengu_bg_spare_enable` | Fired when background spare pool is enabled (bundle.js:+14129457) |
| Telemetry: `tengu_bg_spare_spawn` | Fired when a spare background worker is spawned (bundle.js:+14129749) |
| Telemetry: `tengu_daemon_control` | Fired on daemon start/stop control events (bundle.js:+14164048) |
| Telemetry: `tengu_daemon_config_reload` | Fired when daemon config is reloaded (bundle.js:+14143280) |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` | General feature gate outcomes (bundle.js:+906461, +906517, +906587) |
| Git stash refs | Creates and removes `refs/seed/stash`, `refs/seed/root` (transient) |
| Temp files | `ccr-seed.bundle`, `_source_seed.bundle` written and unlinked after upload |
| `daemon.status.json` | Written/updated during session lifecycle |
| Network requests | API preflight POST, environments list GET, session creation POST, bundle upload |
| appState changes | Remote session state tracked; `remoteControlAtStartup` flag consulted |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.132 | Initial analysis |

---

## Common Mistakes

1. **Using an API key instead of OAuth**: `/ultrareview` requires a Claude.ai account OAuth token. API key authentication is explicitly rejected with the message about running `/login`. The error code is `no_oauth_token`.

2. **Running on a repo without a GitHub remote**: The command requires a GitHub (`github.com`) remote. Non-GitHub remotes may trigger the `no_github_remote` / `ghes_optimistic` fallback path or an outright error. Ensure `git remote add origin <github-url>` is configured.

3. **Oversized repository**: Repositories estimated above **5 000 000 bytes** are rejected. In that case the user must push a branch, open a PR, and invoke `/ultrareview <PR#>` instead.

4. **Passing `/ultrareview` in essential-traffic-only mode**: When the network telemetry mode is `essential-traffic`, the command is entirely blocked. This is an organizational network policy setting, not a user-configurable option.

5. **Organization policy block**: If the `allow_remote_sessions` flag is `false` in the organization config, the command errors immediately before any git checks or API calls are made.

6. **GitHub App not installed**: Even with a valid GitHub remote and OAuth token, the command will fail if the Claude GitHub App has not been installed for the organization. The user must set this up at `https://claude.ai/code`.

7. **Dismissing the cost dialog and expecting the session to start anyway**: Cancelling the `needs-confirm` cost/time dialog terminates the command completely (`"Ultrareview cancelled."`). There is no way to re-confirm without re-invoking `/ultrareview`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `nM7` | Main async handler for `/ultrareview` (Arbor-resolved entry point) |
| `AL` | Remote eligibility / first-party check dispatcher |
| `Mr9` | Eligibility check orchestrator |
| `FIA` | Feature-gate evaluator (wraps `zm` and `Kr9`) |
| `zm` | First-party plan/tier classification |
| `Kr9` | Config file reader (calls `qr9.readFileSync`) |
| `kq` | Telemetry mode resolver |
| `h1_` | Telemetry flag string builder |
| `yH` | String coercion utility |
| `H` | Random delay helper (Math.random + setTimeout) |
| `ayA` | Core precondition + remote launch pipeline |
| `bH8` | Git work-tree verifier (runs `rev-parse --is-inside-work-tree`) |
| `N6` | Async context / store accessor |
| `Qv6` | AsyncLocalStorage store getter |
| `_A` | Store fallback resolver |
| `PA` | Subprocess runner (primary) |
| `rJH` | Low-level subprocess executor |
| `Y` | Background process lifetime manager |
| `ujL` | String-to-UTF8 buffer helper |
| `fH` | Subprocess error logger |
| `d` | State atom getter/setter |
| `Hk` | Remote URL + default-branch resolver |
| `pp` | Remote URL cache lookup |
| `Qy8` | Remote URL from config store |
| `L` | Column/padding formatter |
| `K` | Process lifecycle manager (exit, etc.) |
| `k` | Commit/ref metadata builder |
| `Lsq` | Git log reader |
| `RH` | JSON serializer wrapper |
| `mf` | Path redactor (`[REDACTED]` insertion) |
| `gNH` | Repo slug extractor |
| `Msq` | Git bundle writer (creates `.bundle` files) |
| `syH` | URL credential scrubber (`://***@` replacement) |
| `aJH` | Git remote URL parser / protocol classifier |
| `fK_` | URL split/includes helper |
| `a9` | String slice indexer |
| `U09` | Repository size checker (git `count-objects -v`) |
| `p09` | Size parser (Number coercion, KiB→bytes) |
| `m09` | Daemon/background-session message emitter |
| `j6` | Background session message bus |
| `Y8` | Subprocess orchestrator (higher-level) |
| `z` | Daemon stop / control sequencer |
| `SH` | Daemon stop signal sender |
| `mH` | Daemon stop failure handler |
| `Jx` | Remote session controller |
| `Mo` | Remote session mount point resolver |
| `rPH` | Virtual session router |
| `qt8` | Session UUID generator + event emitter |
| `pC` | Process exit / race-condition manager |
| `uU` | MCP server shutdown helper |
| `UU` | Timeout clearer for session teardown |
| `o8` | Abort-signal timeout wrapper |
| `zZ` | Default-branch resolver (symbolic-ref path) |
| `dy8` | Default-branch cache getter |
| `dw` | Current-branch resolver (`branch --abbrev-ref HEAD`) |
| `Fy8` | Current-branch cache getter |
| `$` | App-state writer (file-system persistence) |
| `mzq` | Daemon status JSON writer |
| `Er` | Error formatter |
| `lY` | Atomic file writer (randomBytes + rename) |
| `PX6` | Daemon status file path builder |
| `syA` | Remote review session launcher (top-level for `tyA`) |
| `QKq` | Preflight + feature-check runner |
| `B6` | JSON parser wrapper |
| `Vz` | OAuth / web-session validator |
| `L7` | Token store accessor |
| `xV` | Org UUID fetcher |
| `__` | OAuth environment URL resolver |
| `W__` | Allowed OAuth endpoint set |
| `eDL` | Custom OAuth URL validator |
| `x5` | HTTP client factory (Axios) |
| `e8H` | Axios instance builder |
| `Z8` | State setter wrapper |
| `QIH` | Background-session notification dispatcher |
| `knH` | Session notification emitter |
| `WL8` | Subscription plan checker |
| `TZ` | Plan tier extractor |
| `w5H` | Subscription type + plan resolver |
| `g7` | Subscription type mapper |
| `nY` | Account / subscription details fetcher |
| `R6` | Subscription record builder |
| `R_` | Plan eligibility gate |
| `fU` | Boolean subscription flag coercer |
| `Qb` | Role + plan eligibility checker |
| `F9` | Role-to-plan mapping |
| `wx_` | Workspace plan label |
| `Yx_` | Individual plan label |
| `jn` | Session-notification re-emitter |
| `lM7` | Outer review orchestrator (wraps `tyA`) |
| `tyA` | Full review execution function (git collect → bundle → session → poll) |
| `LQH` | Background eligibility + launch coordinator |
| `qL9` | Background eligibility checker (all gate conditions) |
| `E` | Keyboard-event / UI event handler |
| `u` | UI event source (preventDefault) |
| `CP` | User settings reader |
| `D` | Supervisor config updater |
| `zOH` | Progress-tick animator |
| `FKq` | Progress notification emitter |
| `u1H` | Remote session creation + environment setup |
| `DjA` | Session request builder |
| `fjA` | Git bundle upload function (`teleportGitBundleUpload`) |
| `v6` | Session environment selector |
| `F09` | Session event payload builder |
| `B09` | Session link state recorder |
| `ic` | Environment list fetcher (`teleport_environments_list`) |
| `kBH` | Default environment creator (`teleport_default_environment_create`) |
| `vH` | String-to-displayable converter |
| `gV4` | Task title generator (`teleport_generate_title`) |
| `NS` | Background message sender |
| `PGH` | GitHub App installation checker |
| `xq` | Cross-origin message bus |
| `HA` | Error string normalizer |
| `KQH` | Remote session monitor / poller |
| `Zy` | Session open helper (randomBytes-based auth) |
| `hq8` | WebSocket/SSE session opener |
| `cP` | Session keepalive/poll ticker |
| `aV4` | Session result formatter |
| `d09` | Session event stream processor (all status transitions) |
| `iEH` | Session teardown / cleanup |
| `zD` | Async cleanup sequencer |
| `cM7` | Post-completion message mapper |
| `oyA` | Cancellation handler |