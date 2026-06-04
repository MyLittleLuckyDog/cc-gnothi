---
type: feature-spec
feature: "ultraplan"
cc_version: "2.1.162"
updated: "2026-06-04"
tags: ["ultraplan", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.162 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultraplan`

> Analysis basis: CC v2.1.162 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.162

---

## Overview

`/ultraplan` launches a remote Claude Code web session that drafts an implementation plan the user can review, edit, and approve before any code is executed. The command teleports the current repository state to a sandboxed cloud environment, runs a planning agent there, streams status back to the local CLI, and surfaces the resulting plan for interactive refinement. Upon user approval, the remote session proceeds to execution and eventually delivers results as a pull request.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultraplan` |
| description | `" ... · Claude Code on the web drafts a plan you can edit and approve. See ..."` |
| argumentHint | `<prompt>` |
| load_inline | `true` |
| load_ident | `DZf` |
| loc_byte | `12153247` |
| loc_byte_end | `12153491` |
| loc_line | `8464` |
| arbor_handler.name | `DZf` |
| arbor_handler.fqn | `claude-2.1.162::DZf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `load_ident` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.162 bundle.js:+12153247

---

## Input Branching

The command has more than three distinct input-handling branches (precondition checks, launch-state guards, prompt-detection, plan-approval flow, error paths). A Mermaid flowchart is used below.

```mermaid
flowchart TD
    A(["/ultraplan <prompt>"]) --> B{allow_remote_sessions\npolicy enabled?}
    B -- No --> ERR_POLICY["Error: policy_blocked\n'Remote sessions disabled by org policy'"]
    B -- Yes --> C{User logged in\nvia Claude.ai account?}
    C -- No --> ERR_LOGIN["Error: not_logged_in\n'Please run /login …'"]
    C -- Yes --> D{Inside a git repo?}
    D -- No --> ERR_GIT["Error: not_in_git_repo"]
    D -- Yes --> E{GitHub remote\npresent?}
    E -- No --> ERR_REMOTE["Error: no_git_remote\n'Background tasks require a GitHub remote'"]
    E -- Yes --> F{GitHub App\ninstalled?}
    F -- No --> ERR_APP["Error: github_app_not_installed"]
    F -- Yes --> G{Already\nlaunching/polling?}
    G -- already_launching --> ERR_BUSY["Error: 'ultraplan: already launching. Please wait…'"]
    G -- already_polling --> ERR_BUSY2["Error: already_polling"]
    G -- No --> H{Prompt contains\n'ultraplan' keyword\nor explicit arg?}
    H -- No prompt --> ERR_USAGE["Error: 'Usage: /ultraplan <prompt>, or include \"ultraplan\" anywhere in your prompt'"]
    H -- Valid prompt --> I[Resolve environment\n(env-select phase)]
    I --> J[Upload git bundle\n(bundle-upload phase)]
    J --> K[POST session creation\nto remote API]
    K --> L{API response}
    L -- 201 Created --> M[Begin polling loop\n(remote_agent)]
    L -- 401/403/429 --> ERR_AUTH["Error: create_request_failed"]
    L -- 409 Conflict --> ERR_CONFLICT["Retry / back-off"]
    L -- Other error --> ERR_CREATE["Error: create_api_fail / teleport_null"]
    M --> N{Poll result state}
    N -- plan_ready --> O["Display plan to user\n'Here is a draft plan to refine:'"]
    N -- needs_input --> P[Await user input]
    N -- running/starting --> M
    N -- completed --> Q[Inject result message\n'Results will land as a pull request'"]
    N -- failed/archived --> ERR_FAIL["Error: Remote Ultraplan session failed"]
    N -- timeout (>30 min) --> ERR_TIMEOUT["Error: remote session exceeded 30 minutes"]
    N -- requires_action --> R[Surface action request\nto local UI]
    O --> S{User decision}
    S -- Approve --> T["tengu_ultraplan_approved\nContinue remote execution"]
    S -- Edit --> O
    S -- Reject --> U[Terminate / archive session]
    T --> Q
```

---

## Behavioral Spec

### 1. Handler Entry — `asyncUltraplanHandler` (bundle ident: `DZf`)

Analysis basis: CC v2.1.162 bundle.js:+12151387

```
async function asyncUltraplanHandler(input, appContext):
    # Check remote-sessions policy gate
    if appState does NOT have "allow_remote_sessions":
        return error("policy_blocked")

    # Invoke eligibility checker (W9 / eligibilityCheck)
    eligibilityResult = await checkRemoteEligibility(appContext)
    if eligibilityResult.error:
        return eligibilityResult   # propagates not_logged_in, no_git_remote, etc.

    # Read current appState
    state = appContext.getAppState()

    # Determine prompt text
    promptText = extractPromptText(input)   # calls PV8 / normalizePromptText

    # Route to launch orchestrator (Qh6 / ultraplanLaunchOrchestrator)
    result = await ultraplanLaunchOrchestrator(promptText, state, appContext)

    # Update appState with session outcome
    appContext.setAppState(result)
```

Analysis basis: CC v2.1.162 bundle.js:+12151722

---

### 2. Prompt Normalization — `normalizePromptText` (bundle ident: `PV8`)

Analysis basis: CC v2.1.162 bundle.js:+9870418

```
function normalizePromptText(rawInput):
    # Delegate to command-prefix stripper (XV8 / stripCommandPrefix)
    stripped = stripCommandPrefix(rawInput)

    # Remove leading slash-command token (slice off first N chars)
    base = stripped.slice(...)

    # Collapse whitespace runs: pattern "$1$2" with limit 5
    normalized = base.replace(whitespacePattern, "$1$2")

    return normalized
```

The string constant `"ultraplan"` appears at bundle.js:+9870218, used inside `stripCommandPrefix` (`XV8` → `Pr_`) to match the command keyword via a case-insensitive global regex (`"gi"` flag at +9869866). A truncation limit of `40` characters applies to display-label generation (bundle.js:+16022362).

Analysis basis: CC v2.1.162 bundle.js:+9870446, +9870517, +9870543

---

### 3. Remote Eligibility Check — `checkRemoteEligibility` (bundle ident: `W9`)

Analysis basis: CC v2.1.162 bundle.js:+4161570

```
async function checkRemoteEligibility(appContext):
    # Check account type (FK9 / resolveAccountKind)
    accountKind = resolveAccountKind(appContext)
    # Accepted kinds: "firstParty", "enterprise", "team"

    # Lookup sets: yuL (allowed), huL (blocked)
    if sessionId in blockedSet(huL):
        return error("policy_blocked")
    if sessionId NOT in allowedSet(yuL):
        return error(...)

    # Feature-flag check (wq / checkTelemetryConsent)
    if telemetryMode is "no-telemetry" or "essential-traffic":
        # adjust consent flag; default = "allow_product_feedback"
        ...

    # Product-feedback / remote-sessions flag
    allowed = appState.includes("allow_remote_sessions")

    # Read CLAUDE.md / config file (vj6 / readConfigFile → UK9.readFileSync, utf-8)
    config = readConfigFile(utf8)

    # Validate feature flags (ULH / validateFeatureFlags)
    flags = validateFeatureFlags(config)
    # checks: JJ1, A.some, _.includes, cdH

    if flags.allow_remote_sessions is false:
        return { ok: false, reason: "policy_blocked" }

    return { ok: true }
```

Key string literals used in this phase:

| Literal | Location |
|---|---|
| `"firstParty"` | bundle.js:+4161068 |
| `"enterprise"` | bundle.js:+4161341 |
| `"team"` | bundle.js:+4161376 |
| `"allow_product_feedback"` | bundle.js:+4161642 |
| `"allow_remote_sessions"` | bundle.js:+12151408 |
| `"no-telemetry"` | bundle.js:+1012337 |
| `"essential-traffic"` | bundle.js:+1012278 |

---

### 4. Launch Orchestrator — `ultraplanLaunchOrchestrator` (bundle ident: `Qh6`)

Analysis basis: CC v2.1.162 bundle.js:+12148626

```
async function ultraplanLaunchOrchestrator(prompt, state, appContext):
    # Re-run eligibility (W9)
    eligibility = await checkRemoteEligibility(appContext)

    if state.launching:
        emit telemetry("tengu_ultraplan_create_failed", reason="already_launching")
        return error("ultraplan: already launching. Please wait for the session to start.")

    if state.polling:
        return error(reason="already_polling")

    # Usage guard — prompt must be present
    if NOT prompt:
        return error(
            "Usage: /ultraplan <prompt>, or include \"ultraplan\" anywhere\nin your prompt"
        )

    # Set D5H (appState launching flag)
    appContext.setLaunchingFlag(true)   # D5H

    # Register abort/cleanup handler (L / registerCleanup)
    cleanup = registerCleanup(...)

    # Run bg-eligibility deep-check (LS8 → KS8 → j6 / backgroundEligibilityCheck)
    bgCheck = await backgroundEligibilityCheck(appContext)

    # Run teleport flow (zZf / runTeleportFlow)
    teleportResult = await runTeleportFlow(prompt, bgCheck, appContext)

    if teleportResult.error:
        emit telemetry("tengu_ultraplan_create_failed", reason=teleportResult.reason)
        return error(teleportResult.message)

    # Archive orphaned prior session if present (MZf)
    archiveOrphanedSession(appContext)

    return teleportResult
```

Analysis basis: CC v2.1.162 bundle.js:+12148661, +12148885, +12148903, +12148950

---

### 5. Background Eligibility Deep-Check — `backgroundEligibilityCheck` (bundle ident: `J3q`)

Analysis basis: CC v2.1.162 bundle.js:+9064635

This function performs the full set of precondition checks for remote background task support:

```
async function backgroundEligibilityCheck(appContext):
    emit telemetry("bg_remote_eligibility_check")

    checks = await Promise.all([
        checkLoginStatus(appContext),        # → not_logged_in
        checkGitRepo(appContext),            # → not_in_git_repo
        checkGitRemote(appContext),          # → no_git_remote / no_git_at_all
        checkGithubAppInstalled(appContext), # → github_app_not_installed
        checkOrgPolicy(appContext),          # → policy_blocked
        checkByocFlag(appContext),           # → byoc
    ])

    for check in checks:
        if check.failed:
            return { ok: false, reason: check.reason, message: check.message }

    return { ok: true }
```

Error messages emitted from this phase:

| Reason Code | Message |
|---|---|
| `not_logged_in` | `"Please run /login and sign in with your Claude.ai account (not Console)."` |
| `not_in_git_repo` | *(no git repo detected)* |
| `no_git_remote` | `"Background tasks require a GitHub remote. Add one with \`git remote add origin REPO_URL\`."` |
| `github_app_not_installed` | *(GitHub App installation not detected)* |
| `policy_blocked` | `"Remote sessions are disabled by your organization's policy. Contact your organization admin to enable them."` |

Analysis basis: CC v2.1.162 bundle.js:+9066563, +9066664, +9066802, +9066919, +9067073, +9067096

---

### 6. Teleport Flow — `runTeleportFlow` (bundle ident: `zZf`)

Analysis basis: CC v2.1.162 bundle.js:+12149395

```
async function runTeleportFlow(prompt, bgCheck, appContext):
    # Phase: precondition
    preconditionResult = await runPreconditions(bgCheck)   # _2H → J3q
    if preconditionResult.failed:
        return preconditionResult

    # Phase: env-select (el / teleportToRemote)
    envSelection = await teleportToRemote(appContext)
    log("[teleport] phase: env-select")

    # Phase: build session-link UUID (u$q)
    sessionLink = buildSessionLink()   # sd_.randomUUID

    # Phase: bundle-upload (od_ / teleportGitBundleUpload)
    bundleResult = await teleportGitBundleUpload(appContext)
    log("[teleport] phase: bundle-upload")
    emit telemetry("tengu_teleport_bundle_mode", mode=bundleResult.mode)
    emit telemetry("tengu_teleport_source_decision", ...)

    # Phase: POST-sent — call remote session creation API
    log("[teleport] phase: POST-sent")
    sessionResponse = await createRemoteSession(prompt, envSelection, bundleResult)

    # Phase: branch-detect
    log("[teleport] phase: branch-detect")
    branchName = await detectOrGenerateBranch(prompt)   # zQ7

    # Register task-notification hook (J9 / registerTaskNotification)
    registerHook("task-notification")

    # Launch remote-agent poller ($RH / remoteAgentPoller)
    pollerResult = await remoteAgentPoller(sessionResponse.sessionId, appContext)

    # Handle plan-ready state
    if pollerResult.state == "plan_ready":
        emit telemetry("tengu_ultraplan_plan_ready")
        planText = pollerResult.plan
        refinedPlan = await displayPlanForRefinement(planText)   # LZf

    # Handle approval
    if refinedPlan.approved:
        emit telemetry("tengu_ultraplan_approved")
        notifyAgent("approved")
        return {
            message: "Results will land as a pull request when the remote session finishes. There is nothing to do here."
        }

    if pollerResult.state == "failed":
        emit telemetry("tengu_ultraplan_failed")
        return { message: "Remote Ultraplan session failed. Wait for the user's next instructions." }

    return pollerResult
```

Analysis basis: CC v2.1.162 bundle.js:+12149478, +12149655, +12149798, +12149833, +12150034, +12150052, +12150335

---

### 7. Plan Refinement Display — `buildPlanRefinement` (bundle ident: `LZf`)

Analysis basis: CC v2.1.162 bundle.js:+12144593

```
function buildPlanRefinement(planText):
    lines = []
    lines.push("Here is a draft plan to refine:")
    lines.push(...formatPlanLines(planText))   # KZf → _Zf

    # Pad entries and join
    formatted = lines.join(...)

    return {
        label: "Refine local plan",
        kind: "plan",
        content: formatted
    }
```

The header string `"Here is a draft plan to refine:"` is a literal at bundle.js:+12144600. The display label `"Refine local plan"` appears at bundle.js:+12149798.

---

### 8. Remote Agent Poller — `remoteAgentPoller` (bundle ident: `$RH`)

Analysis basis: CC v2.1.162 bundle.js:+9071473

```
async function remoteAgentPoller(sessionId, appContext):
    # Generate opaque token (Ok → _fK.randomBytes, 8 bytes)
    token = randomBytes(8)

    # Open IPC channel (L66 → _e.open)
    channel = openChannel(sessionId, token)

    # Record start time
    startTime = Date.now()
    emit telemetry("tengu_ultraplan_timeout_seconds", timeout=5400)
    # Maximum polling duration: 5400 seconds (90 minutes) internally tracked
    # but session hard-limit message says 30 minutes (bundle.js:+9075803)

    # Polling loop (W3q / pollRemoteSession)
    while true:
        update = await pollRemoteSession(sessionId, channel)

        switch update.state:
            case "running":
            case "starting":
                continue polling
            case "plan_ready":
                emit telemetry("tengu_ultraplan_plan_ready")
                return { state: "plan_ready", plan: update.plan }
            case "needs_input":
                emit telemetry("tengu_ultraplan_awaiting_input")
                return { state: "needs_input", data: update }
            case "completed":
                return { state: "completed" }
            case "failed":
            case "archived":
                return { state: "failed", error: update.error }
            case "terminated":
                return { state: "terminated" }
            case "requires_action":
                return { state: "requires_action", action: update.action }

        elapsed = Date.now() - startTime
        if elapsed > sessionTimeoutMs:   # 1800000 ms = 30 min (bundle.js:+9073161)
            return { state: "timeout", message: "remote session exceeded 30 minutes" }
```

Polling interval base: `1000` ms (bundle.js:+9073154). Hard timeout message at bundle.js:+9075803.

---

### 9. Session Poller Core — `pollRemoteSession` (bundle ident: `W3q`)

Analysis basis: CC v2.1.162 bundle.js:+9073300

```
async function pollRemoteSession(sessionId, channel):
    # Phase markers tracked: running, starting, completed, archived,
    #   remote-workflow, hook_progress, hook_response, idle,
    #   hook_started, SessionStart

    response = await fetchSessionStatus(sessionId)   # oPH
    serialized = serialize(response)   # SH / JSON.stringify

    lastMessage = response.messages.findLast(m => m.role == "assistant")

    if response.state == "completed":
        # find result message
        resultMsg = response.messages.find(m => m.type == "result")
        return { state: "completed", result: resultMsg }

    if response.state == "archived":
        return { state: "archived" }

    if elapsedSinceLastActivity > 1800000:
        return { state: "timeout" }

    if response.hookState:
        handleHookEvents(response.hookState)   # nQ7, cQ7, lQ7

    # Accumulate progress messages (P3q)
    progressMessages = accumulateProgress(response)

    if response.state == "idle":
        setTimeout(nextPoll, interval)   # z / scheduleNextPoll
    
    return { state: response.state, messages: progressMessages }
```

---

### 10. Git Bundle Upload — `teleportGitBundleUpload` (bundle ident: `od_`)

Analysis basis: CC v2.1.162 bundle.js:+8978917

```
async function teleportGitBundleUpload(appContext):
    emit telemetry("tengu_ccr_bundle_upload")

    # Verify git repo
    if NOT inGitRepo():
        return { ok: false, reason: "empty_repo", message: "Not in a git repository" }

    # Clean seed refs
    git("update-ref", "-d", "refs/seed/stash")
    git("update-ref", "-d", "refs/seed/root")

    # Count existing refs
    refCount = git("for-each-ref", "--count=1", "refs/")
    if refCount == 0:
        # Attempt stash creation
        stashResult = git("stash", "create")
        if stashResult.status != 200:
            return { ok: false, reason: "stash_failed" }

    # Determine bundle mode (head | fallback_head | squashed | fallback_squashed)
    mode = determineBundleMode(appContext)

    # Create bundle file: "ccr-seed.bundle" or "_source_seed.bundle"
    bundleFile = createBundle(mode)

    # Upload
    uploadResult = await uploadBundle(bundleFile)
    if uploadResult.failed:
        return { ok: false, reason: "upload_failed" }

    return { ok: true, mode: mode, bundleId: uploadResult.id }
```

Bundle modes and their literals:

| Mode | Literal | Location |
|---|---|---|
| Primary head | `"head"` | bundle.js:+8980919 |
| Fallback head | `"fallback_head"` | bundle.js:+8980958 |
| Squashed | `"squashed"` | bundle.js:+8980993 |
| Fallback squashed | `"fallback_squashed"` | bundle.js:+8981036 |
| Seed bundle filename | `"ccr-seed.bundle"` | bundle.js:+8980242/8980253 |
| Source seed filename | `"_source_seed.bundle"` | bundle.js:+8980549 |

---

### 11. Remote Session Creation API Call — `createRemoteSession` (bundle ident: `el`)

Analysis basis: CC v2.1.162 bundle.js:+8993892

```
async function createRemoteSession(prompt, envSelection, bundleResult):
    # Verify first-party provider
    if NOT isFirstParty():
        return error("not_first_party",
            "Remote sessions are only available on the first-party Anthropic API provider.")

    # Verify access token
    accessToken = getAccessToken()
    if NOT accessToken:
        return error("no_access_token", "No access token found for remote session creation")

    # Get org UUID
    orgUUID = await getOrgUUID()
    if NOT orgUUID:
        return error("no_org_uuid", "Unable to get organization UUID for remote session creation")

    # Build headers
    headers = {
        "anthropic-beta": "ccr-byoc-2025-07-29",
        "x-organization-uuid": orgUUID,
        "Content-Type": "application/json",
    }

    # POST to remote session endpoint
    body = {
        environment: envSelection,
        bundle: bundleResult,
        prompt: prompt,
        permission_mode: "set",   # or "unset"
        type: "remote_agent",
    }

    response = await httpClient.post(endpoint, body, headers)

    if response.status >= 500:
        return error("create_request_failed")
    if response.status in [401, 403, 429]:
        return error("create_request_failed")
    if response.status == 409:
        return error("conflict — retry")
    if response.status != 201:
        return error("create_request_failed")

    # Validate session ID
    if NOT response.data.sessionId:
        return error("malformed_response",
            "Server returned a malformed session response (no session id)")

    emit telemetry("tengu_ccr_session_link")
    log("[teleport] phase: POST-sent")
    return { ok: true, sessionId: response.data.sessionId }
```

API version header: `"anthropic-version: 2023-06-01"` (bundle.js:+3197306). Beta feature flag: `"ccr-byoc-2025-07-29"` (bundle.js:+8994895).

Analysis basis: CC v2.1.162 bundle.js:+8994070, +8994214, +8994542, +8996125, +8996671

---

### 12. Environment Selection — `teleportEnvironmentSelect` (bundle ident: `ns` / `Y66`)

Analysis basis: CC v2.1.162 bundle.js:+8944082

```
async function teleportEnvironmentSelect(appContext):
    emit telemetry("teleport_environments_list")
    log("[teleport] phase: env-select")

    # First-party check
    if NOT isFirstParty():
        return error("not_first_party",
            "Remote environments are only available on the first-party Anthropic API provider.")

    # Auth check — must be Claude.ai account, not API key
    if NOT hasClaudeAiToken():
        return error("auth_required",
            "Claude Code web sessions require authentication with a Claude.ai account. " +
            "API key authentication is not sufficient. Please run /login …")

    # Org UUID
    orgUUID = await getOrgUUID()
    if NOT orgUUID:
        return error("no_org_uuid", "Unable to get organization UUID")

    # Fetch environments list (timeout: 15000 ms)
    envList = await fetchEnvironments(orgUUID, timeout=15000)

    # If no default env, auto-create cloud environment (Y66 / createDefaultEnvironment)
    defaultEnv = envList.find(e => e.name == "Default")
    if NOT defaultEnv:
        newEnv = await createDefaultCloudEnvironment(orgUUID)
        emit telemetry("teleport_default_environment_create")
        if NOT newEnv:
            log("warn", "Could not create a cloud environment. Set one up at https://claude.ai/code/onboarding?magic=env-setup")
            return error("env_create", ...)

    # Filter to available environments
    available = envList.filter(e => e.status != "archived")
    if available.length == 0:
        return error("no_environments", "No environments available for session creation")

    # Pick environment (bridge or default)
    selected = pickEnvironment(available)
    return { ok: true, environment: selected }
```

Default environment defaults: `python=3.11`, `node=20`, home=`/home/user`, type=`anthropic_cloud` (bundle.js:+8945420, +8945526, +8945588, +8945619).

Analysis basis: CC v2.1.162 bundle.js:+8944153, +8944289, +8944528, +8944720

---

### 13. Branch Detection and Title Generation — `detectOrGenerateBranch` (bundle ident: `zQ7`)

Analysis basis: CC v2.1.162 bundle.js:+8982253

```
async function detectOrGenerateBranch(prompt):
    log("[teleport] phase: branch-detect")

    # Trim prompt to 75 chars for branch name generation
    shortPrompt = prompt.slice(0, 75)

    # Branch name pattern: "claude/task/{description}"
    branchTemplate = "claude/task/{description}"

    # Call model to generate title and branch name
    titleRequest = {
        type: "json_schema",
        schema: { title: string, branch: string }
    }
    emit telemetry("teleport_generate_title")

    result = await callModel(titleRequest, shortPrompt)
    return result
```

Branch name prefix: `"claude/task/"` (bundle.js:+8982264). Maximum prefix for title truncation: `75` characters (bundle.js:+8982258).

---

### 14. Status Polling Monitor — `fZf` (bundle ident: `fZf`)

Analysis basis: CC v2.1.162 bundle.js:+12144727

```
async function ultraplanStatusMonitor(sessionId, context):
    startTime = Date.now()
    emit telemetry("tengu_ultraplan_timeout_seconds", timeout=5400)
    # Internal max session age: 5400 seconds (bundle.js:+12144293)

    pollResult = await pollSessionMessages(sessionId)   # poq / pollSessionMessages

    if pollResult.state == "plan_ready":
        emit telemetry("tengu_ultraplan_plan_ready")
        planContent = extractPlanContent(pollResult)
        plan = buildPlanRefinement(planContent)

        # Display plan with tool calls (vk / renderPlanUI)
        renderPlanUI(plan)

        approved = await awaitUserApproval(plan)
        if approved:
            emit telemetry("tengu_ultraplan_approved")
            updateSession("approved")
        else:
            terminateSession(sessionId)   # AN6 / archiveSession

    if pollResult.state == "failed":
        emit telemetry("tengu_ultraplan_failed")
        # Inject system message
        injectMessage("system",
            "Remote Ultraplan session failed. Wait for the user's next instructions.")
        return

    if pollResult.state == "completed":
        injectMessage("system",
            "Results will land as a pull request when the remote session finishes. There is nothing to do here.")

    if pollResult.state == "timeout_no_plan":
        injectMessage("warn", ". See --debug for details.")

    return pollResult
```

Session result string at bundle.js:+12145869. Failure injection string at bundle.js:+12146667.

---

### 15. Session Message Poller — `pollSessionMessages` (bundle ident: `poq`)

Analysis basis: CC v2.1.162 bundle.js:+12135119

```
async function pollSessionMessages(sessionId):
    startTime = Date.now()

    while true:
        if callerAborted:
            return { state: "poll stopped by caller" }

        try:
            messages = await fetchMessages(sessionId)   # L.ingest
        catch NetworkError:
            retryCount++
            if retryCount > maxRetries:
                return {
                    state: "network_or_unknown",
                    message: "Lost connection to the remote session after repeated retries — the session may still be running"
                }
            continue

        # Parse terminal states
        if messages.state == "approved":
            return { state: "approved" }
        if messages.state == "remote" or "teleport":
            # Remote execution underway
            continue
        if messages.state == "terminated":
            return { state: "terminated" }
        if messages.state == "requires_action":
            return { state: "requires_action", data: messages }
        if messages.state == "plan_ready":
            emit telemetry("tengu_ultraplan_plan_ready")
            return { state: "plan_ready", plan: messages.plan }
        if messages.state == "needs_input":
            emit telemetry("tengu_ultraplan_awaiting_input")
            return { state: "needs_input", data: messages }

        # Timeout check
        elapsed = Date.now() - startTime
        elapsedMinutes = Math.round(elapsed / 60000)
        if elapsedMinutes >= sessionLimitMinutes:
            return { state: "timeout_pending" }

    # Extract marker check
    if NOT foundExtractMarker:
        return { state: "extract_marker_missing" }
```

Key timing constants: session timeout check interval `60000` ms (bundle.js:+12136439). Time display uses `"minute"` / `"minutes"` strings at bundle.js:+12136454, +12136463.

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_ultraplan_create_failed` | Fired when launch orchestrator fails (bundle.js:+12148663) |
| Telemetry: `tengu_ultraplan_prompt_identifier` | Fired when prompt is identified in `KS8` / `j6` (bundle.js:+12144426) |
| Telemetry: `tengu_ultraplan_launched` | Fired when session successfully launched (bundle.js:+12150345) |
| Telemetry: `tengu_ultraplan_timeout_seconds` | Reports configured timeout (5400 s) at session start (bundle.js:+12144259) |
| Telemetry: `tengu_ultraplan_awaiting_input` | Fired when remote session pauses for user input (bundle.js:+12144903) |
| Telemetry: `tengu_ultraplan_plan_ready` | Fired when remote plan is available for review (bundle.js:+12144971) |
| Telemetry: `tengu_ultraplan_approved` | Fired when user approves the plan (bundle.js:+12145379) |
| Telemetry: `tengu_ultraplan_failed` | Fired when remote session fails (bundle.js:+12146256) |
| Telemetry: `tengu_ccr_bundle_upload` | Fired during git bundle upload phase (bundle.js:+8979239) |
| Telemetry: `tengu_ccr_session_link` | Fired on successful session creation (bundle.js:+8989136) |
| Telemetry: `tengu_teleport_bundle_mode` | Reports bundle mode selected (bundle.js:+8995299) |
| Telemetry: `tengu_teleport_source_decision` | Records source resolution path (bundle.js:+9000721) |
| Telemetry: `tengu_ccr_bundle_seed_enabled` | Reports seed-bundle mode (bundle.js:+9065108) |
| Telemetry: `bg_remote_eligibility_check` | Fired at start of deep eligibility check (bundle.js:+9064705) |
| Telemetry: `teleport_generate_title` | Fired when generating branch title via model call (bundle.js:+8982562) |
| Telemetry: `teleport_environments_list` | Fired when listing remote environments (bundle.js:+8944085) |
| Telemetry: `teleport_default_environment_create` | Fired when auto-creating default cloud env (bundle.js:+8945005) |
| Telemetry: `tengu_config_parse_error` | Fired on config file parse failure (bundle.js:+3257134) |
| Hook registration | Registers `"task-notification"` hook via `J9` / `jJA.register` at session start (bundle.js:+12149655, +60123) |
| appState reads | `_.getAppState()` called at entry (bundle.js:+12151722) |
| appState writes | `_.setAppState(result)` called on completion (bundle.js:+12151944); launching flag `D5H` set during orchestration |
| IPC channel | Opens a named channel via `_e.open` (L66) for session communication |
| Git side effects | Cleans `refs/seed/stash` and `refs/seed/root`; creates and uploads a git bundle file |
| File system | Writes temporary bundle file (`ccr-seed.bundle` / `_source_seed.bundle`); removed via `fL.unlink` / `AN6` after upload |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Session archival | Orphaned sessions are archived by `MZf` on new launch; failed remote sessions archived via `AN6` |
| Remote execution result | Delivered as a GitHub pull request; local CLI displays: `"Results will land as a pull request when the remote session finishes."` |

---

## Version History

| Version | Change |
|---|---|
| v2.1.162 | Initial analysis |

---

## Common Mistakes

1. **Running `/ultraplan` without a Claude.ai login** — The command requires authentication via a Claude.ai account (not a raw API key). Users who have only set `ANTHROPIC_API_KEY` will see the `not_logged_in` or auth-required error. Run `/login` first.

2. **Running outside a git repository** — The teleport mechanism requires a git repository with at least one commit. The error `not_in_git_repo` is returned immediately. Run `git init && git add . && git commit -m "initial"` to satisfy this requirement.

3. **No GitHub remote configured** — Even in a valid git repo, the background task delivery mechanism requires a GitHub remote (`origin`). Add one with `git remote add origin <REPO_URL>`.

4. **GitHub App not installed on the repository** — The GitHub App must be installed on the target GitHub organization or user account. The CLI cannot install it automatically; the user must complete onboarding at `https://claude.ai/code`.

5. **Invoking `/ultraplan` while a session is already launching** — The command guards against concurrent launches. Calling it a second time before the first session starts returns `"ultraplan: already launching. Please wait for the session to start."` and emits `tengu_ultraplan_create_failed` with reason `already_launching`.

6. **Using a non-first-party API provider** — The feature is gated to Anthropic's own API endpoint. Third-party or self-hosted providers receive `not_first_party` / `policy_denied` errors.

7. **Organization policy blocking remote sessions** — Admins can disable remote sessions at the org level. The error `policy_blocked` is returned with a message directing users to contact their admin.

8. **Expecting results in the CLI terminal** — Results are not streamed back into the interactive CLI session. The remote agent creates a pull request. The local CLI only shows plan-review UI and final status.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `DZf` | Main async handler for `/ultraplan` (Arbor-resolved entry point) |
| `PV8` | Prompt normalization — strips command prefix and collapses whitespace |
| `XV8` | Command-prefix strip helper (called by PV8) |
| `Pr_` | Token matching loop within strip helper; uses `startsWith`, `matchAll` |
| `W9` | Remote eligibility check — validates account kind, policy flags, feature flags |
| `FK9` | Account-kind resolver (firstParty / enterprise / team) |
| `rvH` | Account resolution dispatcher |
| `JC` | Account object accessor (wA, Hf, OO, pJ, Q1) |
| `vj6` | Config file reader (readFileSync, utf-8) |
| `ULH` | Feature-flag validator |
| `wq` | Telemetry consent / product-feedback flag checker |
| `UyA` | Consent flag evaluator |
| `tH` | String coercion utility |
| `u4H` | String-to-flag converter |
| `D5H` | Launching-flag appState token |
| `Qh6` | Launch orchestrator — guards, state transitions, calls teleport flow |
| `c` | Utility / context accessor |
| `E6` | Error constructor / emitter |
| `Zx6` | Base error class |
| `L` | Cleanup / abort registration helper |
| `loq` | Logging utility |
| `LS8` | Background-eligibility wrapper |
| `KS8` | Background-eligibility dispatcher (calls j6, AZf) |
| `j6` | Core background eligibility checker |
| `AZf` | Secondary eligibility check step |
| `zZf` | Teleport flow orchestrator (all teleport phases) |
| `_2H` | Precondition runner (wraps J3q) |
| `J3q` | Deep background-eligibility check (Promise.all of all preconditions) |
| `LZf` | Plan refinement display builder |
| `KZf` | Plan line formatter (calls _Zf) |
| `el` | Remote session creation — full API call handler |
| `x6` | Context / config accessor |
| `W5` | Auth/account status helper |
| `I3` | URL resolver (VY_) |
| `Hc_` | HTTP header builder |
| `kH` | Error logger / reporter |
| `bx` | HTTP response body decoder |
| `p1` | OAuth endpoint resolver (local/staging/prod) |
| `BJ` | Axios request wrapper (sets anthropic-version header) |
| `od_` | Git bundle upload handler (teleportGitBundleUpload) |
| `S6` | Notification/output helper (Nv) |
| `v` | API provider / environment detector |
| `Z6` | Error type wrapper (Zx6) |
| `kR` | Git remote URL resolver (git config remote.origin.url) |
| `u$q` | Session-link UUID builder (sd_.randomUUID) |
| `BV6` | Session object builder |
| `SH` | JSON serializer (JSON.stringify) |
| `x$q` | Error response parser |
| `nG8` | Next-phase trigger |
| `ns` | Environment selector (teleportEnvironmentSelect) |
| `Y66` | Default environment creator |
| `TH` | String cast (String(...)) |
| `$` | Message array (findLast, map, find, some, findLast) |
| `zQ7` | Branch detection and title generation |
| `fh` | Feature-flag presence checker |
| `aSH` | GitHub App installation checker |
| `Uv` | Default branch detector (symbolic-ref / show-ref) |
| `a1` | Auxiliary state accessor |
| `jHH` | URL / HTTP scheme normalizer (https/http, 3/4 path segments) |
| `r` | MCP update / pending-session handler |
| `t_` | Error string extractor |
| `Yz` | Cancellation check |
| `uO` | Unknown/catch-all error handler |
| `Qw` | Claude.ai base URL resolver (local/staging/prod) |
| `k_` | Module initialization / ESModule flag setter |
| `cV_` | Environment URL selector (_P6, RcL) |
| `$Zf` | Plan UI renderer step |
| `$RH` | Remote agent poller (outer loop) |
| `Ok` | Random-bytes token generator |
| `L66` | IPC channel opener (_e.open) |
| `d2` | Channel timestamp recorder |
| `dQ7` | Session-status line formatter |
| `W3q` | Poll-remote-session inner loop |
| `vk` | Plan UI rendering dispatcher |
| `pt7` | Plan render step A (retain mode) |
| `ut7` | Plan render step B (task_started) |
| `_` | General-purpose context / state object |
| `Dr_` | Render error handler |
| `Ut7` | Plan render step C (Date.now timer) |
| `Bt7` | Plan render step D (Object.keys iterator) |
| `W1H` | Workflow state tracker (user_typed, active, aborted) |
| `fZf` | Ultraplan status monitor (plan_ready → approval loop) |
| `poq` | Session message poller (inner polling loop) |
| `HZf` | Session-start hook handler (j6) |
| `OZf` | Intermediate plan extractor |
| `AN6` | Session archive / cleanup (fL.unlink, o1) |
| `K` | Column formatter (L.map, f.padEnd, "  " padding) |
| `Rm` | Remote session status POST handler (retry, 409 detection) |
| `J9` | Hook registration (jJA.register) |
| `MZf` | Orphaned-session archiver |
| `C6` | Config reader with watch (bWL watcher, Date.now stamp) |
| `i6` | Path utility |
| `zj_` | Config validator |
| `DYH` | Config file read/write with backup (readFileSync, copyFileSync, mkdirSync) |
| `p6` | JSON parser (JSON.parse) |
| `Zx` | Path prefix checker (startsWith/slice) |
| `V8` | Config schema validator |
| `$n1` | Config directory scanner (readdirStringSync) |
| `Xj_` | Config path joiner (bY.join) |
| `w` | Background worker manager (spawn, kill, adopt, retire) |
| `S` | Worker write/message handler |
| `n8` | Timeout/kill utility (setTimeout, clearTimeout, L.unref) |
| `RH` | Feature-bad reporter (tengu_feature_bad) |
| `hH` | Feature-ok reporter (tengu_feature_ok) |
| `zC8` | Low-memory checker (macOS, 1024 MB threshold) |
| `Gj6` | Allowlist file reader (W2.readFile, JSON parse, filter) |
| `F` | Session retirement helper (retireIfSettled) |
| `yzA` | Background worker spawn/connect (ap8.connect, f.on/once/write/end) |
| `xzA` | Background worker lifecycle manager (add, delete, rm, unlink, rosterEntry) |
| `Y` | Forced shutdown handler (process.exit, z.abort) |
| `C` | Rate-limit event queue (k.enqueue, YJ.randomUUID) |
| `bWL` | Config file watcher (o18.watchFile/unwatchFile) |
| `jo` | Watch event dispatcher |
| `T16` | Initial data prefetch (Promise.all of kR, fh, n4, x6, tH, aSH) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.