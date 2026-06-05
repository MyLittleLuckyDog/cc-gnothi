---
type: feature-spec
feature: "ultrareview"
cc_version: "2.1.165"
updated: "2026-06-05"
tags: ["ultrareview", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.165 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultrareview`

> Analysis basis: CC v2.1.165 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.165

---

## Overview

`/ultrareview` launches a cloud-hosted autonomous agent that finds and verifies bugs in the current Git branch. The command performs a series of local pre-flight checks, uploads a Git bundle to Anthropic's remote infrastructure, creates a remote session running Claude Code on the web, and then streams the session output back to the local terminal — optionally auto-applying any discovered fixes to the local working tree via `--fix`. The estimated cost is $10–$20 USD and the session typically runs for approximately 10–20 minutes.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultrareview` |
| description | `"Start a cloud agent that finds and verifies bugs in your branch ( … , … USD) · Runs in Claude Code on the web. See …"` |
| module_id | `ptq` |
| load_inline | `true` |
| loc_byte | `12225737` |
| loc_byte_end | `12226007` |
| loc_line | `8631` |
| arbor_handler.name | `pIf` |
| arbor_handler.fqn | `claude-2.1.165::pIf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.165 bundle.js:+12225737

---

## Input Branching

The command has more than three distinct decision paths: policy guard, provider guard, authentication guard, preflight API gate, cost-overage confirmation, `--fix` flag processing, remote session lifecycle (teleport phases), and session result streaming. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/ultrareview invoked"]) --> B{Remote sessions\nallowed by org policy?}
    B -- No --> ERR1["Error: policy disabled\n(tengu_review_remote_precondition_failed)"]
    B -- Yes --> C{First-party\nAnthropic provider?}
    C -- No --> ERR2["Error: unavailable on\nthird-party providers"]
    C -- Yes --> D{essential-traffic-only\nmode active?}
    D -- Yes --> ERR3["Error: unavailable in\nessential-traffic-only mode"]
    D -- No --> E{OAuth token\n(Claude.ai) present?}
    E -- No --> ERR4["Error: run /login\n(no_oauth_token)"]
    E -- Yes --> F["Preflight API call\nPOST /v1/ultrareview/preflight"]
    F --> G{Preflight result}
    G -- blocked --> ERR5["Error: org unavailable\n(policy_blocked)"]
    G -- needs-confirm --> H{"Cost overage\ndialog shown\n(tengu_review_overage_dialog_shown)"}
    H -- User cancels --> CANCEL["'Ultrareview cancelled.'"]
    H -- User confirms --> I
    G -- proceed --> I["Collect git context\n(branch, remote URL,\nmerge-base, diff --shortstat)"]
    I --> J{Git repo present\nand has remote?}
    J -- No repo --> ERR6["Error: not_in_git_repo"]
    J -- No remote --> ERR7["Error: no_git_remote"]
    J -- OK --> K{GitHub.com remote?}
    K -- No --> L["GHES / forced bundle\nor BYOC path"]
    K -- Yes --> M["Check GitHub App\ninstalled"]
    M --> N{App installed?}
    N -- No --> ERR8["Error: github_app_not_installed"]
    N -- Yes --> O["Phase: bundle-upload\nPackage git bundle\n(teleport_git_bundle_upload)"]
    L --> O
    O --> P["Phase: POST-sent\nCreate remote session\nPOST to Anthropic cloud"]
    P --> Q{HTTP response}
    Q -- 401/403/429 --> ERR9["Auth / rate-limit error\n(create_request_failed)"]
    Q -- 201 --> R["Session created\n(tengu_review_remote_launched)"]
    R --> S["Stream remote session\nevents (azq poll loop)"]
    S --> T{Session terminal\nstate}
    T -- completed --> U{"--fix flag set?"}
    U -- Yes --> V["Apply findings to\nlocal working tree"]
    U -- No --> W["Display review output"]
    T -- error/timeout --> ERR10["Error: remote session\nreturned error / exceeded 30 min"]
    T -- archived --> ERR11["Session archived early\n(no review output)"]
    V --> W
    W --> DONE([Done])
```

---

## Behavioral Spec

### 1. Handler Entry — `handlerMain` (`pIf`)

Analysis basis: CC v2.1.165 bundle.js:+12223392

```
async function handlerMain(commandInput, appState):
    # Gate 1: org policy
    if not remoteSessionsAllowed(appState):           # allow_remote_sessions flag
        displayError("Remote sessions are disabled by your organization's policy …")
        return

    # Gate 2: provider check (firstParty required)
    providerInfo = getProviderInfo(appState)
    if providerInfo.type != "firstParty":
        displayError("Remote sessions are only available on the first-party …")
        return

    # Gate 3: essential-traffic-only
    if trafficMode == "essential-traffic-only":
        displayError("Ultrareview runs in Claude Code on the web and is unavailable …")
        return

    # Parse flags
    fixFlag = commandInput includes "--fix"

    # Run pre-flight + main flow
    result = await runPreflightAndLaunch(commandInput, appState, fixFlag)

    if result is cancelled:
        displayMessage("Ultrareview cancelled.")
```

Analysis basis: CC v2.1.165 bundle.js:+12223395, +12223429

### 2. Pre-flight API Check — `preflightCheck` (`pqA` / `Xtq`)

Analysis basis: CC v2.1.165 bundle.js:+12223689, +12184130

```
async function preflightCheck(appState):
    # Call /v1/ultrareview/preflight
    response = await apiGet("/v1/ultrareview/preflight",
                            headers={"teleport-org": orgUuid})

    emit telemetry("api_ultrareview_preflight")

    match response.status:
        "blocked":
            emit telemetry("tengu_review_overage_blocked")
            displayError("Ultrareview is unavailable for your organization.")
            return ABORT

        "needs-confirm":
            emit telemetry("tengu_review_overage_dialog_shown")
            confirmed = await showCostConfirmationDialog()
            if not confirmed:
                return CANCELLED
            return PROCEED

        "proceed":
            return PROCEED

        else:
            emit telemetry with "schema_mismatch" or "request_failed"
            return ABORT
```

Cost range advertised in description: **$10–$20 USD** (bundle.js:+12183420).
Estimated session duration: **~10–20 min** (bundle.js:+12183512).

### 3. Remote Precondition Checks — `remotePreconditionCheck` (`mqA`)

Analysis basis: CC v2.1.165 bundle.js:+12223609

```
async function remotePreconditionCheck(appState):
    emit telemetry("tengu_review_remote_precondition_failed") on any failure

    # 3a. Git repo check
    isGitRepo = await runGit(["rev-parse", "--is-inside-work-tree"])
    if not isGitRepo:
        return Failure("not_in_git_repo")

    # 3b. Remote URL
    remoteUrl = await getGitRemoteUrl()      # git config --get remote.origin.url
    if not remoteUrl:
        return Failure("no_git_remote",
                       "No git remote URL found")

    # 3c. Credential scrubbing
    remoteUrl = scrubCredentials(remoteUrl)  # replaces ://***@ pattern

    # 3d. GitHub-specific checks
    if remoteUrl contains "github.com":
        # Verify GitHub App installation
        appInstalled = await checkGithubAppInstalled()
        if not appInstalled:
            return Failure("github_app_not_installed")

    # 3e. Diff size guard
    repoSize = await gitCountObjects()       # git count-objects -v
    if repoSize.bytes > 5_000_000:
        emit telemetry("tengu_ccr_bundle_max_bytes")
        return Failure("too_large")

    # 3f. Merge-base and diff stats
    defaultBranch = await resolveDefaultBranch()  # symbolic-ref / show-ref
    currentBranch = await getCurrentBranch()      # git branch --abbrev-ref HEAD
    mergeBase = await runGit(["merge-base",
                               defaultBranch, currentBranch])
    diffStats = await runGit(["diff", "--shortstat", mergeBase])

    return Success({remoteUrl, currentBranch, defaultBranch,
                    mergeBase, diffStats})
```

String constants involved: `"rev-parse"`, `"--is-inside-work-tree"`, `"remote.origin.url"`, `"merge-base"`, `"diff"`, `"--shortstat"`, `"count-objects"`, `"-v"`, `"github.com"` (bundle.js:+8999519, +1109192, +12187502, +12188009, +9029530, +12186496).

Size limit: **5,000,000 bytes** (bundle.js:+9029971).

### 4. Git Bundle Upload — `bundleUpload` (`bl_`)

Analysis basis: CC v2.1.165 bundle.js:+9032500

```
async function bundleUpload(repoInfo, sessionParams):
    emit telemetry("teleport_git_bundle_upload")

    # Validate non-empty repo
    refCount = await runGit(["for-each-ref", "--count=1", "refs/"])
    if refCount == 0:
        return Failure("empty_repo", "Repository has no commits yet")

    # Stash uncommitted changes into a seed ref
    stashHandle = await runGit(["stash", "create"])
    if stashHandle:
        await runGit(["update-ref", "refs/seed/stash", stashHandle])
    await runGit(["update-ref", "refs/seed/root", "HEAD"])

    # Create the bundle file (ccr-seed.bundle / _source_seed.bundle)
    bundlePath = tempDir + "/ccr-seed.bundle"
    await runGit(["bundle", "create", bundlePath, "--all"])

    # Upload via HTTP (expect 200)
    uploadResult = await httpPut(uploadUrl, bundlePath)
    if uploadResult.status != 200:
        emit telemetry "stash_failed" or "upload_failed"
        return Failure

    # Cleanup seed refs
    await runGit(["update-ref", "-d", "refs/seed/stash"])
    await runGit(["update-ref", "-d", "refs/seed/root"])

    emit telemetry("tengu_ccr_bundle_upload") with outcome in
        ["success","head","fallback_head","squashed","fallback_squashed"]

    return Success
```

Bundle file naming constants: `"ccr-seed"`, `".bundle"`, `"_source_seed.bundle"` (bundle.js:+9033825, +9033836, +9034132).

### 5. Remote Session Creation — `teleportToRemote` (`Wn`)

Analysis basis: CC v2.1.165 bundle.js:+9047799

```
async function teleportToRemote(bundleInfo, appState, fixFlag):
    # Policy / provider guard (second check inside teleport)
    if policyDenied:
        emit Failure("policy_denied",
                     "Remote sessions are disabled by your organization's policy.")
    if not firstParty:
        emit Failure("not_first_party",
                     "Remote sessions are only available on the first-party …")

    accessToken = getOAuthAccessToken()
    if not accessToken:
        emit Failure("no_access_token",
                     "No access token found for remote session creation")

    orgUuid = getOrgUuid()
    if not orgUuid:
        emit Failure("no_org_uuid",
                     "Unable to get organization UUID for remote session creation")

    emit telemetry("tengu_teleport_bundle_mode") with bundleMode

    # POST session creation request
    headers = {
        "anthropic-beta": "ccr-byoc-2025-07-29",
        "x-organization-uuid": orgUuid,
    }
    response = await httpPost(sessionEndpoint, payload, headers)

    match response.status:
        201:
            sessionId = response.body.id
            if not sessionId:
                return Failure("malformed_response",
                               "Server returned a malformed session response (no session id)")
            emit telemetry("tengu_ccr_session_link")
            return sessionId
        401 | 403 | 429:
            return Failure("create_request_failed")
        else if response includes "github_repo_access_denied":
            return Failure("github_repo_access_denied")
```

Beta header constant: `"ccr-byoc-2025-07-29"` (bundle.js:+9048802).

### 6. Session Streaming & Poll Loop — `sessionPoller` (`azq`)

Analysis basis: CC v2.1.165 bundle.js:+9127937

```
async function sessionPoller(sessionId, appState, fixFlag):
    TIMEOUT_MS = 1_800_000   # 30 minutes (bundle.js:+9129100)

    startTime = Date.now()
    state = "starting"

    while True:
        if Date.now() - startTime > TIMEOUT_MS:
            return Failure("remote session exceeded 30 minutes")

        events = await pollSession(sessionId)

        for event in events:
            match event.type:
                "SessionStart":
                    state = "running"
                "hook_progress" | "hook_response":
                    streamEventToTerminal(event)
                "result":
                    finalOutput = extractResult(event)
                    state = "completed"
                "remote-workflow":
                    # orchestrator lifecycle signal
                    pass
                "idle" | "hook_started":
                    pass

        if state == "completed":
            break
        if state in ["archived", "error"]:
            return Failure("remote session returned an error")

        await sleep(pollingInterval)

    if not finalOutput:
        return Failure("no review output — orchestrator may have exited early")

    if fixFlag:
        applyFindingsToWorkingTree(finalOutput)

    displayReviewOutput(finalOutput)
    emit telemetry("tengu_review_remote_launched")
```

Session timeout: **1,800,000 ms (30 minutes)** (bundle.js:+9129100).

### 7. `--fix` Flag Processing — `fixApplicator` (`mIf`)

Analysis basis: CC v2.1.165 bundle.js:+12224283

When `--fix` is present in the command input, the handler appends an instruction to the remote agent prompt indicating that discovered findings should be applied to the local working tree upon completion. The literal instruction fragment starts with `" The user passed --fix: when the findings arrive, apply them…"` (bundle.js:+12223130). After the remote session completes, the local handler reads the structured output and applies patches via the working-tree write path.

### 8. Remote Environment Selection — `environmentSelector` (`_t` / `a66`)

Analysis basis: CC v2.1.165 bundle.js:+8997293

```
async function environmentSelector(orgUuid, accessToken):
    emit telemetry("teleport_environments_list")

    envList = await listRemoteEnvironments(orgUuid)   # GET with 15 s timeout

    if envList is empty:
        # Auto-create a default cloud environment
        defaultEnv = await createDefaultEnvironment({
            name: "Default",
            homePath: "/home/user",
            runtime: { python: "3.11", node: "20" },
        })
        emit telemetry("teleport_default_environment_create")

        if creation fails:
            displayWarning("Could not create a cloud environment. Set one up at …")
            emit "no_default_env"
            return Failure

    return selectedEnvironment
```

Environment creation timeout: **15,000 ms** (bundle.js:+8997931).
Default environment runtimes: Python `3.11`, Node `20` (bundle.js:+8998816, +8998845).

### 9. GitHub App Installation Check — `githubAppCheck` (`ERH`)

Analysis basis: CC v2.1.165 bundle.js:+8999633

```
async function githubAppCheck(accessToken, orgUuid):
    if not accessToken:
        log("checkGithubAppInstalled: No access token found, assuming app not installed")
        return False

    if not orgUuid:
        log("checkGithubAppInstalled: No org UUID found, assuming app not installed")
        return False

    response = await apiGet(githubAppCheckEndpoint)

    if response.status == 400:
        # Treated as "app not installed" (schema-level rejection)
        return False
    if _A.isAxiosError(response):
        return False

    return response indicates app "is" installed   # "is" / "is not" literals
```

HTTP status constants: `400` (bundle.js:+9000437).

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_review_remote_precondition_failed` | Fired on any pre-flight git/auth check failure (bundle.js:+12185793) |
| Telemetry — `tengu_review_bughunter_config` | Fired with session configuration parameters (bundle.js:+12183303) |
| Telemetry — `tengu_review_overage_blocked` | Fired when preflight returns `"blocked"` status (bundle.js:+12223727) |
| Telemetry — `tengu_review_overage_dialog_shown` | Fired when cost-confirmation dialog is shown (bundle.js:+12224064) |
| Telemetry — `tengu_ccr_bundle_seed_enabled` | Fired when seed-stash bundling path is active (bundle.js:+9121047) |
| Telemetry — `tengu_ccr_bundle_upload` | Fired with outcome string after bundle upload (bundle.js:+9032822) |
| Telemetry — `tengu_teleport_bundle_mode` | Records which bundle mode was selected (bundle.js:+9049206) |
| Telemetry — `tengu_ccr_session_link` | Fired when session ID is received (bundle.js:+9042754) |
| Telemetry — `tengu_teleport_source_decision` | Records the source-code decision (github / bundle / no_git / etc.) (bundle.js:+9054668) |
| Telemetry — `tengu_review_remote_teleport_failed` | Fired if `teleportToRemote` fails (bundle.js:+12191649) |
| Telemetry — `tengu_review_remote_launched` | Fired on successful session launch (bundle.js:+12192172) |
| Telemetry — `tengu_ccr_bundle_max_bytes` | Fired when repo exceeds the 5 MB size limit (bundle.js:+9029445) |
| Telemetry — `tengu_feature_ok` / `tengu_feature_sad` | Generic feature success/failure events (bundle.js:+1010222, +1010365) |
| appState changes | Reads `allow_remote_sessions` policy flag; reads `allow_product_feedback` flag; reads OAuth access token and org UUID; may write session state to `_A` (app event bus) |
| File system side effects | Creates a temporary Git bundle file (`ccr-seed.bundle` / `_source_seed.bundle`); cleans up the file via `fs.unlink` after upload (bundle.js:+9034777) |
| Git side effects | Temporarily writes `refs/seed/stash` and `refs/seed/root` refs; removes them after bundling |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Hook registration | Registers a `zXA.register` hook for session lifecycle management (bundle.js:+60323) |
| Network I/O | `GET /v1/ultrareview/preflight`, `POST` session creation endpoint, periodic session polling `GET`, bundle `PUT` upload |

---

## Version History

| Version | Change |
|---|---|
| v2.1.165 | Initial analysis |

---

## Common Mistakes

1. **Running without a GitHub remote configured.** The command requires `git remote add origin REPO_URL` for standard GitHub-backed sessions. Attempting `/ultrareview` in a repo without an `origin` remote yields a `no_git_remote` error.
2. **Using an API key instead of a Claude.ai OAuth login.** The command explicitly requires Claude.ai OAuth authentication. An `ANTHROPIC_API_KEY`-only setup is insufficient; run `/login` first.
3. **Running in a repo with no commits.** The bundle-upload phase checks for at least one ref under `refs/`; an empty repository aborts with `"Repository has no commits yet"`.
4. **Repository size over 5 MB.** If the `git count-objects -v` total exceeds 5,000,000 bytes the command aborts with a `too_large` error before any upload is attempted.
5. **Organization policy blocking remote sessions.** Enterprise/team admins can disable remote sessions via the `allow_remote_sessions` policy. If disabled, the command fails immediately with a policy error message and directs users to contact their admin.
6. **Using `/ultrareview` on essential-traffic-only networks.** The feature requires full outbound access to Anthropic cloud infrastructure; it is explicitly blocked when the client is in `essential-traffic-only` mode.
7. **Expecting instant results.** The remote session runs for approximately 10–20 minutes. The local terminal will stream progress events but the process is long-running; closing the terminal does not cancel the remote agent.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `pIf` | Main handler (`handlerMain`) for `/ultrareview` — async entry point |
| `W9` | Remote-sessions allowance checker (reads `allow_remote_sessions` policy) |
| `rL9` | Provider type resolver |
| `WIH` | Provider information aggregator |
| `TC` | Provider type classifier (firstParty / enterprise / team / etc.) |
| `XX6` | Config file reader (uses `readFileSync`, `utf-8`) |
| `q7H` | Policy flag evaluator (`A.some`, `_.includes`) |
| `Dq` | Traffic-mode checker |
| `xSA` | Essential-traffic sentinel resolver |
| `eH` | Generic string coercer |
| `e4H` | Product-feedback flag reader |
| `H` | Bootstrap / API fetch utility |
| `v` | HTTP request builder (sets `Content-Type`, `User-Agent`, `debug`) |
| `icK` | Request dispatcher with provider routing |
| `DXA` | Provider-specific request adapter |
| `SH` | JSON serialiser wrapper |
| `J4` | URL path builder |
| `c2A` | URL segment mapper |
| `ppH` | Response writer |
| `C2A` | Stream write helper |
| `acK` | Log / transcript appender |
| `$pH` | Streaming buffer flush scheduler (uses `clearTimeout`, `setTimeout`, `setImmediate`) |
| `d3H` | Log directory setup |
| `aL6` | Filesystem path helper |
| `s2A` | Transcript file path resolver |
| `a2A` | Transcript rotation / rename logic |
| `ocK` | Transcript append worker (uses `mkdir`, `appendFile`) |
| `j9` | Hook registrar (`zXA.register`) |
| `e$` | Cached app-state getter |
| `Gw_` | String splitter / token parser |
| `ZHH` | Set membership guard (`c44.has`) |
| `uj` | String replace sanitiser |
| `e1` | Argument / diff parser |
| `D6H` | Diff chunker |
| `IqH` | Diff header extractor |
| `yd` | Diff line parser |
| `Aq` | Model name normaliser |
| `o0` | Model alias lookup |
| `_4H` | Model inclusion checker (`H4H.includes`) |
| `wI` | Model flag setter (`gM`, `Z5`) |
| `NQH` | Model capability query |
| `NE` | Model entry constructor |
| `SX1` | Model entry wrapper |
| `gM` | Model record factory |
| `Pe6` | Model list filter |
| `vQH` | Model string coercer |
| `eX` | Parsed-argument dispatcher |
| `r0` | Argument type router |
| `s6` | UI component renderer |
| `c` | React createElement helper |
| `P6` | React component wrapper |
| `Nu6` | React root initialiser |
| `Gtq` | Precondition result processor (reads "fix"/"comment" literals) |
| `JR8` | Precondition result parser |
| `L` | Promise / event subscription manager |
| `f` | Connection closer |
| `WV` | Text replacer (escapes `\\$&`) |
| `K` | Result accumulator / formatter |
| `M` | MCP state manager |
| `AbH` | MCP connection bootstrapper |
| `eU8` | MCP connection applier |
| `$` | MCP client map accessor |
| `IYA` | MCP server restart/retry coordinator |
| `mqA` | Remote precondition check orchestrator |
| `$T8` | Git-repo detector (`rev-parse --is-inside-work-tree`) |
| `b6` | Git command runner (base) |
| `bd6` | AsyncLocalStorage-backed git runner |
| `X_` | Child-process spawner |
| `S_` | Git command executor with timeout |
| `bTH` | Low-level git process manager |
| `D` | Forced-shutdown handler |
| `bG4` | Exit-code stringifier |
| `K$` | Git output decoder |
| `v8` | File encoding helper |
| `kH` | Git error logger |
| `bR` | Remote URL fetcher (`git config --get remote.origin.url`) |
| `eQ` | Remote URL cache lookup |
| `Pc6` | Remote URL store getter (`YKH.get`) |
| `iBH` | Credential scrubber (replaces `://***@`) |
| `CHH` | Remote URL parser |
| `$xA` | URL component extractor |
| `Q1` | URL slice helper |
| `zzq` | Repo size checker (`git count-objects -v`) |
| `Ozq` | Size counter executor |
| `$zq` | Repo object counter |
| `D6` | Object-count result parser |
| `C8` | Git tree-state checker |
| `ov` | Default-branch resolver (`symbolic-ref`) |
| `MH_` | Default-branch store getter |
| `Ew` | Current-branch resolver (`branch --abbrev-ref HEAD`) |
| `LH_` | Branch store getter |
| `O` | Background session monitor |
| `b8` | Background session state holder |
| `SQ_` | Diff stat parser (`parseInt`) |
| `jtq` | Diff size estimator (`Math.floor`, `Number.isFinite`) |
| `GxH` | Git diff runner |
| `pqA` | Pre-flight API caller |
| `Xtq` | Pre-flight response handler (`/v1/ultrareview/preflight`) |
| `B6` | JSON.parse wrapper |
| `bqA` | Pre-flight error handler |
| `hH` | UI dialog renderer |
| `ExH` | Pre-flight diff-stat runner |
| `y86` | Git working-tree state manager |
| `fZ` | Stash file cleaner |
| `TDH` | Working-tree snapshot orchestrator |
| `hL` | Snapshot coordinator |
| `zY` | Git state resolver |
| `y6` | Session record constructor |
| `ZA` | Session snapshot builder |
| `nR` | Array/inclusion check helper |
| `iy` | Subscription type checker |
| `_q` | Subscription plan resolver |
| `mL_` | Plan type mapper |
| `uL_` | Plan name normaliser |
| `et` | Diff formatter |
| `mIf` | Fix-flag processing coordinator |
| `UqA` | Remote session launch orchestrator |
| `T2H` | Eligibility pre-launcher |
| `nzq` | Background eligibility checker |
| `T` | Session parameter builder |
| `C5H` | Session config serialiser |
| `wtq` | Diff size formatter |
| `Wn` | `teleportToRemote` — remote session creator |
| `Z7` | OAuth token getter |
| `S3` | Org UUID fetcher |
| `Ul_` | Org UUID resolver |
| `px` | Session state updater |
| `U1` | OAuth endpoint validator |
| `gj` | Anthropic API request builder |
| `bl_` | Git bundle upload executor |
| `S6` | Child-process utility |
| `W6` | React render helper |
| `Dzq` | Random UUID generator for session |
| `pN6` | Session payload builder |
| `Yzq` | Session link display renderer |
| `fT8` | Session result formatter |
| `_t` | Environment list fetcher |
| `a66` | Default environment creator |
| `EH` | String coercer (for error messages) |
| `En7` | Title-generation task spec builder |
| `wh` | Git object counter variant |
| `ERH` | GitHub App installation checker |
| `s` | MCP state sync handler |
| `HA` | Error string builder |
| `jz` | Axios cancel-token checker |
| `BO` | Request abort handler |
| `CRH` | Remote agent session runner (`azq` poll loop orchestrator) |
| `Wk` | Random-bytes generator (session token) |
| `B66` | Browser / system opener |
| `o2` | Timestamp-stamped file opener |
| `en7` | Session display string builder |
| `azq` | Session event poll loop |
| `Z2H` | Session state machine initialiser |
| `iw` | Keyed subscription store |
| `uIf` | Fix-result mapper |
| `uqA` | Cancellation signal emitter |