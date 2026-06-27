---
type: feature-spec
feature: "ultrareview"
cc_version: "2.1.195"
updated: "2026-06-27"
tags: ["ultrareview", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.195 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultrareview`

> Analysis basis: CC v2.1.195 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.195

---

## Overview

`/ultrareview` launches a cloud-hosted agent that performs deep bug-finding and verification on your current git branch. The command runs an asynchronous remote session on Claude Code on the web (the "teleport" infrastructure), collects review findings, and optionally applies fixes to the local working tree via `--fix`. Because it executes in a cloud sandbox, it is constrained by OAuth authentication, GitHub connectivity, and organizational policy gates before any remote work begins.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultrareview` |
| description | `"Start a cloud agent that finds and verifies bugs in your branch ( … , … USD) · Runs in Claude Code on the web. See …"` |
| module_id | `M8l` |
| load_inline | `true` |
| loc_byte | `12564532` |
| loc_byte_end | `12564802` |
| loc_line | `8488` |
| arbor_handler.name | `$6f` |
| arbor_handler.fqn | `claude-2.1.195::$6f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.195 bundle.js:+12564532

---

## Input Branching

The handler follows more than three distinct branching paths (environment eligibility, OAuth state, org policy, GitHub connectivity, diff size, preflight API result, and confirmation state), so a Mermaid flowchart is used below.

```mermaid
flowchart TD
    A(["/ultrareview invoked"]) --> B{allow_remote_sessions\nenabled?}
    B -- No --> BLOCKED["Error: Cloud Sessions disabled\n(show admin-settings link)"]
    B -- Yes --> C{Essential-traffic-only\nmode active?}
    C -- Yes --> ETB["Error: unavailable in\nessential-traffic-only mode"]
    C -- No --> D{Third-party provider\nor data-residency mode?}
    D -- Yes --> TPB["Error: unavailable on\nthird-party providers"]
    D -- No --> E{OAuth token present?\n(Claude.ai account)}
    E -- No --> NOAUTH["Error: requires Claude.ai\naccount — run /login"]
    E -- Yes --> F["Call preflight API\n/v1/ultrareview/preflight"]
    F --> G{Preflight response}
    G -- blocked --> ORGBLOCK["Error: Ultrareview unavailable\nfor your organization"]
    G -- schema_mismatch --> SCHEMA["Error: schema mismatch"]
    G -- request_failed --> REQFAIL["Error: request failed"]
    G -- proceed --> H{PR diff size check}
    G -- needs-confirm --> CONFIRM["Show cost estimate\n~$10-$20 / ~10–20 min\nAsk for confirmation"]
    CONFIRM -- confirmed --> H
    CONFIRM -- cancelled --> CANCEL["Ultrareview cancelled."]
    H -- pr_diff_too_large --> DIFFLARGE["Error: PR diff too large"]
    H -- OK --> I{Is inside git repo?}
    I -- No --> NOGIT["Error: not_git_repo"]
    I -- Yes --> J{GitHub remote\ndetected?}
    J -- No --> NOGHR["Error: no_github_remote"]
    J -- Yes --> K{Monorepo\nblocked?}
    K -- Yes --> MONO["Error: monorepo_blocked"]
    K -- No --> L{Local diff\nempty or too large?}
    L -- empty_diff --> EMPTY["Error: empty_diff"]
    L -- local_diff_too_large --> LDLARGE["Error: local_diff_too_large"]
    L -- OK --> M["Check remote agent eligibility\n(G1a)"]
    M --> N{Eligibility result}
    N -- not_logged_in --> NLOGIN["Error: not logged in"]
    N -- policy_blocked --> POLB["Error: policy blocked"]
    N -- not_in_git_repo --> NGIT2["Error: not in git repo"]
    N -- no_git_remote --> NGITR["Error: no git remote"]
    N -- github_app_not_installed --> NOAPP["Error: GitHub App not installed"]
    N -- eligible --> O["Launch remote session\n(teleport / QG)"]
    O --> P{Session launch result}
    P -- failed --> LAUNCHFAIL["Error: failed to launch\ncloud session"]
    P -- overage_blocked --> OVB["Emit tengu_review_overage_blocked\nShow overage dialog"]
    P -- success --> Q["Poll remote session\n(pAe / oel)"]
    Q --> R{Session state}
    R -- running/starting --> Q
    R -- completed --> S{"--fix flag set?"}
    R -- poll_timeout --> PTIMEOUT["Error: poll_timeout"]
    R -- session_error --> SERR["Error: session_error"]
    R -- orchestrator_error --> OERR["Error: orchestrator_error"]
    S -- Yes --> FIX["Apply findings to\nlocal working tree"]
    S -- No --> DISPLAY["Display review findings\nto user"]
    FIX --> DONE([Done])
    DISPLAY --> DONE
```

Analysis basis: CC v2.1.195 bundle.js:+12562014

---

## Behavioral Spec

### 1. Entry Point — Main Handler (`$6f`)

The Arbor-resolved handler is the async function `$6f` (module `M8l`).

```
async function ultrareviewHandler(args, appState):
    # Step 1 — Gate: remote sessions allowed?
    if not appState.settings["allow_remote_sessions"]:
        show error "Cloud sessions" disabled
        emit tengu_review_overage_blocked if overage context
        return

    # Step 2 — Normalise args (strip leading slash, trim whitespace)
    normalizedArgs = normalizeCommandArgs(args)   // via stringNormalize (e)
    fixMode = normalizedArgs.includes("--fix")    // literal "--fix" mapped to "fix" mode

    # Step 3 — Precondition checks (tsr sub-flow)
    preconditionResult = await checkPreconditions(normalizedArgs, appState)
    if preconditionResult.failed:
        emit tengu_review_remote_precondition_failed
        show preconditionResult.errorMessage
        return

    # Step 4 — Fetch remote session eligibility and launch
    sessionResult = await launchRemoteSession(preconditionResult, appState)
    if sessionResult.failed:
        show "Ultrareview failed to launch the cloud session …"
        emit tengu_review_remote_teleport_failed
        return

    # Step 5 — Poll for results
    reviewOutput = await pollRemoteSession(sessionResult.sessionId)
    if reviewOutput.timedOut or reviewOutput.error:
        show error details
        return

    # Step 6 — Optionally apply fix
    if fixMode:
        applyFindingsLocally(reviewOutput.findings)
    else:
        displayFindings(reviewOutput.findings)

    emit tengu_review_remote_launched
```

Analysis basis: CC v2.1.195 bundle.js:+12562014

---

### 2. Precondition Checks (`tsr`)

`tsr` is the main precondition-checking async function. It performs a series of sequential validations and short-circuits on the first failure.

```
async function checkPreconditions(args, appState):
    # 2a — Auth-provider eligibility (Fs / HNi / g6 / TF)
    authMode = resolveAuthMode(appState)   // checks firstParty, third_party_provider,
                                           // custom_base_url, no_auth, oauth scopes,
                                           // enterprise/team/prosumer_oauth tiers
    if authMode == "essential-traffic-only":
        return FAIL("Ultrareview runs in Claude Code on the web and is unavailable
                     when essential-traffic-only mode is active.")   // bundle.js:+12521849
    if authMode == "third_party_provider" or authMode == "data_residency":
        return FAIL("Ultrareview runs in Claude Code on the web and is unavailable
                     on third-party providers.")                     // bundle.js:+12521996
    if authMode == "no-auth":
        return FAIL("Ultrareview requires a Claude.ai account. Run /login …")
                                                                     // bundle.js:+12522129

    # 2b — Teleport-org / preflight API call (g8l → /v1/ultrareview/preflight)
    preflightResult = await callUltrareviewPreflight()   // endpoint: /v1/ultrareview/preflight
                                                          // bundle.js:+12521719
    match preflightResult.status:
        "blocked"        → return FAIL("Ultrareview is unavailable for your organization.")
        "schema_mismatch"→ return FAIL with schema_mismatch code
        "request_failed" → return FAIL with request_failed code
        "needs-confirm"  → showCostConfirmDialog()  // $10-$20, ~10–20 min
                           if not confirmed: return CANCEL
        "proceed"        → continue

    # 2c — Git repo check (hft → git rev-parse --is-inside-work-tree)
    if not isInsideGitRepo():
        return FAIL(code="not_git_repo")    // bundle.js:+12523735

    # 2d — Fetch git remote URL ($1 → git config --get remote.origin.url)
    remoteUrl = getGitRemoteUrl()
    if not remoteUrl:
        return FAIL(code="no_github_remote")   // bundle.js:+12524068

    # 2e — Parse and validate GitHub remote (Pm → strip www., require github.com)
    parsedRemote = parseGithubRemote(remoteUrl)
    if parsedRemote.isAnthropicMonorepo:
        return FAIL(code="monorepo_blocked")   // bundle.js:+12524563

    # 2f — PR diff size check (Mn / gh pr view --json additions,deletions,changedFiles)
    prStats = await fetchPRStats(parsedRemote)  // threshold: 5000 (bundle.js:+12524932)
    if prStats.tooLarge:
        return FAIL(code="pr_diff_too_large")  // bundle.js:+12525142

    # 2g — Repo size check (JZa / git count-objects -v)
    repoBytes = getRepoObjectCount()
    if repoBytes > 5000000:                    // bundle.js:+12517673
        return FAIL(code="repo_too_large_to_bundle")

    # 2h — Base ref detection (vM → symbolic-ref / uy → branch --abbrev-ref HEAD)
    baseRef = detectBaseRef(parsedRemote)      // tries refs/remotes/origin/HEAD,
                                               // falls back to main/master
    if not baseRef:
        return FAIL(code="base_ref_not_found") // bundle.js:+12525966

    # 2i — Merge-base check (git merge-base)
    mergeBase = getMergeBase(baseRef)
    if not mergeBase:
        return FAIL(code="no_merge_base")      // bundle.js:+12526434

    # 2j — Local diff stat (git diff --shortstat)
    diffStat = getLocalDiffStat(mergeBase)
    if diffStat.isEmpty:
        return FAIL(code="empty_diff")         // bundle.js:+12526917
    if diffStat.tooLarge:
        return FAIL(code="local_diff_too_large") // bundle.js:+12527237

    return OK(remoteUrl, baseRef, mergeBase, prStats, fixMode)
```

Analysis basis: CC v2.1.195 bundle.js:+12523680

---

### 3. Remote Session Eligibility Check (`G1a` / `xpe`)

Before launching the session, the handler verifies that the remote agent infrastructure accepts this request.

```
async function checkRemoteAgentEligibility(context):
    # Verifies auth, policy, git remote, GitHub App install
    checks = [
        verifyAuthMode(),              // not_logged_in, byoc
        verifyOrgPolicy(),             // policy_blocked
        verifyGitInWorkdir(),          // not_in_git_repo
        verifyGitRemote(),             // no_git_remote
        verifyGithubAppInstalled(),    // github_app_not_installed
    ]
    for each check in checks:
        if check.failed:
            emit "bg_remote_eligibility_check" telemetry event
            return FAIL(check.code)
    return ELIGIBLE
```

Analysis basis: CC v2.1.195 bundle.js:+7375735

---

### 4. Remote Session Launch and Teleport (`QG`)

`QG` is the core teleport/session-creation async function. It resolves the source code delivery strategy (GitHub vs. local bundle), creates a cloud session, and returns session credentials.

```
async function teleportToRemote(context):
    # Phase: env-select  (bundle.js:+8841355)
    env = await selectOrCreateCloudEnvironment()
    if not env:
        return FAIL("Could not create a cloud environment …")

    # Phase: branch-detect  (bundle.js:+8843160)
    branchInfo = detectBranchSourceMode()
    // Modes: "github", "forced_bundle", "explicit_env_bundle",
    //        "git_repository", "ghes_optimistic"

    # Phase: bundle-upload (if needed)  (bundle.js:+8844819)
    if bundleMode:
        bundleResult = await uploadGitBundle(context)  // CTo
        // Bundle created as ccr-seed-*.bundle, uploaded via teleport_git_bundle_upload
        // Falls back: head → fallback_head → squashed → fallback_squashed
        if bundleResult.failed:
            return FAIL with upload_failed code

    # POST to session creation endpoint
    // Endpoint: /v1/code/sessions (v1alpha2) or /v1/sessions (v1)
    // Header: x-organization-uuid, anthropic-beta
    sessionPayload = buildSessionPayload(env, branchInfo, context)
    response = await postSessionCreate(sessionPayload)

    match response.status:
        201 → extractSessionId(response)
        401 / 403 → FAIL("github_repo_access_denied" or auth error)
        other → FAIL("create_request_failed")

    if not response.sessionId:
        return FAIL("malformed_response", "Server returned a malformed session response")
                     // bundle.js:+8841011

    emit tengu_ccr_session_link
    emit tengu_teleport_bundle_mode
    emit tengu_teleport_source_decision

    return sessionId
```

Analysis basis: CC v2.1.195 bundle.js:+8837519

---

### 5. Session Polling (`pAe` / `oel`)

After the session is created, the handler polls the remote agent for completion, streaming status updates to the UI.

```
async function pollRemoteSession(sessionId):
    pollInterval = 1000ms              // bundle.js:+8860577
    maxDuration  = 1800000ms (30 min)  // bundle.js:+8860584
    startTime    = Date.now()

    loop:
        state = await fetchSessionState(sessionId)  // via remote_agent channel

        match state.status:
            "pending"  / "starting" → continue polling
            "running"               → update progress UI
            "idle"                  → check for hook events
            "completed" / "archived"→ extract result; break
            "hook_progress"         → relay progress event
            "hook_response"         → relay hook response
            "SessionStart"          → mark session started
            error states            →
                if "orchestrator_error" → FAIL(code="orchestrator_error")
                if "session_error"      → FAIL(code="session_error")

        if elapsed >= maxDuration:
            return FAIL(code="poll_timeout")         // bundle.js:+8863263
        if apiError persists after timeout:
            return FAIL(code="poll_timeout_after_api_error")

    if result is empty:
        return FAIL(code="no_review_output")         // bundle.js:+8863278

    return result
```

Analysis basis: CC v2.1.195 bundle.js:+8859219

---

### 6. Git Bundle Creation and Upload (`CTo`)

When the session requires a local git bundle (non-GitHub-App path), the handler creates and uploads a seed bundle.

```
async function uploadGitBundle(context):
    # Verify git repo is non-empty
    commitCount = gitForEachRef("refs/", "--count=1")
    if commitCount == 0:
        return FAIL("empty_repo", "Repository has no commits yet")  // bundle.js:+8820669

    # Create stash snapshot
    stashRef = gitStashCreate()       // stores to refs/seed/stash
    rootRef  = getGitRoot()           // stores to refs/seed/root
    if stashFailed:
        return FAIL("stash_failed")   // bundle.js:+8821196

    # Pack bundle
    bundlePath = tmpdir + "/ccr-seed-" + uuid + ".bundle"  // bundle.js:+8821554
    writeBundle(bundlePath, refs)

    # Upload
    uploadResponse = await postBundle(bundlePath, sessionUploadEndpoint)
    match uploadResponse.status:
        200     → mark "success"
        "head"/"fallback_head"/"squashed"/"fallback_squashed" → variant tracking
        "failed"→ FAIL(code="upload_failed")   // bundle.js:+8822010

    # Cleanup
    unlinkBundleFile(bundlePath)               // bht.unlink
    gitUpdateRef("-d", "refs/seed/stash")
    gitUpdateRef("-d", "refs/seed/root")

    emit tengu_ccr_bundle_upload
    return uploadResult
```

Analysis basis: CC v2.1.195 bundle.js:+8820229

---

### 7. Cost / Overage Dialog (`nsr` / `DPe`)

When the preflight returns `needs-confirm` or the session creation detects overage, a confirmation dialog is displayed.

```
async function showCostConfirmation(preflightData):
    # Cost range shown to user: "$10-$20"    (bundle.js:+9171938)
    # Time estimate shown:      "~10–20 min" (bundle.js:+9172030)
    emit tengu_review_bughunter_config

    confirmed = await promptUserConfirm(
        costRange   = "$10-$20",
        timeRange   = "~10–20 min",
        confirmCode = "confirm"
    )
    if not confirmed:
        return CANCEL("Ultrareview cancelled.")   // bundle.js:+12562895
    return PROCEED
```

Analysis basis: CC v2.1.195 bundle.js:+12527594

---

### 8. Environment Selection (`jre` / `gft`)

The handler lists available cloud environments and creates a default one if none exist.

```
async function selectOrCreateCloudEnvironment(orgUuid, accessToken):
    # Requires first-party provider; OAuth token mandatory
    if not firstPartyProvider:
        return FAIL("Remote environments are only available on the first-party …")
                     // bundle.js:+7371274
    if not accessToken:
        return FAIL("No access token available")   // bundle.js:+7372469

    envList = await listEnvironments(orgUuid, timeout=15000ms)  // bundle.js:+7371835

    if envList.empty:
        # Auto-create "Default" environment
        defaultEnv = await createDefaultEnvironment({
            name: "Default",
            type: "anthropic_cloud",
            label: "Default - trusted network access",
            homeDir: "/home/user",
            runtime: { python: "3.11", node: "20" },
            image: "ccr-byoc-2025-07-29"            // bundle.js:+7372987
        })
        emit "[teleportToRemote] Auto-created default cloud env"  // bundle.js:+8841463
        if createFailed:
            return FAIL("Could not create a cloud environment …") // bundle.js:+8841621

    return selectedEnv
```

Analysis basis: CC v2.1.195 bundle.js:+7371197

---

### 9. `--fix` Mode Application

When `--fix` is present in the command args, the literal string `" The user passed --fix: when the findings arrive, apply them to the local working tree."` is injected into the session context (bundle.js:+12561751). The findings returned by the cloud agent are then applied as local file changes.

```
function buildSessionContext(args, baseContext):
    if args.includes("--fix"):
        baseContext.systemSuffix +=
            " The user passed --fix: when the findings arrive, apply them to the local working tree."
    return baseContext
```

Analysis basis: CC v2.1.195 bundle.js:+12561751

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_review_remote_precondition_failed` | Emitted when any pre-launch gate fails (bundle.js:+12523682) |
| Telemetry — `tengu_review_bughunter_config` | Emitted when cost/confirm dialog is shown (bundle.js:+9171821) |
| Telemetry — `tengu_review_overage_blocked` | Emitted when an overage gate blocks the review (bundle.js:+12562269) |
| Telemetry — `tengu_review_overage_dialog_shown` | Emitted when the overage/cost dialog is rendered (bundle.js:+12562606) |
| Telemetry — `tengu_review_remote_teleport_failed` | Emitted when session launch fails (bundle.js:+12530713) |
| Telemetry — `tengu_review_remote_launched` | Emitted on successful session launch (bundle.js:+12531389) |
| Telemetry — `tengu_ccr_bundle_upload` | Emitted after git bundle is uploaded (bundle.js:+8820551) |
| Telemetry — `tengu_ccr_bundle_seed_enabled` | Emitted when seed-bundle mode is selected (bundle.js:+7376208) |
| Telemetry — `tengu_ccr_bundle_max_bytes` | Emitted with repo size metrics (bundle.js:+8817055) |
| Telemetry — `tengu_ccr_session_link` | Emitted when cloud session link is established (bundle.js:+8830565) |
| Telemetry — `tengu_teleport_bundle_mode` | Emitted with the resolved bundle strategy (bundle.js:+8839176) |
| Telemetry — `tengu_teleport_source_decision` | Emitted with the code-source decision (github/bundle/empty) (bundle.js:+8845729) |
| Telemetry — `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` | Feature-gate health events (bundle.js:+1027363, +1027430, +1027511) |
| Telemetry — `tengu_daemon_yield` | Emitted when daemon yields to foreground (bundle.js:+17906757) |
| Telemetry — `tengu_daemon_control` | Emitted on daemon control operations (bundle.js:+17924594) |
| Telemetry — `tengu_daemon_config_reload` | Emitted when daemon config reloads (bundle.js:+17902328) |
| Telemetry — `tengu_bg_*` | Background scheduler / memory management events (multiple byte offsets) |
| appState changes | Reads `allow_remote_sessions` setting; may show UI confirmation dialog |
| External processes | Invokes `git rev-parse`, `git config --get`, `gh pr view`, `git count-objects`, `git merge-base`, `git diff --shortstat`, `git stash create`, `git bundle create` |
| Network calls | `POST /v1/ultrareview/preflight`, `POST /v1/code/sessions` or `/v1/sessions`, environment list/create endpoints, bundle upload endpoint |
| File I/O | Writes and removes a temporary `.bundle` file (`ccr-seed-<uuid>.bundle`) in the system temp directory during bundle-upload path |
| Session lifecycle | Creates a long-running remote cloud session (up to 30 minutes poll window) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | Remote session control events: `set_permission_mode`, `apply_flag_settings`, `focus`, `control_request` are handled over the session event channel |

---

## Version History

| Version | Change |
|---|---|
| v2.1.195 | Initial analysis |

---

## Common Mistakes

1. **Running without a Claude.ai OAuth login.** `/ultrareview` requires an OAuth session (not an API key). Users with only `ANTHROPIC_API_KEY` set will receive the `no_oauth_token` error. Run `/login` first.
2. **Running in a non-GitHub repository.** The command requires a `git remote` pointing to `github.com`. Repositories hosted on other forges (GitLab, Bitbucket, etc.) will fail with `no_github_remote`.
3. **Running in an Anthropic monorepo.** Repositories matching the `anthropics`/`anthropic` org names on GitHub are explicitly blocked (`monorepo_blocked`).
4. **Running with an empty diff.** If the current branch has no commits different from the base branch, the command returns `empty_diff`. Commit or stage changes before invoking.
5. **Running on a branch with a very large PR diff.** PRs with more than ~5 000 changed-line units (bundle.js:+12524932) are rejected with `pr_diff_too_large`.
6. **Running in essential-traffic-only mode or on a third-party provider.** Both configurations block cloud sessions outright; the command cannot be made to work under those auth modes.
7. **Expecting instant results.** The cloud agent may run for up to 30 minutes. The poll loop times out at 1 800 000 ms. Do not kill the CLI process while polling is active.
8. **Misunderstanding `--fix` scope.** The `--fix` flag instructs the cloud agent to return file-patch findings; it does not run a local automated edit itself. The patches are applied only after the remote session completes.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `$6f` | Main async handler for `/ultrareview` (Arbor-resolved entry point) |
| `m6` | Auth-mode string normalizer / formatter |
| `Fs` | Auth eligibility gate — checks provider type and telemetry policy |
| `HNi` | Inner auth-mode classifier |
| `g6` | Auth token / scope resolver |
| `TF` | Auth-mode decision router |
| `HUt` | Auth mode constant mapper (firstParty, third_party_provider, etc.) |
| `qi` | Telemetry traffic-class resolver |
| `rSs` | Telemetry mode string selector |
| `y_e` | Product-feedback allowance resolver |
| `ut` | Generic string coercion utility |
| `Cs` | CLI error reporter / process exit handler |
| `jBo` | Argument type classifier (fix/comment modes) |
| `Zor` | Argument token parser / splitter |
| `wL` | Shell-escape / string replacement utility |
| `age` | Spend / billing guard |
| `tsr` | Full precondition orchestrator for ultrareview |
| `hft` | Git working-tree check (`git rev-parse --is-inside-work-tree`) |
| `Ot` | Git command executor (wraps child process) |
| `Rpn` | Async-store getter for git context |
| `Hr` | Git result error handler |
| `Wr` | Child process runner (general purpose) |
| `B2e` | Process spawn / stdio manager |
| `SOu` | Stdio string coercer |
| `T` | Log-level / debug formatter |
| `EOu` | Child process event relay |
| `xe` | Error logger / telemetry relay |
| `W` | UI component renderer (JSX helper) |
| `je` | JSX element factory |
| `OJe` | Base JSX node constructor |
| `$1` | Git remote URL fetcher (git config --get remote.origin.url) |
| `y7` | Remote URL cache wrapper |
| `ffn` | Remote URL cache getter |
| `Nae` | GitHub remote URL parser |
| `BTs` | URL host/path splitter |
| `met` | GitHub hostname matcher |
| `yi` | URL component extractor |
| `Pm` | GitHub remote URL normalizer (strips www., validates github.com) |
| `ERt` | URL sanitizer / credential stripper |
| `$Ts` | URL path slicer |
| `Mn` | PR stats fetcher (`gh pr view --json additions,deletions,changedFiles`) |
| `m` | Message content filter / array reducer |
| `thr` | Message string prefix handler |
| `k` | Background worker / scheduled task manager |
| `$7o` | Scheduled task file writer |
| `Wtn` | Scheduled task cleanup helper |
| `D` | Stream writer |
| `oEe` | Path joiner for background sessions |
| `P` | Background worker sweep / lifecycle manager |
| `I` | Input event / keyboard handler |
| `h` | Background worker pool manager |
| `Bt` | JSON.parse wrapper |
| `jCo` | PR diff size calculator |
| `VVe` | Cost/time estimate resolver |
| `at` | Session state tracker |
| `_` | Locale number formatter |
| `JZa` | Repo object count runner (`git count-objects -v`) |
| `YZa` | Repo size check coordinator |
| `zZa` | Session state accessor |
| `f` | Path normalizer |
| `o8` | OS-aware path normalizer (handles Windows) |
| `vM` | Default branch detector (`symbolic-ref refs/remotes/origin/HEAD`) |
| `eRr` | Remote URL config reader |
| `uy` | Current branch detector (`branch --abbrev-ref HEAD`) |
| `Q0r` | Branch config reader |
| `u` | Daemon lifecycle handler |
| `Le` | Daemon-stop OK reporter |
| `Oe` | Daemon-stop JSX node |
| `ke` | Daemon-stop failure reporter |
| `SF` | Daemon control dispatcher |
| `p6` | Daemon event builder |
| `y4e` | Daemon event type resolver |
| `GKr` | Daemon event emitter |
| `yj` | Graceful shutdown coordinator |
| `T_e` | Daemon shutdown initiator |
| `k_e` | Timeout clearer on shutdown |
| `Un` | Abort-signal / timeout race helper |
| `gqn` | Git output line parser (integer extractor) |
| `nsr` | Preflight API caller and cost-dialog orchestrator |
| `g8l` | Ultrareview preflight HTTP request builder |
| `BBo` | Preflight response classifier |
| `wt` | UI text wrapper (JSX) |
| `DPe` | Post-preflight cost display |
| `GHt` | Subscription/account type gate |
| `b0` | Subscription plan resolver |
| `txe` | Account capability checker |
| `kc` | Plan-to-capability mapper |
| `eE` | Auth environment variable checker |
| `Mt` | Session metric recorder |
| `yo` | Subscription tier resolver |
| `y3` | Array/string inclusion checker |
| `tb` | User role / plan eligibility checker |
| `Mi` | Role set validator |
| `EFr` | Role membership tester |
| `yFr` | Role hierarchy resolver |
| `aQ` | Cost estimate display component |
| `U6f` | Full session launch coordinator |
| `rsr` | Remote session runner (main teleport loop) |
| `xpe` | Teleport entry — calls G1a then QG |
| `G1a` | Remote agent eligibility checker |
| `w` | Session descriptor mapper |
| `WY` | Session description formatter |
| `L` | Away-summary / session metadata builder |
| `v` | UI state variable |
| `mkc` | Message extractor (most-recent) |
| `gkc` | Role extractor from conversation |
| `hoe` | Session hook event handler |
| `Bol` | Cost breakdown display |
| `c` | Canvas / UI renderer |
| `yn` | Terminal color helper |
| `QG` | Core teleport / cloud session creation function |
| `Ql` | Error formatter |
| `NZa` | Session phase tracker |
| `ch` | Auth token refresher |
| `RVn` | Session creation HTTP layer |
| `E3` | Session error renderer |
| `ZZa` | Session endpoint resolver (v1alpha2 vs v1) |
| `CTo` | Git bundle creator and uploader |
| `Rt` | Result status accessor |
| `Os` | OAuth endpoint resolver (local/staging/prod) |
| `QZa` | Session creation payload builder |
| `p6t` | Session option processor |
| `Me` | JSON serializer |
| `ae` | UI direction controller |
| `TTo` | Session title generator |
| `wTo` | Session tag builder |
| `LTo` | Session label builder |
| `eel` | Session environment linker |
| `Rh` | Object merge utility |
| `XZa` | Session link UI component |
| `X3n` | Session state broadcaster |
| `jre` | Cloud environment list fetcher |
| `gft` | Default cloud environment creator |
| `ye` | String coercion (display) |
| `d` | Session output stream handler |
| `qQp` | AI-generated session title requester |
| `XQp` | Environment filter |
| `AF` | Agent session state updater |
| `nje` | GitHub App installation checker |
| `As` | Concurrent request queue |
| `Z` | Model / provider state accessor |
| `de` | Task enqueueing helper |
| `Zr` | Error string extractor |
| `lh` | Log-header formatter |
| `R_` | Request cancellation detector |
| `No` | "No environments" error JSX node |
| `pAe` | Remote session poller / result collector |
| `uU` | Random-bytes ID generator |
| `Cht` | Browser-based auth token opener |
| `DT` | Polling delay timer |
| `nZp` | Poll status string formatter |
| `oel` | Session event loop / state machine |
| `Rpe` | Review result extractor |
| `dE` | Diff extractor from result payload |
| `N6f` | Session list mapper |
| `esr` | Post-cancellation cleanup handler |