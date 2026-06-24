---
type: feature-spec
feature: "ultraplan"
cc_version: "2.1.187"
updated: "2026-06-24"
tags: ["ultraplan", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.187 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultraplan`

> Analysis basis: CC v2.1.187 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.187

---

## Overview

`/ultraplan` launches a cloud-based remote planning session that drafts an editable plan inside Claude Code on the web. The command validates local prerequisites (authentication, git state, remote configuration), teleports the local repository to a cloud sandbox, and polls the resulting session until a plan is ready for the user to review and approve. Upon approval, execution continues as a background cloud agent task; results are delivered as a pull request when the session completes.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultraplan` |
| description | `Draft an editable plan in Claude Code on the web ( ... ) · See  ...` |
| argumentHint | `<prompt>` |
| load_inline | `true` |
| load_ident | `Zpf` |
| loc_byte | `12267653` |
| loc_byte_end | `12267885` |
| loc_line | `8223` |
| arbor_handler.name | `Zpf` |
| arbor_handler.fqn | `claude-2.1.187::Zpf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `load_ident` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.187 bundle.js:+12267653

The handler is resolved via `load_ident`: the registration object contains an inline `load: () => Promise.resolve({ call: Zpf })` shape. The Arbor symbol graph confirmed `Zpf` as the single unambiguous handler (`n_hits: 1`).

---

## Input Branching

The command exhibits more than three distinct decision paths across authentication checks, git/remote validation, environment selection, session lifecycle states, and plan approval. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/ultraplan &lt;prompt&gt;"]) --> B{allow_remote_sessions\npolicy enabled?}
    B -- No --> ERR_POLICY["Error: policy_blocked\n(org policy disables cloud sessions)"]
    B -- Yes --> C{Logged in with\nClaude.ai account?}
    C -- No --> ERR_LOGIN["Error: not_logged_in\nPrompt: run /login"]
    C -- Yes --> D{First-party\nAnthropic API?}
    D -- No --> ERR_FP["Error: not_first_party"]
    D -- Yes --> E{Session already\nlaunching / polling?}
    E -- already_launching --> ERR_AL["Error: already launching.\nPlease wait..."]
    E -- already_polling --> SKIP["No-op / skip"]
    E -- No --> F{Prompt contains\n'ultraplan' keyword\nor explicit arg?}
    F -- Neither --> ERR_USAGE["Error: usage hint shown"]
    F -- Yes --> G[Extract & normalize\nprompt text]
    G --> H{In git repo?}
    H -- No --> ERR_NOGIT["Error: not_in_git_repo"]
    H -- Yes --> I{GitHub remote\npresent?}
    I -- No --> ERR_NOREMOTE["Error: no_git_remote\nCloud agents require GitHub remote"]
    I -- Yes --> J[Phase: env-select\nList / auto-create cloud environment]
    J --> K{Environment\navailable?}
    K -- No --> ERR_NOENV["Error: no_environments\nor no_default_env"]
    K -- Yes --> L[Phase: branch-detect\nDetect current branch]
    L --> M[Phase: bundle-upload\nTeleport git bundle to cloud]
    M --> N{Bundle upload\nresult?}
    N -- empty_repo --> ERR_EMPTY["Error: no commits yet"]
    N -- upload_failed --> ERR_UPLOAD["Error: upload_failed"]
    N -- success --> O[Phase: POST-sent\nCreate remote session via API]
    O --> P{API response}
    P -- 401/403 --> ERR_AUTH["Error: github_repo_access_denied\nor auth error"]
    P -- 429/500 --> ERR_RATE["Error: create_request_failed"]
    P -- malformed --> ERR_MAL["Error: malformed_response\n(no session id)"]
    P -- 201 Created --> Q[Begin polling loop\n(timeout: 5400 s / 90 min)]
    Q --> R{Poll result /\nsession status}
    R -- plan_ready --> S[Display draft plan\nto user for review]
    S --> T{User approves?}
    T -- Yes --> U["tengu_ultraplan_approved\nBackground task launched\nResults → PR"]
    T -- No/Refine --> V["Refine local plan\nor abort"]
    R -- needs_input --> W["tengu_ultraplan_awaiting_input\nUser prompted for clarification"]
    W --> Q
    R -- terminated/session_error --> ERR_SES["Error: Cloud ultraplan session failed"]
    R -- poll_timeout --> ERR_TO["Error: timeout_pending / timeout_no_plan"]
    R -- network_or_unknown --> ERR_NET["Error: network_error\nLost connection; session may still run"]
    R -- approved/remote --> U
    Q -- already_polling --> SKIP2["Skip duplicate"]
```

Analysis basis: CC v2.1.187 bundle.js:+12265788, +12263235, +12263253, +12250558, +12250573, +8621050, +8621151, +8621285, +8621398, +8621552

---

## Behavioral Spec

### 1. Entry Point — Handler `Zpf`

`Zpf` is an `AsyncFunction` resolved via `load_ident`. It is the top-level handler for `/ultraplan`.

```
async function ultraplanHandler(context):
    appState = context.getAppState()                    // +12266123

    // Guard: remote sessions must be allowed by policy
    if not appState.allow_remote_sessions:              // +12265809
        return error("policy_blocked")

    // Build normalized prompt from argument or conversation context
    normalizedPrompt = buildPromptIdentifier(context)   // calls promptIdentifierBuilder (+12265788)

    // Check for duplicate in-flight session
    if sessionIsAlreadyLaunching(appState):             // +12263253
        return userMessage("ultraplan: already launching. Please wait...")  // +12261788

    // Perform eligibility checks
    eligibilityResult = checkEligibility(appState)      // calls eligibilityChecker (+12265916)
    if eligibilityResult.blocked:
        return error(eligibilityResult.reason)

    // Launch the remote plan session
    sessionResult = await launchPlanSession(            // calls sessionOrchestrator (+12265843)
        prompt = normalizedPrompt,
        appState = appState
    )

    if sessionResult.error:
        recordTelemetry("tengu_ultraplan_create_failed") // +12263013
        return error(sessionResult.errorCode)

    // Poll until plan is ready or timeout
    planResult = await pollUntilPlanReady(sessionResult.sessionId)

    // Update app state with session outcome
    context.setAppState(updatedState)                   // +12266345
```

Analysis basis: CC v2.1.187 bundle.js:+12265788, +12265843, +12265916, +12266123, +12266345

---

### 2. Prompt Identifier Builder (`Eqn` / `yqn` / `cAo`)

Extracts and normalizes the user's prompt text for use as the cloud task description.

```
function buildPromptIdentifier(rawInput):
    // Check if raw input starts with a known prefix
    prefixMatched = rawInput.startsWith(...)            // +10884600

    // Apply global-ignore regex (gi flag)                 +10884998
    matches = rawInput.matchAll(globalRegex)            // +10885006

    // If 'ultraplan' keyword present anywhere in prompt  +10885350
    if matches contain "ultraplan":
        extract surrounding tokens

    // Replace capture groups ($1$2 substitution)        +10885675
    normalizedText = rawInput.replace(capturePattern, "$1$2")

    // Truncate to max identifier length: 5 chars        +10885698 (literal 5)
    // (used as short slug / branch suffix)
    slug = normalizedText.slice(0, 5)                   // +10885578

    // Lowercase and clean                               +10885649
    result = slug.toLowerCase()
    return result
```

Analysis basis: CC v2.1.187 bundle.js:+10885006, +10885350, +10885578, +10885649, +10885675, +10885698

---

### 3. Eligibility Checker (`Aqt`)

Validates that the local environment meets all preconditions before a remote session is created.

```
async function checkEligibility(appState):
    // 1. Verify first-party provider
    isFirstParty = checkProvider()                      // calls Nl +8606321
    if not isFirstParty:
        return blocked("not_first_party",
            "Cloud sessions are only available on the first-party Anthropic API provider.")  // +8606350

    // 2. Verify Claude.ai login (not API key)
    tokenStatus = refreshAuthToken()                    // calls Rh +8606463
    if tokenStatus != "refreshed":                      // +3073112
        return blocked("no_access_token",
            "Cloud sessions require a claude.ai login. Run /login to authenticate.")  // +8606493

    // 3. Retrieve organization UUID
    orgUUID = getOrgUUID()                              // calls lBn +8606474
    if not orgUUID:
        return blocked("no_org_uuid",
            "Unable to get organization UUID for cloud session creation")  // +8606841

    // 4. Check org policy
    if policyDenied(appState):                          // calls kt +8607378
        return blocked("policy_denied",
            "Cloud sessions are disabled by your organization's policy.")  // +8606234

    // 5. Check for existing in-flight duplicate
    if stateIs("already_polling"):                      // +12263235
        return skip()
    if stateIs("already_launching"):                    // +12263253
        return blocked("already_launching",
            "ultraplan: already launching. Please wait...")  // +12261788

    return eligible()
```

Analysis basis: CC v2.1.187 bundle.js:+8606234, +8606350, +8606429, +8606493, +8606787, +8606841, +8607083, +12263235, +12263253

---

### 4. Remote Eligibility Check (`dga`)

Validates git repository state and GitHub remote availability for the cloud session.

```
async function checkRemoteEligibility(context):
    // Telemetry marker                                  +7215622
    telemetry("bg_remote_eligibility_check")

    // Check git repo exists
    if not inGitRepo():
        return error("not_in_git_repo")                 // +8621151

    // Check GitHub remote exists
    remoteURL = getGitRemoteURL()                       // git config --get remote.origin.url  +1153253
    if not remoteURL:
        return error("no_git_remote",
            "Cloud agents require a GitHub remote. Add one with `git remote add origin REPO_URL`.")
        // +8621307

    // Check if byoc mode applies                       +7215933
    isByoc = checkByocMode()

    // Verify remote is on github.com                   +7216221
    if not remoteURL.includes("github.com") and not byocAllowed:
        return error("github_app_not_installed")        // +8621398

    // Parallel: resolve org UUID + check GH app installed
    [orgResult, appInstalled] = await Promise.all([     // +7215687
        resolveOrgUUID(),
        checkGithubAppInstalled()
    ])

    return { eligible: true, orgUUID: orgResult, remoteURL }
```

Analysis basis: CC v2.1.187 bundle.js:+7215552, +7215622, +7215687, +7215933, +7216221, +8621151, +8621285, +8621307, +8621398

---

### 5. Session Orchestrator (`Qpf`)

Coordinates the full teleport workflow: environment selection, branch detection, bundle upload, session creation, and polling.

```
async function sessionOrchestrator(prompt, eligibilityResult):
    // Phase: env-select                                 +8609502
    log("[teleport] phase: env-select")
    environments = await listEnvironments()             // calls $ee +8609551
    if environments empty:
        // Auto-create default cloud environment        +8609610
        newEnv = await createDefaultEnvironment()      // calls uat +8609591
        if failed:
            warn("Could not create a cloud environment. Set one up at ...")  // +8609768
            return error("no_environments")            // +8610907
    selectedEnv = pickEnvironment(environments)

    // Phase: branch-detect                             +8611307
    log("[teleport] phase: branch-detect")
    branchInfo = await detectBranch()                  // calls ZR +8612138
    // Resolves via: symbolic-ref --short refs/remotes/origin/HEAD  +1164726
    // Falls back to: main / master                    +1164839, +1164846

    // Phase: bundle-upload                             +8612443
    log("[teleport] phase: bundle-upload")
    bundleResult = await uploadGitBundle(branchInfo)   // calls Rco +8607350
    // Teleport event: tengu_ccr_bundle_upload
    if bundleResult.status == "empty_repo":
        return error("empty_repo", "Repository has no commits yet")  // +8590862
    if bundleResult.status == "upload_failed":
        return error("upload_failed")                  // +8592203

    // Phase: POST-sent                                 +8614590
    log("[teleport] phase: POST-sent")
    // Generate title/branch name via AI               +8593835 "claude/task"
    titleResult = await generateTitle(prompt)          // calls evp +8611458
    // telemetry: tengu_teleport_generate_title        +8594133

    // Create the remote session
    response = await http.post(sessionEndpoint, {      // +8608602
        headers: {
            "anthropic-beta": "ccr-byoc-2025-07-29",  // +8607260
            "x-organization-uuid": orgUUID             // +8607282
        },
        body: { prompt, environment: selectedEnv, branch: titleResult.branch }
    })

    // Handle HTTP response codes
    if response.status == 201:                         // +8608694
        sessionId = response.data.id
        if not sessionId:
            return error("malformed_response",
                "Server returned a malformed session response (no session id)")  // +8609268
        return { sessionId, environment: selectedEnv }
    if response.status in [401, 403]:                  // +8608763, +8608767
        return error("github_repo_access_denied")      // +8608816
    if response.status in [429, 500]:                  // +8608771
        return error("create_request_failed")          // +8609117
```

Analysis basis: CC v2.1.187 bundle.js:+8607260, +8607282, +8607350, +8608602, +8608694, +8608763, +8608816, +8609117, +8609268, +8609331, +8609502, +8609551, +8609591, +8611307, +8612138, +8612443, +8614590

---

### 6. Session Poller (`jpf` / `$Ll`)

Polls the remote session status on a timer until a terminal state or timeout is reached.

```
async function pollUntilPlanReady(sessionId, options):
    // Overall timeout: 5400 seconds (90 minutes)      +12258542
    timeoutMs = 5400 * 1000

    telemetry("tengu_ultraplan_timeout_seconds", { seconds: 5400 })  // +12258508

    startTime = Date.now()                             // +12258986

    loop:
        elapsed = Date.now() - startTime
        if elapsed >= timeoutMs:
            return error("timeout_pending")            // +12250911

        sessionState = await fetchSessionState(sessionId)  // calls $Ll +12259072

        switch sessionState.status:
            case "plan_ready":                         // +12250558
                telemetry("tengu_ultraplan_plan_ready")  // +12259220
                displayPlanToUser(sessionState.plan,
                    prefix: "Here is a draft plan to refine:")  // +12258849
                userChoice = await awaitUserApproval()
                if userChoice == "approved":
                    telemetry("tengu_ultraplan_approved")  // +12259640
                    return { outcome: "approved" }
                else:
                    return { outcome: "refined_locally" }

            case "needs_input":                        // +12250573
                telemetry("tengu_ultraplan_awaiting_input")  // +12259152
                userInput = await requestUserInput()
                sendInputToSession(sessionId, userInput)
                continue

            case "approved":                           // +12250181
            case "remote":                             // +12250253
                // Session already executing remotely
                displayMessage("Results will land as a pull request when the cloud session finishes. There is nothing to do here.")  // +12260130
                return { outcome: "running_remotely" }

            case "terminated":                         // +12250368
            case "session_error":                      // +8630782
                telemetry("tengu_ultraplan_failed")    // +12260529
                return error("Cloud ultraplan session failed. Wait for the user's next instructions.")  // +12260953

            case "poll_timeout":                       // +8630804
                // Elapsed time displayed in minutes   +12250703/+12250712
                elapsedMinutes = Math.round(elapsed / 60000)  // +12250675
                if elapsedMinutes == 1:
                    unit = "minute"
                else:
                    unit = "minutes"
                return error("timeout_no_plan",        // +12250929
                    f"Timed out after {elapsedMinutes} {unit}")

            case "requires_action":                    // +12250506
                // Pause and surface action to user
                pauseAndWait()

            case "network_or_unknown":                 // +12249794
                // Lost connection — retry with backoff
                if retryExhausted:
                    return error("network_error",
                        "Lost connection to the cloud session after repeated retries — the session may still be running")  // +12249868
                backoffAndRetry()

        sleep(pollingInterval)                         // uses setTimeout internally
```

Analysis basis: CC v2.1.187 bundle.js:+12258508, +12258542, +12258849, +12249794, +12249868, +12250181, +12250253, +12250368, +12250506, +12250558, +12250573, +12250675, +12250688, +12250703, +12250712, +12250911, +12250929, +12259072, +12259152, +12259220, +12259640, +12260130, +12260529, +12260953

---

### 7. Git Bundle Upload (`Rco`)

Packages the local git repository and uploads it to the cloud environment.

```
async function uploadGitBundle(branchInfo):
    telemetry("tengu_ccr_bundle_upload")               // +8590744

    // Verify git repo not empty
    refCount = git("for-each-ref", "--count=1", "refs/")  // +8590654, +8590669, +8590681
    if refCount == 0:
        // Try stash as fallback
        stashRef = git("stash", "create")             // +8590940, +8590948
        if failed:
            return { status: "empty_repo",             // +8590480
                     message: "Repository has no commits yet" }  // +8590862

    // Determine bundle mode                           telemetry +8607610
    // Priority: explicit_env_bundle > git_repository  +8607717, +8607770
    bundleMode = selectBundleMode()

    // Create seed refs for teleport
    git("update-ref", "refs/seed/stash", ...)         // +8590552
    git("update-ref", "refs/seed/root", ...)          // +8590570

    // Pack as .bundle file                            // +8591758
    bundleFile = createBundleFile("ccr-seed.bundle")  // +8591747

    // Upload bundle to pre-signed URL
    uploadResponse = await uploadToPresignedURL(bundleFile)

    if uploadResponse.status == 200:                   // +8591268
        // HEAD ref strategy: head > fallback_head > squashed > fallback_squashed
        return { status: "success",                    // +8592355
                 headStrategy: determineHeadStrategy() }
    else:
        return { status: "upload_failed" }             // +8592203
```

Analysis basis: CC v2.1.187 bundle.js:+8590451, +8590480, +8590552, +8590570, +8590654, +8590669, +8590744, +8590862, +8590940, +8590948, +8591268, +8591747, +8591758, +8592203, +8592355, +8607610

---

### 8. Environment Listing and Auto-Creation (`$ee` / `uat`)

Lists available cloud environments; if none exist, auto-creates a default.

```
async function listEnvironments(orgUUID, accessToken):
    telemetry("teleport_environments_list")             // +7211017
    // Timeout: 15 000 ms                              // +7211652
    response = await http.get(environmentsEndpoint, {
        timeout: 15000
    })
    return response.data.environments

async function createDefaultEnvironment(orgUUID):
    telemetry("teleport_default_environment_create")    // +7212073
    payload = {
        name:        "Default",                        // +7212048
        networkAccess: "Default - trusted network access",  // +7212518
        type:        "anthropic_cloud",                // +7212488
        homeDir:     "/home/user",                     // +7212594
        runtimes: [
            { name: "python", version: "3.11" },       // +7212656, +7212673
            { name: "node",   version: "20"   }        // +7212687, +7212702
        ]
    }
    response = await http.post(createEnvEndpoint, payload)
    return response.data
```

Analysis basis: CC v2.1.187 bundle.js:+7211017, +7211652, +7212048, +7212073, +7212488, +7212518, +7212594, +7212656, +7212673, +7212687, +7212702

---

### 9. GitHub App Installation Check (`R9e`)

Checks whether the GitHub App is installed on the repository before proceeding with bundle upload.

```
async function checkGithubAppInstalled(orgUUID, accessToken):
    if not accessToken:
        log("checkGithubAppInstalled: No access token found, assuming app not installed")  // +7213529
        return false

    if not orgUUID:
        log("checkGithubAppInstalled: No org UUID found, assuming app not installed")    // +7213642
        return false

    try:
        response = await http.get(githubAppCheckEndpoint)
        if response.status == 400:                     // +7214300
            return false
        isInstalled = response.data.installed
        log(f"GitHub App is {isInstalled ? 'is' : 'is not'} installed")  // +7214040, +7214045
        return isInstalled
    catch AxiosError:                                  // +7214246
        return false
```

Analysis basis: CC v2.1.187 bundle.js:+7213529, +7213642, +7214040, +7214045, +7214246, +7214300

---

### 10. Error Recovery and Orphan Session Cleanup

If an unexpected error occurs during launch, orphaned in-flight sessions are archived before surfacing the error to the user.

```
async function handleLaunchError(error, existingSessionId):
    // Classify error
    if error.name == "AbortError":                     // +182126
        return { kind: "cancelled" }

    if isAxiosError(error):                            // +183833
        return { kind: "network_error" }               // +8616962

    // Archive any orphaned session to prevent stuck state
    if existingSessionId:
        try:
            await archiveSession(existingSessionId)
        catch:
            log("ultraplan: failed to archive orphaned session")  // +12265473

    telemetry("tengu_ultraplan_create_failed")         // +12263013
    displayError("Ultraplan hit an unexpected error during launch. Wait for the user's next instructions.")
    // +12265312
    return { kind: "unexpected_error" }                // +12265140
```

Analysis basis: CC v2.1.187 bundle.js:+12263013, +12265140, +12265312, +12265473, +182126, +183833, +8616962

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_ultraplan_create_failed` | Fired when session creation fails (+12263013) |
| Telemetry: `tengu_ultraplan_prompt_identifier` | Fired with normalized prompt slug (+12258675) |
| Telemetry: `tengu_ultraplan_launched` | Fired on successful session launch (+12264720) |
| Telemetry: `tengu_ultraplan_timeout_seconds` | Records configured timeout value in seconds (+12258508) |
| Telemetry: `tengu_ultraplan_awaiting_input` | Fired when remote session needs user input (+12259152) |
| Telemetry: `tengu_ultraplan_plan_ready` | Fired when the cloud-drafted plan is surfaced (+12259220) |
| Telemetry: `tengu_ultraplan_approved` | Fired when user approves the plan (+12259640) |
| Telemetry: `tengu_ultraplan_failed` | Fired on remote session failure (+12260529) |
| Telemetry: `tengu_ccr_bundle_upload` | Fired during git bundle upload phase (+8590744) |
| Telemetry: `tengu_ccr_bundle_seed_enabled` | Signals seed-bundle mode is active (+7216025) |
| Telemetry: `tengu_teleport_bundle_mode` | Records which bundle strategy was chosen (+8607610) |
| Telemetry: `tengu_ccr_session_link` | Records cloud session URL/link (+8600716) |
| Telemetry: `tengu_teleport_source_decision` | Records repository source decision (+8613353) |
| Telemetry: `tengu_teleport_generate_title` | Fired when AI generates branch/title (+8594133) |
| `appState.allow_remote_sessions` | Read on entry to gate the command (+12265809) |
| `appState` read via `t.getAppState()` | Called to retrieve session-launch guards (+12266123) |
| `appState` write via `t.setAppState()` | Written at the end to persist session outcome (+12266345) |
| `appState.already_launching` / `already_polling` | Guards preventing duplicate session creation (+12263235, +12263253) |
| Hook registration (`Ei`) | `b6o.register` called during orchestrator setup (+67325) |
| git side effects | Creates `refs/seed/stash` and `refs/seed/root` refs; creates `ccr-seed.bundle` file; may delete `_source_seed.bundle` temp file (+8590552, +8590570, +8591747, +8592699) |
| Network: HTTP POST to sessions endpoint | Uses `anthropic-beta: ccr-byoc-2025-07-29` header and `x-organization-uuid` header (+8607260, +8607282) |
| Polling loop | Runs up to 5 400 seconds (90 minutes) with `setTimeout`-based backoff (+12258542) |
| Pull request delivery | On approved outcome, results land as a GitHub PR; no further local action required (+12260130) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.187 | Initial analysis |

---

## Common Mistakes

1. **Running without a Claude.ai login.** `/ultraplan` requires OAuth authentication via `/login`, not an API key. Running it with only an API key will fail at the `not_first_party` or `no_access_token` check.

2. **Missing GitHub remote.** The cloud agent must push results as a pull request. A git repository without `git remote add origin <REPO_URL>` will be rejected at the `no_git_remote` stage.

3. **Empty git repository.** A repository that has never had a commit (`git add . && git commit`) cannot produce a bundle. The error `empty_repo` is returned immediately.

4. **Invoking the command without a prompt.** The command expects a `<prompt>` argument or the word `ultraplan` somewhere in the user's message. Omitting both causes a usage-hint error to be shown.

5. **Triggering it twice while the session is still launching.** The `already_launching` guard returns an error rather than starting a second session. Wait for the first session to appear in the web UI.

6. **Organization policy blocks cloud sessions.** If the Anthropic organization policy has disabled remote sessions (`policy_blocked`), individual users cannot override this; an admin must enable it.

7. **No GitHub App installed.** If the Anthropic GitHub App is not installed on the target repository, the preflight check will block bundle upload. Install the app from `https://claude.ai/code`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Zpf` | Main async handler for `/ultraplan` (entry point, resolved via `load_ident`) |
| `Eqn` | Prompt normalization outer function (calls `yqn`) |
| `yqn` | Prompt extraction inner helper |
| `cAo` | Prompt text parser (regex match, push, slice) |
| `Js` | Telemetry / session state check utility |
| `nSi` | Telemetry wrapper (calls `Qz`) |
| `Qz` | Config reader (calls `cxt`, `Bme`) |
| `K9` | Config key resolver |
| `cxt` | File-based config loader (`readFileSync`, UTF-8) |
| `Bme` | Config value filter / inclusion checker |
| `Vi` | Session state accessor |
| `jns` | State field normalizer |
| `nt` | String coercion utility |
| `Lme` | String formatting helper |
| `pte` | App-state accessor passed into orchestrator |
| `Aqt` | Pre-launch eligibility orchestrator |
| `W` | React-style render / JSX helper |
| `Ve` | UI component wrapper |
| `rKe` | Base React element factory |
| `jLl` | User-facing message formatter |
| `L7n` | Launch guard / duplicate-session checker |
| `w7n` | In-flight session state reader |
| `it` | Session registry accessor (IW map) |
| `qpf` | Session registry helper |
| `Qpf` | Session orchestrator (teleport pipeline coordinator) |
| `Zle` | Remote eligibility wrapper |
| `dga` | Remote eligibility checker (git + GitHub) |
| `rs` | URL builder (VL, cd) |
| `VL` | Base URL selector (local/staging/prod) |
| `cd` | URL path joiner |
| `zpf` | Plan text builder (push + join with "Here is a draft plan to refine:") |
| `Kpf` | Plan prefix formatter |
| `P5` | Full session creation function (HTTP POST + all preconditions) |
| `Pt` | HTTP client wrapper (axios-based) |
| `Nl` | First-party provider checker |
| `Rh` | Auth token refresh function |
| `lBn` | Organization UUID resolver |
| `ke` | Error logging + telemetry helper |
| `_2` | Diagnostic state writer |
| `Ls` | OAuth URL validator / environment resolver |
| `YE` | HTTP header builder |
| `Rco` | Git bundle upload orchestrator |
| `kt` | Policy check helper |
| `T` | Log-level formatter (debug/warn/error) |
| `Pe` | React element factory (peer to `rKe`) |
| `lO` | Git remote URL getter (`git config --get remote.origin.url`) |
| `PUa` | Session payload builder (randomUUID, event structure) |
| `DFt` | Request deduplication guard |
| `Me` | JSON serialization wrapper |
| `ne` | Response parser (ee/te/A/v fields) |
| `DUa` | Session link displayer (tengu_ccr_session_link) |
| `FDn` | Feature-flag reader |
| `$ee` | Environment list fetcher (teleport_environments_list) |
| `uat` | Default environment creator (teleport_default_environment_create) |
| `be` | String coercion / display helper |
| `c` | Environment array mapper |
| `evp` | Title/branch generator (`claude/task`, `teleport_generate_title`) |
| `vU` | Session state registry writer |
| `R9e` | GitHub App installation checker |
| `ZR` | Branch detection (`symbolic-ref --short refs/remotes/origin/HEAD`) |
| `ys` | Polling interval scheduler |
| `goe` | Git remote URL parser (scheme detection: https/http) |
| `K` | Repository type classifier (cMe, zgl) |
| `se` | String trim / split helper |
| `fo` | Error construction utility |
| `IH` | Cancel-request classifier |
| `jH` | Timeout error handler |
| `gy` | Web environment URL resolver (local/staging/prod) |
| `oo` | Web socket / channel initializer |
| `o7r` | URL environment selector (D1t, wUd) |
| `Xpf` | Session abort controller |
| `e_e` | Remote agent session lifecycle manager |
| `OB` | Random-bytes token generator |
| `uut` | Session open/connect helper (`$ne.open`) |
| `aC` | Session timestamp tracker (`Date.now`) |
| `cvp` | Session context builder |
| `FUa` | Session poll loop (status watcher, hook events) |
| `Jx` | Background task dispatcher |
| `B9p` | Task retain/start message builder |
| `F9p` | Task update message builder |
| `cDn` | App state updater (`oHe.setState`) |
| `z_o` | Task state transition helper |
| `G9p` | Task-started handler |
| `W9p` | Task-updated handler |
| `Fce` | Task event classifier (user_typed, active, aborted) |
| `jpf` | Session poller (main polling loop, $Ll) |
| `$Ll` | Poll inner function (ingest, wke, timeout math) |
| `Gpf` | Polling session registry lookup |
| `Jpf` | Poll result display formatter |
| `g3t` | Session cleanup (unlink, sDo) |
| `o` | Column padding formatter (padEnd, map) |
| `O5` | Session status HTTP getter (ho.post, 10 000 ms timeout) |
| `Ei` | Hook registrar (`b6o.register`) |
| `Ypf` | Post-launch state updater |
| `Dt` | Config system initializer (Wt, MOo, _Ee) |
| `Wt` | Config root path resolver |
| `MOo` | Config mutex / lock |
| `_Ee` | Config file reader/writer (readFileSync, statSync, mkdirSync) |
| `Gt` | JSON parse wrapper |
| `u9` | Config value prefix stripper |
| `cn` | Config serializer |
| `HGl` | Backup directory scanner |
| `NOo` | Backup path builder (IS.join) |
| `l` | Path segment helper (JNl) |
| `f` | Background session worker (daemon main loop) |
| `D` | Child-process write wrapper |
| `Kn` | Timeout/abort helper (setTimeout, clearTimeout) |
| `Re` | Feature-ok telemetry emitter |
| `Le` | Feature-ok telemetry emitter (alternate path) |
| `GXn` | Low-memory check (`tengu_bg_low_mem_mb`) |
| `N2e` | Temp-file cleanup (gb.lstat, gb.rm, gb.readFile) |
| `U` | Daemon idle-exit timer (`tengu_daemon_idle_exit`) |
| `C3o` | Socket claim / connect handler |
| `x3o` | Session roster manager (state.json, qm.rm, qm.access) |
| `p` | Forced-shutdown handler (process.exit, u.abort) |
| `F` | Interval cleanup (clearInterval) |
| `MRf` | Config file watcher (mis.watchFile, _Gl.unwatchFile) |
| `fIt` | File-watch setup helper |
| `uV` | Config cache invalidator |
| `ugt` | Parallel preflight runner (Promise.all over lO, vU, cu, R9e) |