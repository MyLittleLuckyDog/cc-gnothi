---
type: feature-spec
feature: "ultraplan"
cc_version: "2.1.158"
updated: "2026-06-02"
tags: ["ultraplan", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.158 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultraplan`

> Analysis basis: CC v2.1.158 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.158

---

## Overview

`/ultraplan` launches a remote Claude Code web session that drafts a structured plan for a given prompt. The plan is surfaced back to the local CLI for the user to review, edit, and approve before execution continues. The command orchestrates authentication checks, git/repository preparation, remote environment provisioning, and a polling loop that tracks the remote session's lifecycle through states such as `pending`, `plan_ready`, `approved`, and `completed`.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultraplan` |
| description | `… Claude Code on the web drafts a plan you can edit and approve. See …` |
| argumentHint | `<prompt>` |
| load_inline | `true` |
| load_ident | `j45` |
| loc_byte | `11941527` |
| loc_byte_end | `11941771` |
| loc_line | `7793` |
| arbor_handler.name | `j45` |
| arbor_handler.fqn | `claude-2.1.158::j45` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `load_ident` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.158 bundle.js:+11941527

---

## Input Branching

The command has well over three distinct execution paths determined by authentication state, repository state, remote-session creation outcomes, and polling results. A Mermaid flowchart is therefore used.

```mermaid
flowchart TD
    A(["/ultraplan <prompt>"]) --> B{allow_remote_sessions\npolicy enabled?}
    B -- No --> ERR_POLICY["Error: policy_blocked\n(org policy disables remote sessions)"]
    B -- Yes --> C{User logged in\nwith Claude.ai account?}
    C -- No --> ERR_LOGIN["Error: not_logged_in\nPrompt: run /login"]
    C -- Yes --> D{Inside a git repo?}
    D -- No --> ERR_GIT["Error: not_in_git_repo"]
    D -- Yes --> E{GitHub remote\nreachable / app installed?}
    E -- No --> ERR_REMOTE["Error: no_git_remote or\ngithub_app_not_installed"]
    E -- Yes --> F{Already launching\nor polling?}
    F -- already_launching --> ERR_DUP["Abort: already launching,\nplease wait"]
    F -- already_polling --> ERR_POLL["Abort: already polling"]
    F -- No --> G[Run eligibility preflight\n(bg_remote_eligibility_check)]
    G --> H[Bundle & upload git state\n(teleport_git_bundle_upload)]
    H --> I[Provision / resolve\nremote cloud environment]
    I -- No environment --> ERR_ENV["Error: No environments available"]
    I -- Environment OK --> J[Create remote session via API\n(POST, expect 201)]
    J -- create_api_fail --> K[Fallback: refine local plan\n(teleport_null path)]
    J -- 401/403/429 --> ERR_AUTH["Error: auth / rate-limit"]
    J -- Session created --> L[Emit tengu_ultraplan_launched\nStart polling loop]
    L --> M{Poll remote session state}
    M -- pending / starting --> M
    M -- plan_ready --> N[Surface plan to user\nAwait approval]
    N -- approved --> O[Continue / delegate execution\nResults arrive as PR]
    N -- needs_input --> P[Prompt user for clarifying input]
    P --> M
    M -- completed --> Q[Session finished — show result]
    M -- terminated / archived --> ERR_TERM["Remote session ended early\nor exceeded 30 min"]
    M -- timeout_pending --> ERR_TIMEOUT["Timeout waiting for plan\n(timeout_no_plan)"]
    M -- requires_action --> R[Handle hook_progress /\nhook_response / hook_started]
    R --> M
    M -- error state --> ERR_SESS["unexpected_error\nwait for user instructions"]
    K --> S[Local plan refinement\n'Here is a draft plan to refine:']
    S --> T([End])
    O --> T
    Q --> T
```

Analysis basis: CC v2.1.158 bundle.js:+11939671 (handler entry), +11937186 (already_polling guard), +11937204 (already_launching guard), +11924625 (plan_ready state), +11924573 (requires_action state)

---

## Behavioral Spec

### 1. Handler Entry — `j45` (AsyncFunction)

The Arbor-resolved handler is `j45` (resolution path: `load_ident`).

```
async function ultraplanHandler(context):
    appState = context.getAppState()               // bundle.js:+11940006
    rawPrompt = extractPromptArgument(context)

    // Orphaned-session cleanup
    if previousOrphanedSession exists in appState:
        try archive orphanedSession
        catch: log "ultraplan: failed to archive orphaned session"  // +11939356

    // Policy gate
    if not appState.allow_remote_sessions:          // +11939692
        return error("policy_blocked",
            "Remote sessions are disabled by your organization's policy…")

    // Auth gate
    sessionInfo = getSessionInfo(context)           // calls N9 → +11939689
    if not sessionInfo.loggedIn:
        return error("not_logged_in",
            "Please run /login and sign in with your Claude.ai account…")  // +8939486

    // Identify prompt source ("slash" command invocation)
    invocationSource = "slash"                      // +11939817

    // Launch sequence (see launchUltraplanSession)
    result = await launchUltraplanSession(rawPrompt, sessionInfo, appState)

    context.setAppState(updatedState)              // +11940224
    return result
```

Analysis basis: CC v2.1.158 bundle.js:+11939671

---

### 2. Precondition Checks — `Kk6`

```
async function checkPreconditions(prompt, sessionInfo, appState):
    // Duplicate-launch guard
    if appState.ultraplanPolling == true:
        return { error: "already_polling" }         // +11937186
    if appState.ultraplanLaunching == true:
        return { error: "already_launching",        // +11937204
                 message: "ultraplan: already launching. Please wait…" }  // +11935798

    // Prompt validation
    if prompt is empty and "ultraplan" not present in context:
        return { error: "usage",
                 message: "Usage: /ultraplan <prompt>, or include \"ultraplan\" anywhere in your prompt" }
                                                    // +11937250

    // Git repository check
    gitInfo = await getGitRemoteInfo()              // calls sS → +11937393
    if not gitInfo.inRepo:
        return { error: "not_in_git_repo" }         // +8939565

    // GitHub remote check
    if not gitInfo.hasRemote:
        return { error: "no_git_remote",
                 message: "Background tasks require a GitHub remote…" }  // +8939725

    // GitHub App installation check
    appInstalled = await checkGithubAppInstalled(sessionInfo)  // calls J41 → +11936934
    if not appInstalled:
        return { error: "github_app_not_installed" }  // +8939820

    return { ok: true, gitInfo }
```

Analysis basis: CC v2.1.158 bundle.js:+11936934

---

### 3. Eligibility Preflight — `J41`

```
async function remoteEligibilityCheck(sessionInfo, gitInfo):
    emit telemetry("bg_remote_eligibility_check")   // +8937620

    // BYOC detection
    isByoc = sessionInfo.accountType == "byoc"      // +8937923

    // GitHub.com domain check
    isGithubDotCom = gitInfo.remoteUrl.includes("github.com")  // +8938211

    // Parallel checks via Promise.all                // +8937685
    results = await Promise.all([
        getRemoteSessionPermissions(sessionInfo),
        checkGitHubIntegration(gitInfo)
    ])

    return { eligible: results.every(r => r.ok), byoc: isByoc }
```

Analysis basis: CC v2.1.158 bundle.js:+8937550

---

### 4. Git Bundle Upload — `jB_`

```
async function teleportGitBundleUpload(gitInfo, sessionInfo):
    emit telemetry("tengu_ccr_bundle_upload")       // +8853763

    if not gitInfo.inRepo:
        throw Error("Not in a git repository")      // +8853531

    // Detect empty repo — check refs
    hasRefs = gitExec(["for-each-ref", "--count=1", "refs/"])  // +8853688
    if not hasRefs:
        throw Error("Repository has no commits yet")  // +8853877

    // Create stash
    stashResult = gitExec(["stash", "create"])      // +8853963
    if stashResult.status != 200:
        emit "stash_failed"                          // +8854401

    // Verify HEAD
    head = gitExec(["rev-parse", "--verify", "HEAD"])  // +8854307, +8854319, +8854330

    // Build bundle file path: <workdir>/ccr-seed.bundle  // +8854758, +8854769
    bundlePath = buildBundlePath("ccr-seed", ".bundle")

    // Upload bundle
    uploadResult = uploadBundleToRemote(bundlePath, sessionInfo)
    if uploadResult == "failed":
        emit "upload_failed"                         // +8855206
    else:
        emit "success"                               // +8855355
        // Record strategy: head / fallback_head / squashed / fallback_squashed
        // +8855419, +8855458, +8855493, +8855536

    // Cleanup seed bundle file
    fs.unlink(seedBundlePath)                        // calls PeH.unlink → +8855694
```

Analysis basis: CC v2.1.158 bundle.js:+8853441

---

### 5. Remote Environment Resolution — `Nl`

```
async function teleportToRemote(sessionInfo, bundleInfo, prompt):
    // Policy / access checks
    if orgPolicy.disablesRemote:
        throw Error("Remote sessions are disabled by your organization's policy.")  // +8867950

    if not sessionInfo.accessToken:
        throw Error("No access token found for remote session creation")  // +8868058

    orgUuid = await getOrgUuid(sessionInfo)         // +8868368
    if not orgUuid:
        throw Error("Unable to get organization UUID for remote session creation")

    // Determine bundle mode
    bundleMode = determineBundleMode(bundleInfo)    // emits tengu_teleport_bundle_mode +8869111
    // Modes: "bundle" | "explicit_env_bundle" | "git_repository" | "none"

    // Source decision telemetry
    emit("tengu_teleport_source_decision", { mode: bundleMode })  // +8874243

    // Build request headers
    headers = {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",          // +3152391
        "anthropic-beta": "ccr-byoc-2025-07-29",    // +8868707
        "x-organization-uuid": orgUuid              // +8868729
    }

    // Resolve or create cloud environment
    environments = await listEnvironments(sessionInfo)  // calls oa → +8870590
    if environments is empty:
        // Auto-create default environment
        newEnv = await createDefaultEnvironment(sessionInfo)  // calls DeH → +8870625
        log("[teleportToRemote] Auto-created default cloud env")  // +8870644
        if not newEnv:
            warn("Could not create a cloud environment. Set one up at https://claude.ai/code/onboarding?magic=env-setup")
                                                    // +8870802
            throw Error("No environments available for session creation")  // +8871822

    // Create session
    response = await POST("/sessions", {
        prompt,
        bundleMode,
        environment: selectedEnv,
        ...headers
    })

    if response.status not in [200, 201]:           // +8870025
        handle errors:
            401/403/429 → auth/rate-limit error     // +8870092, +8870096, +8870100
            github_repo_access_denied               // +8870142
            500 → server error                      // +8869989

    if not response.data.sessionId:
        throw Error("Server returned a malformed session response (no session id)")  // +8870447

    emit("tengu_ccr_session_link", sessionId)       // +8863518
    return { sessionId: response.data.sessionId, environment: selectedEnv }
```

Analysis basis: CC v2.1.158 bundle.js:+8867889

---

### 6. Remote Session Launch — `w45`

```
async function launchUltraplanSession(prompt, sessionInfo, appState):
    preconditions = await checkPreconditions(prompt, sessionInfo, appState)
    if preconditions.error:
        emit("tengu_ultraplan_create_failed", preconditions.error)  // +11936971
        return buildErrorResult(preconditions)

    // Mark state as launching
    appState.ultraplanLaunching = true

    // Generate title for the remote task
    titleInfo = await generateTaskTitle(prompt)     // calls QTL → +11938974
    // Title template: "claude/task" truncated to 75 chars  // +8856758, +8856764

    // Notification registration
    registerNotificationHook("task-notification")   // +11937951

    try:
        // Upload git bundle
        bundleResult = await teleportGitBundleUpload(gitInfo, sessionInfo)  // calls jB_ → +11938014

        // Create remote session (teleport)
        remoteSession = await teleportToRemote(sessionInfo, bundleResult, prompt)
                                                    // calls Nl → +11938039

        if remoteSession is null:
            // Fallback: local plan refinement
            localPlan = await generateLocalPlan(prompt)  // calls $45 → +11938014
            // Plan prefixed: "Here is a draft plan to refine:"  // +11932916
            emit("tengu_ultraplan_prompt_identifier", planHash)  // +11932742
            return { type: "plan", content: localPlan }

        // Mark as launched
        emit("tengu_ultraplan_launched")            // +11938641
        appState.ultraplanLaunching = false
        appState.ultraplanPolling = true

        // Open browser to remote session URL
        openBrowser(remoteSession.url)              // calls VhH/LeH → +11938739
        // Browser open uses random nonce (8 bytes)  // +12964467

        // Start polling
        pollResult = await pollRemoteSession(remoteSession.sessionId, appState)
                                                    // calls O45 → +11938904
        return pollResult

    catch error:
        if error.type == "create_api_fail":         // +11938330
            emit("tengu_ultraplan_create_failed", "create_api_fail")
            return localPlanFallback(prompt)        // "teleport_null" path  // +11938348
        emit("tengu_ultraplan_create_failed", "unexpected_error")  // +11939050
        // Message: "Ultraplan hit an unexpected error during launch…"  // +11939208
        return errorResult
    finally:
        appState.ultraplanLaunching = false
```

Analysis basis: CC v2.1.158 bundle.js:+11937695 (kXH → w45 entry)

---

### 7. Remote Session Polling — `O45` / `Og1`

```
async function pollRemoteSession(sessionId, appState):
    startTime = Date.now()                          // +11933053
    maxDurationMs = 5400 * 1000  // 90 minutes     // +11932609 (value 5400)
    timeoutPendingMs = 60000     // 1 minute for initial pending  // +11924755

    emit("tengu_ultraplan_timeout_seconds", maxDurationMs / 1000)  // +11932575

    while true:
        elapsed = Date.now() - startTime
        if elapsed > maxDurationMs:
            emit("tengu_ultraplan_failed", "remote session exceeded 30 minutes")  // +8948704
            return { error: "timeout" }

        sessionData = await fetchSessionStatus(sessionId)  // inner poll via Og1 → +11933139

        switch sessionData.status:
            case "pending", "starting":
                if elapsed > timeoutPendingMs:
                    emit("tengu_ultraplan_failed", "timeout_pending")  // +11924978
                    return { error: "timeout_no_plan" }  // +11924996
                await sleep(pollingInterval)
                continue

            case "plan_ready":                      // +11924625
                emit("tengu_ultraplan_plan_ready")  // +11933287
                // Surface plan to user for editing
                planContent = extractPlan(sessionData)
                approval = await awaitUserApproval(planContent)
                if approval == "approved":
                    emit("tengu_ultraplan_approved") // +11933695
                    // Message: "Results will land as a pull request when the remote session finishes."  // +11934181
                    return { type: "approved", sessionId }

            case "needs_input":                     // +11924640
                emit("tengu_ultraplan_awaiting_input")  // +11933219
                userInput = await promptUserForInput()
                sendInputToSession(sessionId, userInput)
                continue

            case "requires_action":                 // +11924573
                handleHookEvent(sessionData)         // hook_progress / hook_response / hook_started
                continue

            case "completed":
                return { type: "completed", result: sessionData.result }

            case "terminated", "archived":          // +8946506
                emit("tengu_ultraplan_failed", "remote session returned an error")  // +8948663
                // Message: "Remote Ultraplan session failed. Wait for the user's next instructions."  // +11934975
                return { error: "terminated" }

            case "error":
                emit("tengu_ultraplan_failed", "unexpected_error")
                return { error: "unexpected_error" }

        await sleep(pollingInterval)                // polling interval ~1000ms  // +8946055
```

Analysis basis: CC v2.1.158 bundle.js:+11933043 (O45), +11923435 (Og1)

---

### 8. Local Plan Fallback — `$45`

When the remote session creation returns null (the `teleport_null` path), the command falls back to local plan generation.

```
function buildLocalPlanFallback(prompt, draftPlan):
    parts = []
    parts.push("Here is a draft plan to refine:")   // +11932916
    refinedContent = generateLocalRefinement(draftPlan)  // calls M45/K45 → +11932969
    parts.push(refinedContent)
    finalText = parts.join("\n")                    // +11932999
    emit("tengu_ultraplan_prompt_identifier", hashOf(finalText))  // +11932742
    return { type: "plan", content: finalText }
```

Analysis basis: CC v2.1.158 bundle.js:+11932909

---

### 9. Prompt Normalization — `OT8` / `Nd_` / `$T8`

```
function normalizePrompt(rawInput):
    // Strip "ultraplan" keyword from prompt text (case-insensitive, global)
    cleaned = rawInput.replace(/ultraplan/gi, "")  // literal "gi" +9683819, "ultraplan" +9684171
    // Collapse whitespace artifact left by removal: pattern "$1$2"  // +9684497
    cleaned = cleaned.replace(collapsePattern, "$1$2")
    // Trim to max 5 words of leading context if needed  // +9684520
    return cleaned.slice(relevantStart)             // +9684400
```

Analysis basis: CC v2.1.158 bundle.js:+9684372

---

### 10. Session Eligibility / Account Type — `N9`

```
async function resolveSessionEligibility(context):
    // Check feature flags
    featureFlags = readFeatureFlags()               // calls ww6/Dw6 → +4108078
    // Relevant flags: "firstParty" | "enterprise" | "team"  // +4107438, +4107711, +4107746
    // Encoding: utf-8  // +4107819

    // Check allow_product_feedback and allow_remote_sessions
    remoteAllowed = featureFlags.allow_remote_sessions  // +11939692
    productFeedback = featureFlags.allow_product_feedback  // +4107987

    // Membership cache check
    if membershipCache.has(orgId):                  // calls YP7.has → +4107956
        return membershipCache.get(orgId)

    return { allowed: remoteAllowed, flags: featureFlags }
```

Analysis basis: CC v2.1.158 bundle.js:+4107940

---

### 11. Default Cloud Environment Creation — `DeH`

```
async function createDefaultCloudEnvironment(sessionInfo):
    emit("teleport_default_environment_create")     // +8822224
    if not sessionInfo.accessToken:
        throw Error("No access token available")    // +8822317

    payload = {
        name: "Default",                           // +8822199
        type: "anthropic_cloud",                   // +8822519
        description: "Default - trusted network access",  // +8822549
        provider: "anthropic",                     // +8822609
        homePath: "/home/user",                    // +8822625
        runtime: { python: "3.11", node: "20" }   // +8822687, +8822704, +8822718, +8822733
    }

    response = await c_.post("/environments", payload, headers)
    return response.data
```

Analysis basis: CC v2.1.158 bundle.js:+8822221

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — ultraplan-specific | `tengu_ultraplan_create_failed` (+11936971), `tengu_ultraplan_prompt_identifier` (+11932742), `tengu_ultraplan_launched` (+11938641), `tengu_ultraplan_timeout_seconds` (+11932575), `tengu_ultraplan_awaiting_input` (+11933219), `tengu_ultraplan_plan_ready` (+11933287), `tengu_ultraplan_approved` (+11933695), `tengu_ultraplan_failed` (+11934568) |
| Telemetry — CCR / teleport | `tengu_ccr_bundle_seed_enabled` (+8938015), `tengu_ccr_bundle_upload` (+8853763), `tengu_teleport_bundle_mode` (+8869111), `tengu_ccr_session_link` (+8863518), `tengu_teleport_source_decision` (+8874243) |
| Telemetry — background dispatch | `tengu_bg_dispatch_sigkill_escalate` (+15467649), `tengu_bg_low_mem_mb` (+12729562), `tengu_bg_dispatch_low_mem` (+15468228), `tengu_bg_spare_enable` (+15468923), `tengu_bg_spare_claim` (+15469044), `tengu_bg_spare_spawn` (+15467342), `tengu_bg_spare_claim_fail` (+15469307), `tengu_bg_sendclaim_failed` (+15448378) |
| Telemetry — misc | `tengu_config_parse_error` (+3210888), `tengu_feature_bad` (+966091), `tengu_feature_ok` (+966033) |
| appState changes | Sets `ultraplanLaunching = true` during launch, resets to `false` in finally block; sets `ultraplanPolling = true` when polling begins; cleaned via `_.setAppState` (+11940224) |
| Hook registration | Registers `task-notification` hook at launch (+11937951); registers notification hooks via `q9` → `qOA.register` (+58858) |
| File system | Writes a git bundle file `ccr-seed.bundle` (+8854758, +8854769), a `_source_seed.bundle` (+8855061), and a remote-session link file; cleans up with `PeH.unlink` (+8855694), `M7.unlink`, `gY.unlink`, and `WVK.unlinkSync` |
| Browser | Opens the remote Claude Code web session URL via `LeH` → `At.open` (+12963385) using an 8-byte random nonce (+12964467) |
| Polling interval | 1000 ms between status checks (+8946055) |
| Max remote session duration | 1 800 000 ms (30 minutes, hardcoded) (+8946062) |
| Max total polling window | 5400 seconds (90 minutes) (+11932609) |
| Pending timeout | 60 000 ms before emitting `timeout_pending` (+11924755) |
| Error retry on HTTP creation | Retries with 10 000 ms delay on 409 Conflict (+8877058, +8877259); waits 1500 ms before unexpected-error fallback (+11938982) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.158 | Initial analysis |

---

## Common Mistakes

1. **Invoking without a Claude.ai login**: `/ultraplan` requires OAuth authentication with a Claude.ai account — not an API key. Running the command while authenticated only via API key produces the `not_logged_in` error with the message `"Please run /login and sign in with your Claude.ai account (not Console)."` (+8939486).
2. **Running outside a git repository**: The command requires a git repository with at least one commit and a GitHub remote. An empty directory or a repo with no commits triggers `not_in_git_repo` or the `"Repository has no commits yet"` error (+8853877).
3. **Missing GitHub remote**: Even inside a git repo, the absence of a remote URL (specifically one pointing to `github.com`) blocks launch with `no_git_remote` (+8939703). Add one with `git remote add origin REPO_URL`.
4. **GitHub App not installed**: The Anthropic GitHub App must be installed on the target repository's organization. Without it, the eligibility check fails at `github_app_not_installed` (+8939820) and directs users to `https://claude.ai/code`.
5. **Triggering while a session is already launching**: Invoking `/ultraplan` again before the previous launch completes results in the `already_launching` guard firing (+11937204) with the message `"ultraplan: already launching. Please wait for the session to start."` (+11935798).
6. **Organization policy restrictions**: Enterprise or team accounts may have `allow_remote_sessions` disabled at the organization level. This cannot be overridden locally; the org admin must enable the policy (+8939997).
7. **Expecting immediate results in the local terminal**: Once `approved`, results are delivered as a pull request on GitHub, not as inline CLI output. The message `"Results will land as a pull request when the remote session finishes. There is nothing to do here."` (+11934181) confirms this behavior.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `j45` | Main `ultraplan` async handler (Arbor-resolved entry point) |
| `OT8` | Prompt text normalization wrapper |
| `$T8` | Prompt-cleaning inner function |
| `Nd_` | Regex-based "ultraplan" keyword stripper |
| `N9` | Session eligibility / account-type resolver |
| `o89` | Feature-flag loader |
| `ww6` | Feature-flag aggregator |
| `QR` | Membership/plan type classifier |
| `Dw6` | Config file reader (readFileSync, utf-8) |
| `c4H` | Permission/inclusion checker |
| `L1` | Local config access wrapper |
| `$VA` | Config value accessor |
| `CH` | String conversion utility |
| `gKH` | String coercion helper |
| `W5H` | App-state accessor for remote-session flags |
| `Kk6` | Precondition-check orchestrator |
| `d` | Logging / debug emitter |
| `L` | Promise finalizer / task-set manager |
| `Pg1` | UI progress / spinner control |
| `uI8` | Git-remote info wrapper |
| `xI8` | Git command executor (inner) |
| `G6` | Git process spawner |
| `L45` | Git output parser |
| `w45` | Launch orchestrator (bundles, teleport, polling) |
| `kXH` | Entry delegator from `w45` to remote-session creation |
| `J41` | Remote eligibility preflight check |
| `$45` | Local plan fallback builder |
| `M45` | Local plan refinement generator |
| `Nl` | `teleportToRemote` — remote environment resolution & session creation |
| `h6` | Async task context helper |
| `IO` | HTTP client wrapper |
| `GB_` | Bearer-token / auth-header builder |
| `SH` | Error-log and notification emitter |
| `eb` | API response error handler |
| `kq` | OAuth endpoint resolver |
| `EX` | HTTP header injector |
| `jB_` | `teleportGitBundleUpload` — git bundle creation and upload |
| `I6` | UUID/identifier generator |
| `N` | Structured log formatter |
| `sS` | Git remote URL resolver (runs `git config --get remote.origin.url`) |
| `uK1` | Control-event builder (set_permission_mode, randomUUID) |
| `RH` | JSON serializer wrapper |
| `xK1` | Session link recorder |
| `oa` | `listEnvironments` API caller |
| `DeH` | `createDefaultEnvironment` API caller |
| `EH` | String coercion (Number → String) |
| `QTL` | Task-title generator (truncates to 75 chars, schema: title + branch) |
| `Cy` | Context/model state reader |
| `YhH` | `checkGithubAppInstalled` |
| `PN` | Default-branch resolver (symbolic-ref / main / master) |
| `J9` | Notification dispatch helper |
| `Ge` | Git remote URL parser (https / http / git scheme) |
| `F_` | Error-message extractor |
| `tj` | Cancellation check helper |
| `kz` | Abort-signal handler |
| `jw` | Claude.ai base URL resolver (local / staging / prod) |
| `Z_` | Module initializer / exports setter |
| `NG_` | Environment URL picker (localhost / staging / prod) |
| `Y45` | Boolean flag toggle |
| `VhH` | Browser-open orchestrator for remote session URL |
| `gI` | Random-nonce generator (8 random bytes) |
| `LeH` | Shell `open` / browser launcher |
| `Z2` | Pending-state poller with timestamp |
| `ZZL` | Session status stringifier |
| `G41` | Remote session status poller (1000 ms interval, 1 800 000 ms max) |
| `Ak` | Background-task roster manager |
| `bSL` | Task-start event emitter (`task_started`) |
| `RSL` | Task-update event emitter (`task_updated`) |
| `Gd_` | Task-state persister |
| `xSL` | Task timestamp recorder |
| `uSL` | Task metadata updater |
| `kAH` | Task-state classifier (user_typed / active / aborted) |
| `O45` | Polling loop controller / state-machine dispatcher |
| `Og1` | Single-poll fetch and ingestion |
| `q45` | Session-config initializer |
| `D45` | Polling delay helper |
| `CZ6` | Session cleanup (unlink + rm) |
| `K` | Column formatter (padEnd) |
| `Km` | Session heartbeat / keepalive POST |
| `q9` | Notification hook registrar |
| `z45` | Orphaned-session archiver |
| `S6` | Claude config reader / watcher |
| `szH` | Config file parser and directory initializer |
| `p6` | JSON.parse wrapper |
| `Qb` | Config key prefix stripper |
| `J8` | Structured-log sink |
| `RFq` | Config backup/restore file resolver |
| `fY_` | Backup directory path builder |
| `w` | Background-process supervisor (spawn / SIGKILL / freemem) |
| `S` | Supervisor process writer |
| `bH` | Feature-flag "bad" reporter |
| `hH` | Feature-flag "ok" reporter |
| `By8` | macOS memory-pressure checker |
| `fw6` | Conversation history file reader |
| `B` | MCP-tool filter (filters `mcp__` prefix tools) |
| `jfA` | Background-process IPC claim/connect |
| `ZfA` | Background-task lifecycle manager (spawn, retire, rm) |
| `D` | Background-process disposer |
| `m17` | Config file watcher (watchFile / unwatchFile) |
| `Vr` | Config-change diffing helper |
| `X_6` | Parallel session + model state initializer |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.