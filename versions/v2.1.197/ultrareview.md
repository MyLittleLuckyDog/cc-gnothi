---
type: feature-spec
feature: "ultrareview"
cc_version: "2.1.197"
updated: "2026-07-01"
tags: ["ultrareview", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.197 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultrareview`

> Analysis basis: CC v2.1.197 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.197

---

## Overview

`/ultrareview` launches a cloud-hosted agent session on Claude Code for the web that performs deep, automated bug-finding and verification across the current Git branch. The command runs a multi-phase preflight sequence — checking authentication, repository state, GitHub connectivity, PR diff size, and spend authorization — before creating a remote session and streaming results back to the local CLI. Estimated cost is in the $10–$20 USD range with a runtime of approximately 10–20 minutes.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultrareview` |
| description | `"Start a cloud agent that finds and verifies bugs in your branch ( … , … USD) · Runs in Claude Code on the web. See …"` |
| module_id | `h7l` |
| load_inline | `true` |
| loc_byte | `12662989` |
| loc_byte_end | `12663259` |
| loc_line | `8595` |
| arbor_handler.name | `Xqf` |
| arbor_handler.fqn | `claude-2.1.197::Xqf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.197 bundle.js:+12662989

---

## Input Branching

The handler follows eight or more distinct exit paths before any cloud session is created, making a Mermaid flowchart the appropriate representation.

```mermaid
flowchart TD
    A(["/ultrareview invoked"]) --> B{allow_remote_sessions\npolicy enabled?}
    B -- No --> B1["Emit: tengu_review_remote_precondition_failed\nReason: allow_remote_sessions\nAbort with 'Cloud sessions' message"]
    B -- Yes --> C{Essential-traffic-only\nmode active?}
    C -- Yes --> C1["Abort: essential-traffic-only\n'Ultrareview unavailable' message"]
    C -- No --> D{Third-party or data-residency\nprovider?}
    D -- Yes --> D1["Abort: data_residency /\nthird_party provider message"]
    D -- No --> E{OAuth token present?\n(no-auth check)}
    E -- No --> E1["Abort: no_oauth_token\n'Run /login' message"]
    E -- Yes --> F["Call preflight API\n/v1/ultrareview/preflight"]
    F --> G{Preflight result?}
    G -- blocked --> G1["Emit: tengu_review_overage_blocked\nAbort"]
    G -- needs-confirm --> G2["Show overage dialog\nEmit: tengu_review_overage_dialog_shown\nAwait user confirmation"]
    G -- schema_mismatch --> G3["Abort: schema_mismatch"]
    G -- request_failed --> G4["Abort: request_failed"]
    G -- proceed / confirm --> H["Run local git checks\n(branch, remote, PR diff)"]
    G2 -- confirmed --> H
    H --> I{Inside git repo?}
    I -- No --> I1["Abort: not_git_repo"]
    I -- Yes --> J{GitHub remote\ndetected?}
    J -- No --> J1["Abort: no_github_remote"]
    J -- Yes --> K{Anthropic-owned\nmonorepo?}
    K -- Yes --> K1["Abort: monorepo_blocked"]
    K -- No --> L["Fetch PR diff stats via gh CLI\n(additions, deletions, changedFiles)"]
    L --> M{PR diff too large?\n(threshold check)}
    M -- Yes --> M1["Abort: pr_diff_too_large"]
    M -- No --> N{Local diff empty?}
    N -- Yes --> N1["Abort: empty_diff"]
    N -- No --> O{Local diff too large?}
    O -- Yes --> O1["Abort: local_diff_too_large"]
    O -- No --> P["Check repo bundle size\n(git count-objects -v)"]
    P --> Q{Repo > 5 000 000 objects?}
    Q -- Yes --> Q1["Abort: repo_too_large_to_bundle"]
    Q -- No --> R["Check merge-base with base branch"]
    R --> S{Merge-base found?}
    S -- No --> S1["Abort: no_merge_base"]
    S -- Yes --> T["Launch remote session\n(teleport flow → SW handler)"]
    T --> U{Session created?}
    U -- Fail --> U1["Emit: tengu_review_remote_teleport_failed\n'Ultrareview failed to launch' message"]
    U -- Success --> V["Emit: tengu_review_remote_launched\nPoll session / stream output\n(remote-workflow loop)"]
    V --> W["Display results or\n'Ultrareview cancelled.' on abort"]
```

---

## Behavioral Spec

### Phase 0 — Policy and authentication gate (handler: `Xqf`)

```
async function ultrareviewHandler(args, context):
    # Step 1: Check remote-sessions policy flag
    if not settingEnabled("allow_remote_sessions"):
        emitTelemetry("tengu_review_remote_precondition_failed",
                       {reason: "allow_remote_sessions"})
        return error("Cloud sessions" + policyMessage)

    # Step 2: Check network-mode restrictions
    networkMode = resolveNetworkMode()          # checks essential-traffic-only
    if networkMode == "essential-traffic-only":
        return error("Ultrareview runs in Claude Code on the web and is"
                     " unavailable when essential-traffic-only mode is active.")

    # Step 3: Check provider class
    provider = getProviderClassification()     # firstParty / third_party_provider
    if provider in ["third_party_provider", "custom_base_url"]:
        return error("Ultrareview runs in Claude Code on the web and is"
                     " unavailable on third-party providers.")
    if providerIsDataResidency():
        return error(dataResidencyMessage)

    # Step 4: Require OAuth token
    if authMode == "no_auth" or oauthToken == null:
        return error("Ultrareview requires a Claude.ai account."
                     " Run /login to authenticate.")
```

Analysis basis: CC v2.1.197 bundle.js:+12660466

---

### Phase 1 — Preflight API call (`Qzl`)

```
async function callUltrareviewPreflight(context):
    response = await httpGet("/v1/ultrareview/preflight",
                              headers: {"teleport-org": orgUuid})

    emitTelemetry("api_ultrareview_preflight", {result: response.result})

    match response.result:
        case "blocked":
            emitTelemetry("tengu_review_overage_blocked")
            return ABORT

        case "needs-confirm":
            # Show cost-confirmation dialog to user
            # Estimated cost: "$10-$20", runtime: "~10–20 min"
            emitTelemetry("tengu_review_overage_dialog_shown")
            confirmed = await awaitUserConfirmation()
            if not confirmed:
                return ABORT

        case "schema_mismatch":
            return ABORT(reason="schema_mismatch")

        case "request_failed":
            return ABORT(reason="request_failed")

        case "proceed" | "confirm" | "server":
            if response.result == "server" and serverMessage != null:
                return error("Ultrareview is unavailable for your organization.")
            # Fall through to git checks

    # Check post-confirm GitHub remote condition
    if confirmedAndNoGithubRemote:
        emitTelemetry("tengu_review_remote_precondition_failed",
                       {reason: "no_github_remote_post_confirm"})
```

Analysis basis: CC v2.1.197 bundle.js:+12620096 (preflight URL: `+12620171`)

---

### Phase 2 — Git repository checks (`w4o`, `sar`)

```
function checkGitPreconditions(workdir, args):
    # Determine fix/comment mode from CLI flags
    mode = args.includes("fix") ? "fix" : "comment"
    # Note: "/code-review ultra" is an alias path
    # (literal found at +12622087)

    # 2a. Verify git repo presence
    result = git("rev-parse", "--is-inside-work-tree")
    if failed:
        emitTelemetry("tengu_review_remote_precondition_failed",
                       {reason: "not_git_repo"})
        return ABORT

    # 2b. Retrieve and normalize remote URL
    remoteUrl = git("config", "--get", "remote.origin.url")
    if remoteUrl == null:
        return ABORT(reason="no_github_remote")
    # Scrub credentials: replace "://***@" pattern
    remoteUrl = sanitizeCredentials(remoteUrl)

    # 2c. Parse hostname (strips "www.", validates github.com)
    hostname = parseHostname(remoteUrl)   # Mvs, Nm helpers
    if not hostname.includes("github.com"):
        emitTelemetry("tengu_review_remote_precondition_failed",
                       {reason: "no_github_remote"})
        return ABORT

    # 2d. Block Anthropic internal monorepos
    orgName = extractOrgFromRemote(remoteUrl)
    if orgName in ["anthropics", "anthropic"]:
        emitTelemetry("tengu_review_remote_precondition_failed",
                       {reason: "monorepo_blocked"})
        return ABORT
```

Analysis basis: CC v2.1.197 bundle.js:+12660588

---

### Phase 3 — PR diff and size checks (`Pn`, `bLo`, `Ezn`)

```
function checkDiffSizes(repoPath, baseBranch):
    # 3a. Fetch PR diff statistics via GitHub CLI
    ghOutput = exec("gh", "pr", "view", "--repo", repoUrl,
                    "--json", "additions,deletions,changedFiles")
    # Timeout: 5000 ms (literal at +12623384)

    prStats = JSON.parse(ghOutput)
    totalLines = prStats.additions + prStats.deletions
    # Threshold encoded via bLo/Fqe:
    #   poll interval: 500 ms (+9236903)
    #   max poll duration: 8000 ms (+9236937)
    if prStats too large (internal limit):
        emitTelemetry("tengu_review_remote_precondition_failed",
                       {reason: "pr_diff_too_large"})
        return ABORT

    # 3b. Git count-objects to estimate repo size
    countOutput = git("count-objects", "-v")
    repoBytes = parseCountObjects(countOutput)
    emitTelemetry("tengu_ccr_bundle_max_bytes", {bytes: repoBytes})
    # Limit: 5 000 000 (literal at +8881428)
    if repoBytes > 5000000:
        return ABORT(reason="repo_too_large_to_bundle")

    # 3c. Local diff (merge-base to HEAD)
    baseRef = resolveBaseRef()    # KM / hy: symbolic-ref, show-ref, main/master fallback
    mergeBase = git("merge-base", baseRef, "HEAD")
    if not mergeBase:
        return ABORT(reason="no_merge_base")

    localDiff = git("diff", "--shortstat", mergeBase, "HEAD")
    if localDiff == "":
        return ABORT(reason="empty_diff")

    # Parse "+N insertions, -M deletions" pattern (Ezn helper: parseInt)
    lineCount = parseShortstat(localDiff)
    if lineCount > localDiffLimit:
        return ABORT(reason="local_diff_too_large")
```

Analysis basis: CC v2.1.197 bundle.js:+12622868, +12623265, +12624615, +12624636, +12625528

---

### Phase 4 — Eligibility check and remote session launch (`OFa`, `SW`, `ivo`)

```
async function launchRemoteSession(context, sessionParams):
    # 4a. Background eligibility check (OFa)
    eligibility = await checkRemoteEligibility(context)
    # Reports reasons: policy_blocked, not_logged_in, byoc,
    #                  not_in_git_repo, no_git_remote, github_app_not_installed
    emitTelemetry("bg_remote_eligibility_check", eligibility)

    # 4b. Environment resolution (voe / _mt)
    #   - Lists remote environments via GET
    #   - Auto-creates default env if none found
    #   - Requires first-party provider; BYOC skips preflight
    env = await resolveCloudEnvironment(context)
    if not env:
        return ABORT(reason="no_environments")

    # 4c. Session creation (SW handler)
    sessionPayload = buildSessionPayload(
        task:        buildUltrareviewTaskPrompt(repoInfo, diffStats, mode),
        environment: env,
        bundleMode:  decideBundleMode(),   # "github" | "bundle" | "explicit_env_bundle"
        remoteUrl:   remoteUrl,
    )

    response = await httpPost("/v1/sessions", sessionPayload,
                               headers: {"x-organization-uuid": orgUuid,
                                         "anthropic-beta": betaHeader})

    if response.status in [401, 403]:
        return ABORT(reason="github_repo_access_denied")
    if response.status != 201:
        return ABORT(reason="create_request_failed")
    if not response.sessionId:
        return ABORT(reason="malformed_response",
                     message: "Server returned a malformed session response (no session id)")

    emitTelemetry("tengu_review_remote_launched", {sessionId: response.sessionId})
```

Analysis basis: CC v2.1.197 bundle.js:+12660683, +12629882, +8901274

---

### Phase 5 — Git bundle upload (`ivo` / `teleport_git_bundle_upload`)

When the bundle mode is not pure-GitHub (e.g., GitHub App not installed or `CCR_FORCE_BUNDLE` is set), the handler creates and uploads a local git bundle:

```
async function uploadGitBundle(workdir, sessionId):
    emitTelemetry("tengu_ccr_bundle_upload", {phase: "start"})

    # Stash uncommitted work into a temporary ref
    stashRef = "refs/seed/stash"
    rootRef  = "refs/seed/root"
    git("update-ref", "-d", stashRef)
    git("for-each-ref", "--count=1", "refs/")

    stashResult = git("stash", "create")
    if stashResult.status != 200:
        return ABORT(reason="stash_failed")

    # Create bundle file: "ccr-seed-<uuid>.bundle"
    bundlePath = tmpdir + "/ccr-seed-" + randomUUID() + ".bundle"
    git("bundle", "create", bundlePath, ...)

    # Upload bundle via signed URL
    uploadResult = await uploadBundleFile(bundlePath, sessionId)
    # Strategies: head, fallback_head, squashed, fallback_squashed

    if uploadResult.status == "failed":
        emitTelemetry("tengu_ccr_bundle_upload", {result: "upload_failed"})
        cleanup(bundlePath)    # LHt.unlink
        return ABORT(reason="upload_failed")

    emitTelemetry("tengu_ccr_bundle_upload", {result: "success"})
    cleanup(bundlePath)
```

Analysis basis: CC v2.1.197 bundle.js:+8883984, +8884306

---

### Phase 6 — Session polling loop (`Tol` / `YAe`)

```
async function pollRemoteSession(sessionId, context):
    # Poll interval: 1000 ms (+8924331)
    # Max duration:  1 800 000 ms / 30 minutes (+8924338)

    emitTelemetry("remote_agent", {sessionId})

    loop:
        sessionState = await pollSessionStatus(sessionId)

        match sessionState.status:
            case "pending" | "starting" | "running" | "idle":
                # Display hook_progress / hook_started events to user
                await sleep(POLL_INTERVAL)
                continue

            case "completed" | "archived":
                result = extractReviewOutput(sessionState)
                if result == null:
                    return ABORT(reason="no_review_output")
                displayResults(result)
                emitTelemetry("tengu_review_remote_launched", {outcome: "completed"})
                return SUCCESS

            case "orchestrator_error" | "session_error":
                return ABORT(reason=sessionState.status)

            case TIMEOUT:
                if hadApiError:
                    return ABORT(reason="poll_timeout_after_api_error")
                return ABORT(reason="poll_timeout")

    # On SIGINT / abort signal
    display("Ultrareview cancelled.")
```

Analysis basis: CC v2.1.197 bundle.js:+8922650, +8924331, +8924338, +12661347

---

### `--fix` flag behavior

When the user invokes `/ultrareview --fix` (or the `fix` literal is detected in args at `+12622002`), the handler appends an instruction to the session task prompt indicating that findings should be applied to the local working tree upon completion. The literal found is:

> `" The user passed --fix: when the findings arrive, apply them to the local working tree."` (bundle.js:+12660203)

This modifies only the task payload; all preflight and polling phases are identical.

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_review_remote_precondition_failed` | Fired on each pre-launch abort; carries structured `reason` field covering `allow_remote_sessions`, `not_git_repo`, `no_github_remote`, `monorepo_blocked`, `no_github_remote_post_confirm` |
| Telemetry: `tengu_review_overage_blocked` | Fired when preflight returns `blocked` spend state |
| Telemetry: `tengu_review_overage_dialog_shown` | Fired when cost-confirmation dialog is displayed |
| Telemetry: `tengu_review_remote_teleport_failed` | Fired when cloud session creation fails |
| Telemetry: `tengu_review_remote_launched` | Fired on successful session creation and on completion |
| Telemetry: `tengu_ccr_bundle_max_bytes` | Fired with repo object count before bundle upload decision |
| Telemetry: `tengu_ccr_bundle_upload` | Fired at bundle upload start and with result |
| Telemetry: `tengu_ccr_bundle_seed_enabled` | Fired when seed-bundle mode is activated |
| Telemetry: `tengu_ccr_session_link` | Fired when session link is available |
| Telemetry: `tengu_teleport_bundle_mode` | Records chosen bundle strategy (`github`, `bundle`, `explicit_env_bundle`) |
| Telemetry: `tengu_teleport_source_decision` | Records source type decision |
| Telemetry: `tengu_review_bughunter_config` | Fired with bughunter configuration at session start |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` | General feature-gate tracking |
| Telemetry: `tengu_daemon_control` | Fired on daemon control events (stop/stop-failed) |
| Telemetry: `tengu_daemon_yield` | Fired when daemon yields to foreground |
| Network: preflight HTTP GET | `GET /v1/ultrareview/preflight` with `teleport-org` header |
| Network: session HTTP POST | `POST /v1/sessions` or `/v1/code/sessions` (v1alpha2 path); header `x-organization-uuid` |
| Network: environment list | `GET` environments endpoint (15 000 ms timeout) |
| File system | Temporary git bundle written to system temp dir, removed after upload (`Gie.unlink`) |
| Git state | Stash ref `refs/seed/stash` and `refs/seed/root` created and deleted during bundle phase |
| appState changes | Session link displayed in UI; remote-workflow polling loop runs in foreground |
| Auth requirement | Claude.ai OAuth token required; API key alone is insufficient |
| Provider restriction | First-party Anthropic API only; third-party, BYOC (without configured env), and data-residency providers are blocked |
| Admin settings URL | `/admin-settings/` referenced for organization policy changes (bundle.js:+12660843) |
| Onboarding URL | `https://claude.ai/code/onboarding?magic=env-setup` for environment setup |
| Cost estimate | `$10–$20` USD (bundle.js:+9236578) |
| Runtime estimate | `~10–20 min` (bundle.js:+9236670) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.197 | Initial analysis |

---

## Common Mistakes

1. **Running outside a git repository**: `/ultrareview` requires `git rev-parse --is-inside-work-tree` to succeed. Initialise a repo and commit at least once before invoking the command.
2. **Using an API key instead of Claude.ai OAuth**: The command explicitly checks for an OAuth token. Running with only `ANTHROPIC_API_KEY` set will produce an authentication error; use `/login` first.
3. **No GitHub remote configured**: A `remote.origin.url` resolving to `github.com` must exist. SSH and HTTPS remotes both work; other hosting providers do not.
4. **Invoking from an Anthropic internal monorepo**: Repos belonging to the `anthropics` or `anthropic` GitHub organization are explicitly blocked (`monorepo_blocked`).
5. **Third-party or data-residency API providers**: The feature is restricted to the first-party Anthropic API endpoint. Switching providers requires updating Claude Code's API configuration.
6. **PR diff or local diff too large**: Very large pull requests or local uncommitted diffs exceed internal size limits and cause an abort before the session is created.
7. **Repository has no commits**: An empty repo (no commits yet) will fail during the bundle-upload phase. Commit an initial snapshot first.
8. **Organization policy blocking cloud sessions**: An administrator must enable the `allow_remote_sessions` policy in the organization admin settings page before any team member can use `/ultrareview`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Xqf` | Main `ultrareview` async handler (entry point) |
| `O6` | Capitalise / normalise slug helper |
| `Gs` | Auth / network-mode gate resolver |
| `jFi` | Provider classification dispatcher |
| `N6` | Provider-type category builder |
| `GF` | Auth-state aggregator |
| `P$t` | Authentication status inspector (firstParty / third_party / no_auth etc.) |
| `zi` | Telemetry privacy mode checker |
| `qbs` | Privacy mode string resolver |
| `Q_e` | Auth-setting string normaliser |
| `ct` | String coercion / formatting utility |
| `w4o` | CLI argument parser (fix / comment mode detection) |
| `rar` | Flag-string tokeniser (trims, splits, replaces) |
| `GL` | Shell-escape / dollar-sign sanitiser |
| `sar` | Git precondition runner (remote URL, PR diff, branch, merge-base) |
| `ymt` | Git `rev-parse --is-inside-work-tree` caller |
| `Ot` | `git` command executor |
| `nmn` | Async-context store accessor |
| `Gr` | Child-process executor with buffered output |
| `LBe` | Exec options builder |
| `mFu` | String conversion helper for exec output |
| `fFu` | Exec error formatter |
| `ke` | Exec result log / error-push helper |
| `Uo` | Object assign merge helper |
| `er` | Structured error factory |
| `iN` | Git remote URL resolver and cache manager |
| `K7` | Cached remote-URL lookup |
| `$mn` | Config file store getter |
| `_tt` | Credential scrubber (replaces `://***@` pattern) |
| `mle` | Remote URL parser (scheme, host, path extraction) |
| `Pvs` | URL path splitter / `.git` stripper |
| `Htt` | SSH-style git URL pattern tester |
| `yi` | Substring slicer utility |
| `Nm` | Hostname normaliser (strips `www.`, validates `github.com`) |
| `wRt` | URL scheme normaliser |
| `Mvs` | URL path segment slicer |
| `Pn` | GitHub CLI PR stats fetcher (`gh pr view --json …`) |
| `bLo` | PR diff size validator (poll with timeout) |
| `Fqe` | Polling / retry utility |
| `it` | Work-item / task state tracker |
| `hol` | Repo object-count fetcher (`git count-objects -v`) |
| `gol` | Object-count output parser |
| `mol` | Task item constructor |
| `f` | Path normaliser (replaces backslashes on Windows) |
| `L8` | OS-aware path formatter |
| `KM` | Default-branch resolver (`symbolic-ref`, `main`/`master` fallback) |
| `sMr` | Default-branch config store getter |
| `hy` | Current-branch resolver (`git branch --abbrev-ref HEAD`) |
| `oMr` | Branch config store getter |
| `Ezn` | `--shortstat` output parser (extracts insertion/deletion counts via parseInt) |
| `iar` | Post-git-check flow: calls preflight API and routes by result |
| `Qzl` | Preflight HTTP GET caller (`/v1/ultrareview/preflight`) |
| `I4o` | Preflight response schema validator |
| `wt` | HTTP feature-flag OK reporter (`tengu_feature_ok`) |
| `xe` | HTTP feature-flag bad reporter (`tengu_feature_bad`) |
| `Re` | HTTP feature-flag sad reporter (`tengu_feature_sad`) |
| `TOe` | Spend-confirmation dialog builder |
| `K_t` | Subscription and plan eligibility gate |
| `R0` | Plan resolver |
| `Bxe` | Subscription type checker |
| `Nc` | API key / helper config inspector |
| `aE` | Auth config field reader |
| `Dt` | Conversation / project state accessor |
| `Ao` | Subscription plan type classifier |
| `R3` | Array-inclusion helper |
| `ib` | User role checker (admin / billing / owner) |
| `Mi` | Role-specific plan validator |
| `OQ` | Session display / link renderer |
| `Jqf` | JSX wrapper that composes `aar` result list and `Yqf` summary |
| `aar` | Main remote-agent orchestration function (session create + monitor) |
| `ife` | Background eligibility pre-check dispatcher |
| `OFa` | Eligibility status aggregator (policy_blocked, not_logged_in, byoc, …) |
| `SW` | Cloud session creation handler (teleport flow) |
| `Lc` | OAuth token accessor |
| `rol` | `--project` flag validator |
| `fh` | Access-token refresh helper |
| `OKn` | Session payload validator |
| `yol` | Session endpoint URL builder (v1alpha2 vs v1) |
| `ivo` | Git bundle upload orchestrator |
| `_ol` | Remote control-request event builder |
| `OGt` | Bundle-mode decision logger |
| `Me` | JSON.stringify wrapper |
| `ce` | Connection state tracker (up/down) |
| `Hol` | Session link / URL formatter |
| `G4n` | GitHub App installation verifier |
| `voe` | Remote environment list fetcher |
| `_mt` | Default cloud environment creator |
| `Cof` | Session task prompt builder (title + JSON schema) |
| `kof` | Environment filter (non-default env selector) |
| `FF` | Message forwarder / conversation state updater |
| `Kje` | GitHub App installation status checker |
| `Ts` | UI display helper |
| `de` | Output queue / stream enqueuer |
| `YAe` | Remote agent monitoring entry point |
| `kU` | Session token generator (randomBytes) |
| `Lmt` | Browser / URL opener (`vB.open`) |
| `OT` | Session status timestamp tracker |
| `Oof` | Session state-change message formatter |
| `Tol` | Session polling loop (1 s interval, 30 min max) |
| `afe` | Session result display renderer |
| `EE` | Result output compositor |
| `Yqf` | Session list mapper (used by `Jqf`) |
| `oar` | Cancellation / cleanup handler |
| `Rt` | Logging utility (`H0` backed) |
| `Us` | OAuth base-URL resolver (local / staging / prod) |
| `On` | Timeout/abort race utility |
| `Wj` | Graceful shutdown orchestrator |
| `sye` | Session shutdown caller |
| `mye` | Timeout clearer |
| `v` | UI state variable |
| `w` | Session-list entry builder |
| `L` | Away-summary guard (skips if rate-limited, draft present, etc.) |
| `YOc` | Away-summary message extractor |
| `JOc` | Message-history window builder |
| `D` | Write-stream helper |
| `R` | File-watch / interval scheduler |
| `AXo` | Scheduled-task executor |
| `grn` | Task cleanup / unlink helper |
| `GEe` | Path join helper |
| `O` | Worker-pool sweep / respawn manager |
| `I` | Keyboard input handler |
| `h` | Background-worker lifecycle manager (spawn, retire, memory check) |
| `ph` | Error classifier (network vs cancel) |
| `k_` | Error renderer |
| `Mo` | React element factory (`$Xe` backed) |