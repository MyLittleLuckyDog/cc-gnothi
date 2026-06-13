---
type: feature-spec
feature: "ultrareview"
cc_version: 2.1.177
updated: "2026-06-13"
tags: ["ultrareview", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.176
analysis_basis: "CC v2.1.176 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultrareview`

> Analysis basis: CC v2.1.176 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.176

---

## Overview

`/ultrareview` launches a cloud-hosted agent session that performs deep bug-finding and verification across the current Git branch, running entirely on Claude Code's web infrastructure. It collects repository context (remote URL, branch information, a Git bundle of local changes), executes a multi-phase preflight sequence, uploads the repository bundle to a remote cloud environment, and then streams the agent's review results back to the local CLI — all at an estimated cost of $10–$20 USD and a runtime of approximately 10–20 minutes.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultrareview` |
| description | `"Start a cloud agent that finds and verifies bugs in your branch ( ... , ... USD) · Runs in Claude Code on the web. See ..."` |
| loc_byte | `12572527` |
| loc_byte_end | `12572797` |
| loc_line | `8727` |
| module_id | `n3K` |
| load_inline | `true` |
| arbor_handler.name | `eoL` |
| arbor_handler.fqn | `claude-2.1.176::eoL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.176 bundle.js:+12572527

---

## Input Branching

The command has many distinct phases and branches (policy check → remote-sessions gate → preflight API call → repository/bundle analysis → environment selection → session creation → streaming poll), warranting a Mermaid flowchart.

```mermaid
flowchart TD
    A([/ultrareview invoked]) --> B{allow_remote_sessions\npolicy enabled?}
    B -- No --> BLOCK["Error: Cloud sessions disabled\nby org policy"]
    B -- Yes --> C{Overage check\npassed?}
    C -- Blocked --> OB["tengu_review_overage_blocked\nAbort"]
    C -- Dialog shown --> OD["tengu_review_overage_dialog_shown\nAwait user confirm"]
    OD -- Cancelled --> CANCEL["Ultrareview cancelled."]
    OD -- Confirmed --> D
    C -- OK --> D{Call /v1/ultrareview/preflight\n(timeout 5000 ms)}
    D -- essential-traffic-only --> ETB["Error: unavailable in\nessential-traffic-only mode"]
    D -- zdr / data-residency --> ZDR["Error: unavailable on\nthird-party providers"]
    D -- no-auth --> NOAUTH["Error: Requires Claude.ai\naccount — run /login"]
    D -- blocked / server error --> SRV["Error: Ultrareview unavailable\nfor your organization"]
    D -- schema_mismatch --> SM["tengu_review_remote_precondition_failed\nAbort"]
    D -- request_failed --> RF["tengu_review_remote_precondition_failed\nAbort"]
    D -- needs-confirm --> CONFIRM["Prompt user for confirmation\n($10–$20, ~10–20 min)"]
    D -- proceed --> REPO
    CONFIRM -- Cancelled --> CANCEL
    CONFIRM -- Confirmed --> REPO
    REPO{Collect repo context\ngit remote URL + branches\nmerge-base + diff --shortstat}
    REPO -- not_in_git_repo --> E1["Error: not in git repo"]
    REPO -- no_git_remote --> E2["Error: no GitHub remote"]
    REPO -- github.com remote OK --> GHCHECK{Check GitHub\nApp installed?}
    GHCHECK -- not installed --> E3["Error: GitHub App\nnot installed"]
    GHCHECK -- installed --> BUNDLE
    BUNDLE{Bundle upload phase\ntengu_teleport_bundle_mode}
    BUNDLE -- too_large --> TL["Error: repo too large"]
    BUNDLE -- empty_repo / no_changes --> EM["Error or warning"]
    BUNDLE -- success --> ENV
    ENV{Select cloud environment\n(list environments)}
    ENV -- no_environments --> NE["Error: no environments"]
    ENV -- no_default_env --> NDE["Attempt auto-create default env"]
    NDE -- failed --> NDE2["Error: could not create env"]
    NDE -- created --> SESSION
    ENV -- env selected --> SESSION
    SESSION{POST: create remote session\nwith bundle + branch info}
    SESSION -- 401/403/429 --> SE["HTTP error — auth/rate"]
    SESSION -- github_repo_access_denied --> GAD["Error: GitHub access denied"]
    SESSION -- malformed_response --> MR["Error: no session id"]
    SESSION -- created 201 --> POLL
    POLL{Poll session status\nevery 1000 ms\nmax 1 800 000 ms = 30 min}
    POLL -- completed --> RESULT["Stream findings to CLI\ntengu_review_remote_launched"]
    POLL -- archived / error --> FAIL["cloud session returned an error"]
    POLL -- timeout 30 min --> TOUT["cloud session exceeded 30 minutes"]
    POLL -- no review output --> NRO["no review output — orchestrator\nmay have exited early"]
    RESULT --> END([Done])
    FAIL --> TFAIL["tengu_review_remote_teleport_failed\nAbort"]
    TOUT --> TFAIL
    NRO --> TFAIL
```

Analysis basis: CC v2.1.176 bundle.js:+12570183 (handler entry `eoL`)

---

## Behavioral Spec

### 1. Policy and Remote-Sessions Gate

```
async function ultrareviewHandler(args, appState):
    if appState.settings["allow_remote_sessions"] is falsy:
        display error: "Cloud sessions are disabled by your
                        organization's policy. Contact your
                        organization admin to enable them."
        emit telemetry: tengu_review_overage_blocked (if overage case)
        return
```

The `allow_remote_sessions` flag is read from application settings before any other work begins.
Analysis basis: CC v2.1.176 bundle.js:+12570186

### 2. Overage / Billing Check

```
function checkOverage(appState):
    result = evaluateBillingOverage(appState)
    if result == "blocked":
        emit telemetry: tengu_review_overage_blocked
        return ABORT
    if result == "needs-dialog":
        emit telemetry: tengu_review_overage_dialog_shown
        await userConfirmation()
        if not confirmed: return ABORT
    return OK
```

Analysis basis: CC v2.1.176 bundle.js:+12570515 (`d`), +12570660 (`kK6`)

### 3. Preflight API Call (`h3K`)

```
async function runPreflight(authToken, orgTeleportOrg):
    response = await httpGet(
        "/v1/ultrareview/preflight",
        headers: { "teleport-org": orgTeleportOrg },
        timeout: 5000
    )
    status = parsePreflightStatus(response)
    switch status:
        case "essential-traffic-only":
            return error("Ultrareview runs in Claude Code on the web
                          and is unavailable when essential-traffic-only
                          mode is active.")
        case "zdr" / "data-residency":
            return error("Ultrareview runs in Claude Code on the web
                          and is unavailable on third-party providers.")
        case "no-auth":
            return error("Ultrareview requires a Claude.ai account.
                          Run /login to authenticate.")
        case "blocked" / server error:
            return error("Ultrareview is unavailable for your organization.")
        case "schema_mismatch":
            emit tengu_review_remote_precondition_failed { reason: "schema_mismatch" }
            return ABORT
        case "request_failed":
            emit tengu_review_remote_precondition_failed { reason: "request_failed" }
            return ABORT
        case "needs-confirm":
            await showCostConfirmationDialog("$10-$20", "~10–20 min")
            if not confirmed: return ABORT
        case "proceed":
            continue
    emit telemetry: api_ultrareview_preflight
```

Preflight endpoint: `/v1/ultrareview/preflight` (bundle.js:+12531242).
Timeout: 5000 ms (bundle.js:+12531299).
Cost estimate shown to user: `$10-$20` (bundle.js:+7377562).
Duration estimate: `~10–20 min` (bundle.js:+7377654).

### 4. Repository Context Collection (`ewA` + sub-helpers)

```
async function collectRepoContext():
    // Verify git repo
    run git("rev-parse", "--is-inside-work-tree")
    // Get remote URL
    remoteUrl = run git("config", "--get", "remote.origin.url")
    if not remoteUrl: return error("No git remote URL found")
    // Sanitize credentials from URL
    sanitizedUrl = remoteUrl.replace("://***@" pattern)
    // Detect default branch
    defaultBranch = resolveDefaultBranch()   // tries symbolic-ref, falls back to "main"/"master"
    // Detect current branch
    currentBranch = run git("branch", "--abbrev-ref", "HEAD")
    // Compute merge-base with default branch
    mergeBase = run git("merge-base", defaultBranch, currentBranch)
    // Compute diff stats
    diffStats = run git("diff", "--shortstat", mergeBase)
    // Parse changed-file count and line counts
    return { remoteUrl: sanitizedUrl, defaultBranch, currentBranch, mergeBase, diffStats }
```

Git commands observed: `rev-parse --is-inside-work-tree`, `config --get remote.origin.url`, `symbolic-ref --short refs/remotes/origin/HEAD`, `branch --abbrev-ref HEAD`, `merge-base`, `diff --shortstat`.
Analysis basis: CC v2.1.176 bundle.js:+12532890 (`ewA`), +9312154, +1144453, +1155636, +1155454, +12534614, +12535128

### 5. Repository Size Check (`Vhq`)

```
async function checkRepoBundleSize():
    output = run git("count-objects", "-v")
    sizeKB = parseCountObjects(output)
    if sizeKB > 5_000_000:          // 5 GB threshold (bundle.js:+9345181)
        emit tengu_ccr_bundle_max_bytes
        return error("Repository too large")
    if objectCount > 100:           // object count threshold (bundle.js:+9345162)
        // warn but continue
    return OK
```

Analysis basis: CC v2.1.176 bundle.js:+12534031 (`Vhq`), +9344740, +9345162, +9345181

### 6. GitHub App and Eligibility Checks (`Kyq` / `GmH`)

```
async function checkGitHubEligibility(accessToken, orgUuid, remoteUrl):
    if not accessToken:
        log "checkGithubAppInstalled: No access token found, assuming app not installed"
        return { installed: false, reason: "not_logged_in" }
    if not orgUuid:
        log "checkGithubAppInstalled: No org UUID found, assuming app not installed"
        return { installed: false, reason: "github_app_not_installed" }
    response = await httpGet(
        githubAppCheckEndpoint,
        headers: { "anthropic-beta": "ccr-byoc-2025-07-29",
                   "x-organization-uuid": orgUuid }
    )
    if response.status == 400: return { installed: false }
    return { installed: true }
```

BYOC beta header: `ccr-byoc-2025-07-29` (bundle.js:+9364326).
Analysis basis: CC v2.1.176 bundle.js:+9438979 (`GmH`), +9312301, +9312414

### 7. Git Bundle Upload (`OAA`)

```
async function uploadGitBundle(sessionParams):
    // Clean up any prior seed refs
    run git("update-ref", "-d", "refs/seed/stash")
    run git("update-ref", "-d", "refs/seed/root")
    // Verify repo has commits
    refCount = run git("for-each-ref", "--count=1", "refs/")
    if refCount == 0: return error("Repository has no commits yet")
    // Stash uncommitted changes
    stashRef = run git("stash", "create")
    if stash failed: emit tengu_ccr_bundle_upload { result: "stash_failed" }
    // Create bundle file  ccr-seed.bundle
    bundleFile = createTempFile("ccr-seed", ".bundle")
    run git("bundle", "create", bundleFile, ...)
    // Upload bundle
    response = await httpPost(uploadUrl, bundleFile)
    if response.status != 200:
        emit tengu_ccr_bundle_upload { result: "upload_failed" }
        return error
    emit tengu_ccr_bundle_upload { result: "success", head/fallback_head/squashed/fallback_squashed }
    // Remove temp bundle
    fs.unlink(bundleFile)
    return uploadResult
```

Bundle file suffix: `.bundle` (bundle.js:+9349046).
Seed ref names: `refs/seed/stash`, `refs/seed/root` (bundle.js:+9347840, +9347858).
Analysis basis: CC v2.1.176 bundle.js:+9347710 (`OAA`), +9349035

### 8. Environment Selection and Session Creation (`qo` / `toL`)

```
async function teleportToRemote(repoContext, bundleResult, taskDescription):
    // Phase: env-select
    log "[teleport] phase: env-select"
    environments = await listCloudEnvironments(accessToken, orgUuid, timeout: 15000)
    if environments is empty:
        result = await tryAutoCreateDefaultEnvironment()
        if failed:
            warn "Could not create a cloud environment. Set one up at
                  https://claude.ai/code/onboarding?magic=env-setup"
            emit tengu_teleport_source_decision { reason: "no_default_env" }
            return error("No environments available for session creation")
    selectedEnv = pickBestEnvironment(environments)
    // Phase: branch-detect
    log "[teleport] phase: branch-detect"
    // Phase: bundle-upload (if needed)
    log "[teleport] phase: bundle-upload"
    // Generate task title via API (model: claude/task, max_tokens: 75)
    title = await generateTaskTitle(taskDescription)   // tengu_teleport_generate_title
    // Phase: POST session creation
    log "[teleport] phase: POST-sent"
    sessionPayload = buildSessionPayload(
        environmentId: selectedEnv.id,
        sourceRef: bundleResult,
        title: title,
        permissionMode: "default",
        flagSettings: { ... }
    )
    response = await httpPost(sessionCreationEndpoint, sessionPayload,
                              headers: { "anthropic-beta": "ccr-byoc-2025-07-29",
                                         "x-organization-uuid": orgUuid })
    if response.status in [401, 403, 429]: return handleAuthOrRateError(response)
    if response.status == 201 and no session_id:
        emit error "Server returned a malformed session response (no session id)"
        return error({ reason: "malformed_response" })
    sessionId = response.data.session_id
    emit tengu_ccr_session_link { sessionId }
    return sessionId
```

Environment list timeout: 15000 ms (bundle.js:+9310565).
Task model: `claude/task`, max_tokens: 75 (bundle.js:+9351112, +9351123).
HTTP status codes handled: 200, 201, 401, 403, 429 (bundle.js:+9365625, +9365693, +9365697, +9365701).
Auto-created default env name: `"Default"` (bundle.js:+9310825).
Analysis basis: CC v2.1.176 bundle.js:+12537970 (`qo`), +9363260, +9365535, +9366071

### 9. Session Polling and Result Streaming (`SmH` / `$yq`)

```
async function pollSessionUntilComplete(sessionId, accessToken):
    startTime = Date.now()
    sessionFile = createSessionTempFile()   // 8 random bytes
    while true:
        await sleep(1000)                   // poll interval: 1000 ms (bundle.js:+9446856)
        if Date.now() - startTime > 1_800_000:   // 30-min timeout (bundle.js:+9446863)
            return error("cloud session exceeded 30 minutes")
        status = await fetchSessionStatus(sessionId)
        switch status:
            case "pending" / "starting" / "running":
                streamProgressEvents()
                handleHookEvents()   // hook_progress, hook_response, hook_started
                continue
            case "completed":
                result = extractResultMessages(status.messages)
                if not result:
                    return error("no review output — orchestrator may have exited early")
                emit tengu_review_remote_launched
                return result
            case "archived" / error:
                return error("cloud session returned an error")
```

Session polling interval: 1000 ms (bundle.js:+9446856).
Maximum session runtime: 1 800 000 ms = 30 minutes (bundle.js:+9446863).
Session status values observed: `pending`, `starting`, `running`, `completed`, `archived` (bundle.js:+13622853, +9448890, +9445286, +9447382, +9447307).
Hook event types: `hook_progress`, `hook_response`, `hook_started` (bundle.js:+9448053, +9448082, +9448573).
Analysis basis: CC v2.1.176 bundle.js:+12539144 (`SmH`), +9445438, +9445700 (`$yq`)

### 10. `--fix` Flag Support

When the user passes `--fix`, a supplementary instruction is appended to the task context:

> "…when the findings arrive, apply them to the local working tree."

The mode is added as a `"fix"` token into the command-type set alongside `"comment"`. The alternate alias `/code-review ultra` is also recognized.
Analysis basis: CC v2.1.176 bundle.js:+12532773, +12532779, +12532858, +12569922

### 11. Cancellation

If the user cancels at any point (overage dialog, cost confirmation dialog, or during polling), the handler emits the message `"Ultrareview cancelled."` and returns cleanly.
Analysis basis: CC v2.1.176 bundle.js:+12571161

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: tengu_review_remote_precondition_failed | Emitted when preflight returns schema_mismatch or request_failed (bundle.js:+12532905) |
| Telemetry: tengu_ccr_bundle_max_bytes | Emitted when repository bundle exceeds size threshold (bundle.js:+9344655) |
| Telemetry: tengu_review_bughunter_config | Emitted with reviewer configuration details (bundle.js:+7377445) |
| Telemetry: tengu_feature_sad | Emitted on feature-flag check failure (bundle.js:+1018906) |
| Telemetry: tengu_feature_ok | Emitted on feature-flag check success (bundle.js:+1018758) |
| Telemetry: tengu_review_overage_blocked | Emitted when billing overage blocks the command (bundle.js:+12570517) |
| Telemetry: tengu_review_overage_dialog_shown | Emitted when billing overage dialog is displayed (bundle.js:+12570854) |
| Telemetry: tengu_ccr_bundle_seed_enabled | Emitted when seed bundle mode is active (bundle.js:+9438759) |
| Telemetry: tengu_ccr_bundle_upload | Emitted with upload result (success/stash_failed/upload_failed) (bundle.js:+9348032) |
| Telemetry: tengu_teleport_bundle_mode | Emitted with bundle source decision (bundle.js:+9364670) |
| Telemetry: tengu_ccr_session_link | Emitted when session is created with session ID (bundle.js:+9358015) |
| Telemetry: tengu_teleport_source_decision | Emitted with repository source decision (bundle.js:+9370133) |
| Telemetry: tengu_review_remote_teleport_failed | Emitted when the cloud session fails or times out (bundle.js:+12538761) |
| Telemetry: tengu_review_remote_launched | Emitted when session completes successfully (bundle.js:+12539282) |
| Filesystem: Git bundle temp file | Written to temp directory as `ccr-seed*.bundle`, deleted after upload (bundle.js:+9349035, +9349987) |
| Filesystem: Session temp file | Created with `tEK.randomBytes(8)` for session tracking (bundle.js:+13622730) |
| Git refs: seed refs | `refs/seed/stash` and `refs/seed/root` created then deleted during bundle packaging (bundle.js:+9347840, +9347858) |
| Network: Preflight API | `GET /v1/ultrareview/preflight` with `teleport-org` header, timeout 5000 ms |
| Network: Environment list | `GET` environments endpoint, timeout 15000 ms |
| Network: Session creation | `POST` session creation endpoint, `anthropic-beta: ccr-byoc-2025-07-29` |
| Network: Session polling | `GET` session status every 1000 ms, up to 30 minutes |
| appState changes | Reads `allow_remote_sessions` policy; reads auth token and org UUID from app state |
| Sound | Not found in depth-2 traversal |
| Hook registration | Hook events `hook_progress`, `hook_response`, `hook_started` dispatched during polling |

---

## Version History

| Version | Change |
|---|---|
| v2.1.176 | Initial analysis |

---

## Common Mistakes

1. **Running without a Claude.ai OAuth session**: `/ultrareview` explicitly rejects API-key-only authentication. Users must run `/login` and authenticate with a Claude.ai account (not an Anthropic Console API key). Error: `"Ultrareview requires a Claude.ai account. Run /login to authenticate."` (bundle.js:+12531652)

2. **No GitHub remote configured**: The command requires a GitHub remote (`github.com`) on the current repository. Generic git remotes or non-GitHub hosts will fail with `"Cloud agents require a GitHub remote. Add one with git remote add origin REPO_URL."` (bundle.js:+9440471)

3. **Repository has no commits**: If the repository has no commits yet, the bundle phase fails. Users must commit at least one change before invoking the command (bundle.js:+9369562).

4. **Organizational policy disabled**: If an admin has disabled `allow_remote_sessions`, the command exits immediately. Users cannot override this locally; an administrator must change the org policy via `/admin-settings/` (bundle.js:+12570186, +12570639).

5. **Essential-traffic-only network mode**: Running in a restricted network environment that enforces `essential-traffic-only` mode blocks `/ultrareview` entirely, since the agent runs on external Anthropic web infrastructure (bundle.js:+12531336, +12531372).

6. **Expecting fast results**: The expected runtime is `~10–20 min` at `$10–$20`. Users who cancel early (via the cost confirmation dialog) will see `"Ultrareview cancelled."` — there is no partial result.

7. **Repository too large**: Repositories exceeding 5 000 000 KB (~5 GB in object count terms) will be rejected at the bundle-size check phase (bundle.js:+9345181).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `eoL` | Main async handler for `/ultrareview` (Arbor-resolved entry point) |
| `$9` | Remote-sessions policy / allow_remote_sessions gate check |
| `Wg1` | Organization settings reader |
| `AJH` | Settings field accessor combining plan/policy checks |
| `xb` | Plan/tier classifier (firstParty, enterprise, team) |
| `HP6` | File-based settings reader (`readFileSync`, UTF-8) |
| `yLH` | Feature-flag eligibility checker (`allow_product_feedback`) |
| `Aq` | Telemetry / essential-traffic mode resolver |
| `ycA` | Traffic policy evaluator |
| `A6` | String-based config key normalizer |
| `GLH` | String formatter for config values |
| `q` | CLI argument/data vector |
| `u1` | CLI error reporter (console.error + process.exit) |
| `kBH` | Error printer with red color formatting |
| `kX` | File writer for error data (writeFileSync) |
| `H` | Generic utility / random delay helper (Math.random + setTimeout) |
| `k3K` | Command-type flag parser (`fix`, `comment`) |
| `tF8` | Token/word splitter for command arguments |
| `A` | Token/word normalizer (toLowerCase) |
| `L` | Stream/connection lifecycle manager (close, finally) |
| `f` | Active-connection set tracker (add, delete) |
| `tv` | String escape helper (replace `\$&`) |
| `K` | Padding/column formatter for table display |
| `M` | MCP server state manager |
| `LbH` | MCP connection orchestrator (stdio/sse/http/ws-ide transports) |
| `Ho8` | MCP connection result applier (applyMcpUpdate) |
| `N` | Environment/header builder (toUpperCase, debug, name) |
| `$` | Key-permission mapper |
| `vZA` | MCP client list iterator with retry logic |
| `_` | Array/string utility (includes, toUpperCase) |
| `ewA` | Repository context collector (remote URL, branches, diff stats) |
| `rq6` | Git repo detection (`rev-parse --is-inside-work-tree`) |
| `x6` | Git execution wrapper (async shell runner) |
| `bs6` | Async-store context getter |
| `T_` | Event emitter helper |
| `n_` | Git command runner with error propagation |
| `zhH` | Git process spawner with full option set |
| `Y` | Forced-shutdown / abort handler (process.exit + z.abort) |
| `iFf` | Error code string coercer |
| `L5` | Git output line trimmer |
| `E8` | Git error classifier |
| `kH` | Git result parser / error logger |
| `d` | Telemetry event emitter (general) |
| `Pb` | Git remote URL resolver (ncH cache, `remote.origin.url`) |
| `Tl` | Cached remote URL reader |
| `Pt6` | Remote URL cache accessor (`X_H.get`) |
| `icH` | Credential scrubber from URLs (`://***@`) |
| `P_H` | Git remote URL parser (protocol/host/path extraction) |
| `qrA` | URL path parser (includes/split) |
| `P9` | URL component slicer (indexOf/slice) |
| `Vhq` | Repository size checker (`git count-objects -v`) |
| `Zhq` | Count-objects output parser |
| `Ehq` | Cloud-session creation initiator |
| `$6` | Session request builder (W06, G06, em, KXH, eM8, X06, qg, C6) |
| `p8` | Pre-session validation helper |
| `xy` | Default-branch resolver (`symbolic-ref --short refs/remotes/origin/HEAD`) |
| `x4_` | Default-branch cache reader |
| `yj` | Current-branch resolver (`branch --abbrev-ref HEAD`) |
| `C4_` | Current-branch cache reader |
| `O` | Background-session state accessor |
| `m8` | Stopped-session status reader |
| `X6A` | Diff-stat parser (regex match + parseInt) |
| `e_q` | Cost/size display formatter (Number.isFinite, Math.floor) |
| `sbH` | Cost/duration display helper (`$10-$20`, `~10–20 min`) |
| `HYA` | Preflight call orchestrator |
| `h3K` | `/v1/ultrareview/preflight` HTTP caller |
| `c6` | JSON.parse wrapper |
| `awA` | Preflight response status router |
| `n6` | Telemetry emitter: `tengu_feature_sad` |
| `eH` | Telemetry event payload builder |
| `IH` | Telemetry emitter: `tengu_feature_ok` |
| `tbH` | Cost-dialog display helper |
| `kK6` | Overage-check controller |
| `CV` | Billing plan checker |
| `qXH` | Subscription type resolver |
| `rf` | Auth/connection state reader |
| `sw` | App-state composite reader (API key, provider, plan) |
| `C6` | Session record creator (Date.now, ug4) |
| `NA` | Session list accessor |
| `yb` | Array inclusion checker |
| `hS` | Subscription / plan-tier eligibility helper |
| `Mq` | Plan-string classifier (stripe, apple, google_play subscriptions) |
| `aY_` | Stripe subscription type matcher |
| `oY_` | Contracted subscription type matcher |
| `te` | Cost estimate string builder |
| `toL` | Full ultrareview orchestration wrapper |
| `_YA` | Core teleport-to-remote execution function |
| `ETH` | Background eligibility pre-check (`bg_remote_eligibility_check`) |
| `Kyq` | Eligibility-check runner (policy, auth, git, GitHub app) |
| `E` | Parallel task scheduler (Math.max/min) |
| `W` | Sub-task runner (MCP SDK style, kH/JA) |
| `n$H` | Session environment variable injector (`env_011111111111111111111113`) |
| `t_q` | Timeout/cost threshold formatter |
| `qo` | Remote session creator + lifecycle manager (main teleport function) |
| `nf` | Node/process output stream writer |
| `t$` | Token refresh trigger |
| `uS8` | Session creation sub-request helper |
| `Ib` | HTTP response handler (C6, e1, wT, VjH) |
| `F1` | OAuth URL validator (local/staging/prod endpoints) |
| `ID` | HTTP client wrapper (Z0) |
| `OAA` | Git bundle packager and uploader (`teleport_git_bundle_upload`) |
| `S6` | Event/signal emitter helper |
| `K6` | nM6-based node helper |
| `Nhq` | Session control-request sender (set_permission_mode, apply_flag_settings) |
| `zC6` | Session metadata formatter |
| `CH` | JSON.stringify wrapper |
| `vhq` | Session-link telemetry emitter (`tengu_ccr_session_link`) |
| `GS8` | Session status poller |
| `bHH` | Environment-list fetcher (`teleport_environments_list`) |
| `iq6` | Default environment creator (`teleport_default_environment_create`) |
| `TH` | String coercer for session fields |
| `NOL` | Task title generator via `claude/task` model |
| `rS` | Session-request payload builder (W06, G06, em, KXH, IK9) |
| `GmH` | GitHub App installation checker |
| `g1` | UI component renderer (el, j1, yO) |
| `i` | Output write buffer (o.write, P.write, LI5) |
| `JA` | Error message normalizer (Error + String) |
| `Oz` | Cancellation-error classifier |
| `pz` | Error display formatter |
| `SmH` | Session polling loop controller |
| `tI` | Session temp-file creator (randomBytes 8) |
| `pq6` | Session file writer (`i6H.open`) |
| `H0` | Session timestamp recorder |
| `OzL` | Session progress message formatter |
| `$yq` | Session message stream processor (result/hook events) |
| `ZTH` | Session output finalizer |
| `oY` | Output renderer (x_, q, uU_) |
| `soL` | Result-list mapper (`H.map`) |
| `twA` | Post-completion cleanup / teardown |