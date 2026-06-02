---
type: feature-spec
feature: "ultrareview"
cc_version: "2.1.159"
updated: "2026-06-02"
tags: ["ultrareview", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: "2.1.157"
analysis_basis: "CC v2.1.157 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultrareview`

> Analysis basis: CC v2.1.157 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.157

---

## Overview

`/ultrareview` is an alias for `/code-review ultra` that performs deep, verified bug-hunting on the current git branch by launching a remote Claude Code session in the cloud (Claude Code on the web). The command packages the local repository as a git bundle, teleports it to a managed cloud environment, runs the review agent remotely, and streams results back to the local terminal. It is estimated to cost between `$10–$20` USD and takes approximately `~10–20 min` to complete.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultrareview` |
| description | `"Alias of /code-review ultra · ... · Est. cost ... USD · Finds and verifies bugs in your branch. Runs in Claude Code on the web. See ..."` |
| loc_byte | `11952575` |
| loc_byte_end | `11952866` |
| loc_line | `7818` |
| module_id | `Tg1` |
| load_inline | `true` |
| arbor_handler.name | `k45` |
| arbor_handler.fqn | `claude-2.1.157::k45` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.157 bundle.js:+11952575

---

## Input Branching

The command has many distinct pre-flight and execution branches (policy check → org permissions → git state → remote session launch → polling → result streaming). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/ultrareview invoked"]) --> B{remote sessions\nallowed by org policy?}
    B -- No --> B1["Error: Remote sessions are disabled\nby your organization's policy.\nContact your org admin."]
    B -- Yes --> C{telemetry / traffic mode\ncheck}
    C -- essential-traffic-only --> C1["Error: Ultrareview unavailable\nin essential-traffic-only mode"]
    C -- ZDR / data-residency provider --> C2["Error: Ultrareview unavailable\non third-party providers"]
    C -- no OAuth token --> C3["Error: Requires Claude.ai account.\nRun /login to authenticate."]
    C -- OK --> D[Call preflight API\nPOST /v1/ultrareview/preflight\n(timeout 5000 ms)]
    D -- blocked --> D1["Error: Ultrareview unavailable\nfor your organisation"]
    D -- needs-confirm --> D2["Show overage cost dialog\n($10–$20 / ~10–20 min)"]
    D -- proceed --> E
    D2 -- user confirms --> E
    D2 -- user cancels --> E1["Ultrareview cancelled."]
    D -- schema_mismatch --> D3["Log: api_ultrareview_preflight\nschema_mismatch"]
    D -- request_failed --> D4["Log: request_failed"]
    E[Check git eligibility\nbg_remote_eligibility_check] --> F{in git repo?}
    F -- No --> F1["Error: Not in a git repository"]
    F -- Yes --> G{GitHub remote present?}
    G -- No --> G1["Error: Add git remote with\ngit remote add origin REPO_URL"]
    G -- Yes --> H{GitHub App installed?}
    H -- No --> H1["Error: github_app_not_installed"]
    H -- Yes --> I{policy_blocked?}
    I -- Yes --> I1["Error: policy blocked"]
    I -- not_logged_in --> I2["Error: Run /login with Claude.ai\n(not Console)"]
    I -- byoc --> I3["Note: byoc path"]
    I -- OK --> J[Collect git metadata:\ncurrent branch, default branch,\nmerge-base, diff --shortstat]
    J --> K[Build / upload git bundle\nteleport_git_bundle_upload]
    K --> L[Resolve / create cloud environment\nteleportToRemote]
    L -- no environments --> L1["Error: No environments available"]
    L -- env_create needed --> L2[Auto-create default cloud env]
    L --> M[Create remote session\nPOST session with task prompt\n& bundle source]
    M -- 401/403/429 --> M1["Auth / rate-limit error"]
    M -- github_repo_access_denied --> M2["Error: Setup GitHub on claude.ai/code"]
    M -- OK --> N[Poll remote session\nevery 1 000 ms, max 1 800 000 ms\n= 30 min]
    N -- hook_progress/hook_response --> N1[Stream progress to terminal]
    N -- completed --> O[Extract result & display\nto local terminal]
    N -- archived/error --> P["Error: remote session returned an error"]
    N -- timeout --> P2["Error: remote session exceeded 30 minutes"]
    N -- no result --> P3["Error: no review output —\norchestrator may have exited early"]
    O --> Q{--fix flag passed?}
    Q -- Yes --> Q1["Apply findings to local\nworking tree"]
    Q -- No --> Q2([Done])
    Q1 --> Q2
```

---

## Behavioral Spec

### 1. Handler Entry — `ultrareviewHandler` (k45)

The command's async handler is resolved via `module_id` → `Tg1` → `k45`.

```
async function ultrareviewHandler(args, context):
    // 1. Org-level remote-session policy gate
    if not orgPolicyAllowsRemoteSessions(context):
        showError("Remote sessions are disabled by your organization's policy. " +
                  "Contact your organization admin to enable them.")
        return

    // 2. Wait random jitter then proceed (uses Math.random + setTimeout, power ≤ 2)
    await jitter()

    // 3. Parse CLI flags (--fix, --comment, etc.) via flagParser (Ag1/Ik8)
    flags = parseFlagsFromArgs(args)   // e.g. "fix", "comment"

    // 4. Run preflight checks (FHA) — see §2
    preflightResult = await runPreflight(context, flags)
    if preflightResult is cancellation or fatal error:
        return

    // 5. Build bughunter config (gHA/eF1) — see §3
    config = await buildBughunterConfig(context)

    // 6. Render JSX UI card with cost/time estimate (QeH)
    renderReviewCard(config)

    // 7. Launch remote task (sb / S6) — see §4
    taskResult = await launchRemoteTask(context, config, flags)

    // 8. Drive remote session (N45/QHA) — see §5
    result = await driveRemoteSession(taskResult, context)

    // 9. If --fix: apply findings locally (BHA)
    if flags.fix:
        applyFindingsToWorkingTree(result)
```

Analysis basis: CC v2.1.157 bundle.js:+11950230

---

### 2. Pre-flight Checks — `runPreflight` (FHA)

```
async function runPreflight(context, flags):
    // 2a. Acquire session / org store (h6, Q28/G_)
    session = getSessionStore()
    orgId   = getOrgId(session)

    // 2b. Telemetry / traffic-mode guard
    trafficMode = getTrafficMode()                // reads "essential-traffic" / "no-telemetry"
    if trafficMode == "essential-traffic-only":
        emit tengu_review_remote_precondition_failed
        showError("Ultrareview runs in Claude Code on the web and is unavailable " +
                  "when essential-traffic-only mode is active.")
        return FATAL

    // 2c. ZDR / data-residency guard
    if provider in ["zdr", "data-residency", "data_residency"]:
        showError("Ultrareview runs in Claude Code on the web and is unavailable " +
                  "on third-party providers.")
        return FATAL

    // 2d. OAuth token guard
    if not hasOAuthToken(session):
        showError("Ultrareview requires a Claude.ai account. Run /login to authenticate.")
        return FATAL

    // 2e. Preflight API call
    response = await httpGet("/v1/ultrareview/preflight", {
        headers: { "teleport-org": orgId },
        timeout: 5000
    })

    // 2f. Interpret preflight response status
    switch response.status:
        "blocked":
            showError("Ultrareview is unavailable for your organization.")
            return FATAL
        "needs-confirm":
            emit tengu_review_overage_dialog_shown
            confirmed = await showCostDialog("$10-$20", "~10–20 min")
            if not confirmed:
                showMessage("Ultrareview cancelled.")
                return CANCEL
        "proceed":
            pass   // continue
        schema_mismatch:
            logEvent("api_ultrareview_preflight", { result: "schema_mismatch" })
        request_failed:
            logEvent("api_ultrareview_preflight", { result: "request_failed" })

    // 2g. Resolve git remote URL (aS)
    //     runs: git config --get remote.origin.url
    //     scrubs credentials: replaces "://***@" pattern
    remoteUrl = await getGitRemoteUrl()
    if not remoteUrl:
        showError("No git remote URL found")
        return FATAL

    // 2h. Resolve default branch (XN)
    //     runs: git symbolic-ref --short refs/remotes/origin/HEAD
    //     fallback tries "main" then "master" then git show-ref
    defaultBranch = await resolveDefaultBranch()

    // 2i. Resolve current branch (cD)
    //     runs: git branch --abbrev-ref HEAD
    currentBranch = await resolveCurrentBranch()

    // 2j. Compute merge-base
    //     runs: git merge-base <defaultBranch> HEAD
    mergeBase = await computeMergeBase(defaultBranch)

    // 2k. Compute diff stats
    //     runs: git diff --shortstat <mergeBase>
    diffStats = await computeDiffStats(mergeBase)

    return { remoteUrl, defaultBranch, currentBranch, mergeBase, diffStats }
```

Analysis basis: CC v2.1.157 bundle.js:+11913017 (Q28), +11913174 (FHA/h6), +11913320 (aS), +11914158 (SK1), +11914686 (XN), +11914707 (cD), +11914741 (merge-base), +11915248 (diff)

---

### 3. Bughunter Config Assembly — `buildBughunterConfig` (gHA / eF1)

```
async function buildBughunterConfig(context):
    // Reads persisted config from store (U9.get)
    stored = configStore.get()

    // Calls POST /v1/ultrareview/preflight indirectly for server config
    // Interprets response flags:
    //   "proceed"       → go
    //   "server"        → show "unavailable for your organisation"
    //   "needs-confirm" → show cost/time dialog

    emit tengu_review_bughunter_config

    config = {
        costEstimate:    "$10-$20",
        timeEstimate:    "~10–20 min",
        reviewType:      "ultrareview",
        taskEnvId:       "env_011111111111111111111113",   // well-known test env id
        workerCountMin:  5,
        workerCountMax:  20,
        workerTimeout:   600,          // seconds
        sessionTimeout:  1800,         // seconds
        // additional thresholds: 25, 22, 27
    }

    // Render JSX card showing cost and type
    renderCard(config)

    return config
```

Analysis basis: CC v2.1.157 bundle.js:+11915640 (eF1), +11910717 (tengu_review_bughunter_config), +11911369 (/v1/ultrareview/preflight), +11910834 ($10-$20), +11910926 (~10–20 min), +11917039 (env id), +11917273–11917478 (numeric thresholds)

---

### 4. Remote Task Launch — `launchRemoteTask` (sb / S6)

```
async function launchRemoteTask(context, config, flags):
    // 4a. Check subscription tier (WA/EY)
    //     Accepted subscription types: stripe_subscription,
    //     stripe_subscription_contracted, apple_subscription,
    //     google_play_subscription
    //     Accepted plan tiers: max, pro
    //     Accepted org roles: admin, billing, owner, primary_owner
    subscriptionOk = checkSubscription(session)

    // 4b. Check API key env — rejects ANTHROPIC_API_KEY / apiKeyHelper paths

    // 4c. Run git eligibility check (D41 — bg_remote_eligibility_check)
    eligibility = await checkGitEligibility():
        // Runs: git rev-parse --is-inside-work-tree
        // Runs: git count-objects -v  → checks size ≤ 5 000 000 (KB × 1024)
        // Checks GitHub remote is present
        // Checks GitHub App is installed (YhH — GET to /teleport/environments endpoint)
        //   needs access token + org UUID; 15 000 ms timeout
        // Returns one of: policy_blocked, not_logged_in, byoc, not_in_git_repo,
        //   no_git_remote, github_app_not_installed, or OK

    if eligibility != OK:
        emit tengu_review_remote_precondition_failed
        showError(eligibility.message)
        return FATAL

    // 4d. Upload git bundle (YB_ — teleport_git_bundle_upload)
    //     Strategies (in order): head, fallback_head, squashed, fallback_squashed
    //     Writes: ccr-seed<rand>.bundle, then _source_seed.bundle
    //     Checks repo size ≤ 5 000 000 bytes before upload
    //     Sends beta header: ccr-byoc-2025-07-29
    //     org UUID sent as x-organization-uuid
    bundleResult = await uploadGitBundle(context)
    emit tengu_ccr_bundle_upload
    emit tengu_teleport_bundle_mode   // records "bundle"/"explicit_env_bundle"/"git_repository"

    // 4e. Resolve or create cloud environment (Nl — teleportToRemote)
    environment = await resolveOrCreateEnvironment():
        // Lists environments (oa — teleport_environments_list)
        //   GET with 15 000 ms timeout
        // If none exist, auto-creates default (YeH — teleport_default_environment_create)
        //   Default env: name="Default", home="/home/user",
        //                python="3.11", node="20", type="anthropic_cloud"
        // Selects "bridge" type preferred; falls back
        // If source config restricted: "source repository configuration is not permitted"

    // 4f. Submit task session (Nl continuation)
    //     POST with task prompt (75-char description), JSON schema, title generation
    //     Response must include session id; on missing: fatal error
    //     HTTP error codes handled: 500 → generic, 201 → OK,
    //       401/403/429 → auth/rate-limit, 400 → bad request
    session = await createRemoteSession(environment, config, bundleResult)

    emit tengu_ccr_bundle_seed_enabled  (if seed path used)
    emit tengu_teleport_source_decision

    return session
```

Analysis basis: CC v2.1.157 bundle.js:+8937184 (D41), +8850020 (tengu_ccr_bundle_max_bytes), +8853397 (tengu_ccr_bundle_upload), +8868745 (tengu_teleport_bundle_mode), +8821055 (oa), +8821858 (YeH), +8869569 (c_.post session), +8850546 (5 000 000 limit), +8850527 (100 KB threshold), +8856392 (75-char task)

---

### 5. Remote Session Polling and Result Delivery — `driveRemoteSession` (N45 / QHA)

```
async function driveRemoteSession(sessionHandle, context):
    // 5a. Register session link for UI (RK1 — tengu_ccr_session_link)
    registerSessionLink(sessionHandle.id)
    emit tengu_ccr_session_link

    // 5b. Initialise remote agent watcher (VhH)
    //     Generates 8-byte random token (Fk — S_K.randomBytes(8))
    //     Records session start time (Date.now)

    // 5c. Poll loop (X41)
    //     Interval: 1 000 ms
    //     Hard timeout: 1 800 000 ms (30 min)
    loop:
        response = pollSession(sessionHandle)

        switch response.status:
            "starting" | "idle" | "hook_started":
                renderProgressIndicator()
                continue
            "running":
                renderProgressIndicator()
                continue
            "hook_progress" | "hook_response":
                streamProgressToTerminal(response.data)
                continue
            "SessionStart":
                recordSessionStart()
                continue
            "completed":
                extractResult(response)
                break
            "archived":
                break
            "result":
                storeResult(response.data)
                break
            error / timeout:
                handleError()
                break

    // 5d. Error cases
    if timeout:
        showError("remote session exceeded 30 minutes")
        emit tengu_review_remote_teleport_failed
        return
    if no result message:
        showError("no review output — orchestrator may have exited early")
        return

    // 5e. Display final result
    //     Uses ds/w_6 helper to render findings
    //     Outputs "Background task" label with session URL (/ultrareview path)
    renderFindings(result)
    emit tengu_review_remote_launched

    // 5f. Render JSX summary card (yXH/jw)
    renderSummaryCard(result)

    return result
```

Analysis basis: CC v2.1.157 bundle.js:+11916262 (IXH/D41), +8944008 (VhH), +8945689 (1 000 ms interval), +8945696 (1 800 000 ms timeout), +8946886 (hook_progress), +8947496 (SessionStart), +8948297 (error message), +8948338 (30-min message), +8948375 (no output message), +11919051 (tengu_review_remote_launched), +11918700 (/ultrareview)

---

### 6. Flag Parsing — `parseFlagsFromArgs` (Ag1 / Ik8)

```
function parseFlagsFromArgs(rawArgs):
    // Trims input, splits on whitespace
    parts = rawArgs.trim().split()

    result = {}
    for part in parts:
        key = part.toLowerCase().replace(regex, "")
        // Recognised flags: "fix", "comment"
        // Aliases: "/code-review ultra" is the canonical form
        result[key] = true

    return result
```

Analysis basis: CC v2.1.157 bundle.js:+11912893 (Ik8), +11912900 ("fix"), +11912906 ("comment"), +11912985 ("/code-review ultra")

---

### 7. Policy / Overage Guard — `checkOrgPolicy` (N9 / gR)

```
function checkOrgPolicy(context):
    // Reads "allow_remote_sessions" flag from org config
    allowed = orgConfig.get("allow_remote_sessions")

    // Checks "firstParty" status (literal value 1 = true)
    isFirstParty = config.firstParty == 1

    // Checks "allow_product_feedback" flag
    feedbackAllowed = orgConfig.get("allow_product_feedback")

    // Checks membership tiers: "enterprise", "team"
    // Reads org config file via c89.readFileSync (utf-8)

    if not allowed:
        emit tengu_review_remote_precondition_failed
        return false
    return true
```

Analysis basis: CC v2.1.157 bundle.js:+11950233 ("allow_remote_sessions"), +4107103 ("firstParty"), +4107376 ("enterprise"), +4107411 ("team"), +4107484 ("utf-8"), +4107652 ("allow_product_feedback")

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_review_remote_precondition_failed` | Fired on any pre-flight gate rejection (policy, traffic mode, ZDR, no OAuth) |
| Telemetry — `tengu_review_bughunter_config` | Fired when bughunter config object is assembled |
| Telemetry — `tengu_review_overage_blocked` | Fired when overage cost gate blocks launch |
| Telemetry — `tengu_review_overage_dialog_shown` | Fired when cost confirmation dialog is shown |
| Telemetry — `tengu_ccr_bundle_max_bytes` | Fired when bundle size is measured |
| Telemetry — `tengu_ccr_bundle_upload` | Fired after git bundle upload attempt |
| Telemetry — `tengu_ccr_bundle_seed_enabled` | Fired when seed bundle path is selected |
| Telemetry — `tengu_teleport_bundle_mode` | Fired with bundle mode decision ("bundle" / "explicit_env_bundle" / "git_repository") |
| Telemetry — `tengu_ccr_session_link` | Fired when remote session ID is registered for UI |
| Telemetry — `tengu_teleport_source_decision` | Fired with source type resolution |
| Telemetry — `tengu_review_remote_teleport_failed` | Fired on fatal remote session launch failure or timeout |
| Telemetry — `tengu_review_remote_launched` | Fired on successful session completion |
| Telemetry — `tengu_bg_spare_enable` / `tengu_bg_spare_spawn` | Background spare session management (side effect of environment pool) |
| Telemetry — `tengu_daemon_config_reload` | Fired when supervisor daemon config is reloaded |
| Telemetry — `tengu_feature_ok` / `tengu_feature_sad` | Feature flag health reporting |
| Git bundle files | Writes temporary files `ccr-seed<n>.bundle` and `_source_seed.bundle`; cleaned up after upload via `XeH.unlink` |
| Remote session | Creates a persistent cloud session under the user's Claude.ai org; session may outlive the local CLI process |
| `appState` changes | Supervisor heartbeat updated; remote-control-at-startup flag may be set/unset |
| Preflight API | `POST /v1/ultrareview/preflight` with `teleport-org` header, 5 000 ms timeout |
| Environment creation | May auto-create a "Default" cloud environment at `claude.ai/code/onboarding?magic=env-setup` |
| `--fix` side effect | Applies remote findings directly to local working tree files |

---

## Version History

| Version | Change |
|---|---|
| v2.1.157 | Initial analysis. Command registered as `local-jsx` alias for `/code-review ultra`; remote cloud execution via Teleport infrastructure; beta header `ccr-byoc-2025-07-29` |

---

## Common Mistakes

1. **Running without a GitHub remote** — The command requires a GitHub remote (`git remote add origin REPO_URL`). Plain git repos or repos with non-GitHub remotes are rejected at the eligibility check.
2. **Using API key authentication** — `/ultrareview` requires a Claude.ai OAuth account. Authenticating with `ANTHROPIC_API_KEY` or a Console account is explicitly rejected; use `/login` first.
3. **Running in essential-traffic-only mode** — Organisations with network policies that restrict traffic to essential services will block this command entirely.
4. **Running in a zero-data-residency (ZDR) or third-party-provider environment** — The command is only available on Anthropic's own cloud infrastructure.
5. **Repository too large** — Repositories whose git bundle exceeds 5 000 000 bytes will be rejected during bundle upload.
6. **Empty repository** — Repos with no commits are caught early; commit at least one change before invoking `/ultrareview`.
7. **Cancelling mid-flight** — Cancelling after the remote session is submitted does not automatically terminate the cloud session; the session may continue to run and consume credits.
8. **Ignoring the cost dialog** — Confirming the `$10–$20` cost dialog is required; dismissing it cancels the command without error feedback beyond "Ultrareview cancelled."

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `k45` | Main `ultrareviewHandler` async entry point (Arbor handler) |
| `N9` | Org policy / remote-session permission checker |
| `n89` | Inner policy evaluation helper |
| `Dw6` | Policy config reader (file + flags) |
| `gR` | firstParty / product-feedback flag evaluator |
| `Yw6` | Config file reader (`readFileSync`, utf-8) |
| `c4H` | Membership tier checker ("enterprise", "team") |
| `L1` | Telemetry mode resolver |
| `fVA` | Traffic-mode string normaliser |
| `CH` | String coercion utility |
| `gKH` | Alternate string coercion helper |
| `H` | Jitter / random delay generator (`Math.random` + `setTimeout`) |
| `Ag1` | Flag-parsing entry point for CLI args |
| `Ik8` | Flag tokeniser (trim / split / replace) |
| `$N` | Regex escape helper |
| `K` | Column-pad utility |
| `M` | Path-resolution / file-cleanup utility |
| `cS6` | Canonical path resolver (join / relative / isAbsolute) |
| `FHA` | Pre-flight orchestrator |
| `Q28` | Git work-tree verifier (`git rev-parse --is-inside-work-tree`) |
| `h6` | Session / async-context store accessor |
| `lB6` | Store getter with `getStore` |
| `O_` | Auth/session resolver |
| `G_` | HTTP client / API session builder |
| `RGH` | HTTP request executor with retry/reject logic |
| `D` | Background spare session pool manager |
| `lq4` | String coercion wrapper |
| `kz` | Cancellation token / signal helper |
| `N` | Log-level / debug message emitter |
| `j8` | JSON serialiser utility |
| `SH` | Error logger / error reporter |
| `d` | Telemetry event emitter |
| `aS` | Git remote URL resolver (`git config --get remote.origin.url`) |
| `Fb` | Remote URL cache accessor |
| `Br8` | Remote URL cache getter (`K1H.get("remoteUrl")`) |
| `SpH` | Credential scrubber (replaces `://***@` pattern) |
| `Ge` | Git URL parser / protocol detector |
| `ukA` | URL component splitter |
| `nq` | URL slice helper (indexOf / slice) |
| `SK1` | Git repo size checker (`git count-objects -v`) |
| `hK1` | Git object-count parser / KB→byte converter (× 1024) |
| `yK1` | Bundle size threshold enforcer (≤ 5 000 000) |
| `G6` | Remote session state-machine / task scheduler |
| `v8` | API HTTP session factory |
| `Y` | Supervisor / daemon lifecycle manager |
| `u2H` | Supervisor config writer (ENOENT handling) |
| `s9` | Async store reader (`$J7.getStore`) |
| `TAA` | Supervisor config assembler |
| `EH` | String coercion (error message formatting) |
| `Re1` | Config key max-length calculator |
| `G` | Keyboard / input interceptor (`preventDefault`) |
| `h0` | User-settings accessor (`userSettings`) |
| `E` | Supervisor process controller (stop/updateConfig/start) |
| `FVK` | Heartbeat scheduler |
| `oHH` | Heartbeat payload builder |
| `V` | Secondary process controller |
| `XN` | Default-branch resolver (`git symbolic-ref --short refs/remotes/origin/HEAD`) |
| `Fr8` | Default-branch cache getter (`K1H.get("defaultBranch")`) |
| `cD` | Current-branch resolver (`git branch --abbrev-ref HEAD`) |
| `pr8` | Current-branch cache getter (`K1H.get("branch")`) |
| `O` | Background-session status checker ("stopped" / "background session") |
| `k8` | Background-session state reader |
| `gHA` | Bughunter-config builder entry |
| `eF1` | Bughunter-config assembler (reads store, calls preflight) |
| `p6` | JSON.parse wrapper |
| `pHA` | Preflight-response interpreter |
| `t6` | Feature-ok telemetry emitter |
| `hH` | Feature-sad telemetry emitter |
| `qCH` | JSX review-card renderer |
| `w_6` | Core JSX card component (`G6` child) |
| `QeH` | JSX UI card with cost/time display |
| `kZ` | UI layout helper |
| `gzH` | Subscription-type checker |
| `_7` | Plan-tier resolver |
| `EY` | Auth / API-key environment checker |
| `S6` | Task submission / session-creation state machine |
| `WA` | Subscription gate wrapper |
| `YR` | Array/string membership tester |
| `sb` | Remote-task launcher (subscription + session submit) |
| `f1` | Session-creation caller |
| `Yq_` | Session request builder |
| `zq_` | Session payload serialiser |
| `ds` | Result-display helper (renders findings card via `w_6`) |
| `N45` | Remote-session driver entry point |
| `QHA` | Remote-session lifecycle manager |
| `IXH` | Git eligibility check dispatcher |
| `D41` | Git eligibility checker (`bg_remote_eligibility_check`) |
| `W5H` | Worker-count / timeout config resolver |
| `sF1` | Worker-count JSX renderer |
| `Nl` | Teleport-to-remote orchestrator (env list + session create) |
| `kO` | Cancellation-signal factory |
| `XB_` | Environment-selection filter |
| `tb` | Session-submission helper |
| `Iq` | OAuth endpoint validator (local/staging/prod) |
| `ZX` | HTTP `Content-Type` / version header builder |
| `YB_` | Git bundle upload executor (`teleport_git_bundle_upload`) |
| `k6` | Auth-header assembler |
| `CK1` | Control-request / permission-mode event builder |
| `RH` | `JSON.stringify` wrapper |
| `RK1` | Session-link registrar (`tengu_ccr_session_link`) |
| `oa` | Environment-list fetcher (`teleport_environments_list`) |
| `YeH` | Default-environment creator (`teleport_default_environment_create`) |
| `BTL` | Task-title generator (`teleport_generate_title`, 75-char cap) |
| `Ry` | Session-state-machine updater |
| `YhH` | GitHub-app-installed checker (GET environments) |
| `J9` | UI text formatter |
| `c` | Provider / source URL classifier |
| `F_` | Error-type classifier (AbortError / isAxiosError) |
| `sj` | Cancel-signal tester |
| `Iz` | Error message extractor |
| `VhH` | Remote-agent session watcher entry |
| `Fk` | Random token generator (`S_K.randomBytes(8)`) |
| `KeH` | Session file opener |
| `Z2` | Session timestamp recorder |
| `WZL` | Session-link string builder |
| `X41` | Poll-loop executor (1 000 ms / 1 800 000 ms) |
| `yXH` | JSX summary card renderer |
| `jw` | Summary card component |
| `v45` | Result-item mapper |
| `BHA` | Local working-tree patch applicator (--fix path) |

---

*Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.*