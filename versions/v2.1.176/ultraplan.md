---
type: feature-spec
feature: "ultraplan"
cc_version: "2.1.176"
updated: "2026-06-13"
tags: ["ultraplan", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.176 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultraplan`

> Analysis basis: CC v2.1.176 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.176

---

## Overview

`/ultraplan` launches a cloud-backed planning session (called a "teleport" session) that drafts an editable task plan on Claude.ai's web interface. The command validates preconditions (login, git repository, remote, GitHub App installation, organizational policy), uploads the local repository as a git bundle to a remote cloud environment, creates a background remote agent session, polls for completion, and then surfaces the resulting plan draft back into the local Claude Code conversation for the user to refine or approve.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultraplan` |
| description | `Draft an editable plan in Claude Code on the web ( ... ) · See  ...` |
| argumentHint | `<prompt>` |
| load_inline | `true` |
| load_ident | `UoL` |
| loc_byte | `12561007` |
| loc_byte_end | `12561239` |
| loc_line | `8702` |
| arbor_handler.name | `UoL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.fqn | `claude-2.1.176::UoL` |
| arbor_handler.resolution_path | `load_ident` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.176 bundle.js:+12561007

---

## Input Branching

The command has many distinct branches (guard checks, launch state checks, teleport outcome routing, polling result routing). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/ultraplan <prompt>"]) --> B{allow_remote_sessions\nsetting enabled?}
    B -- No --> B_NO["Return early (silent skip)"]
    B -- Yes --> C{User logged in\nwith Claude.ai account?}
    C -- No --> C_NO["Error: not_logged_in\nPrompt to /login"]
    C -- Yes --> D{In a git repository?}
    D -- No --> D_NO["Error: not_in_git_repo"]
    D -- Yes --> E{Git remote exists?}
    E -- No --> E_NO["Error: no_git_remote\nPrompt to add origin"]
    E -- Yes --> F{GitHub App\ninstalled?}
    F -- No --> F_NO["Error: github_app_not_installed"]
    F -- Yes --> G{Org policy\nblocks cloud sessions?}
    G -- Blocked --> G_NO["Error: policy_blocked\nContact org admin"]
    G -- Allowed --> H{Already launching\nor polling?}
    H -- already_launching --> H1["Warn: already launching, please wait"]
    H -- already_polling --> H2["Suppress duplicate launch"]
    H -- Neither --> I[Extract / validate prompt]
    I --> I1{Prompt contains 'ultraplan'\nor explicit arg given?}
    I1 -- No --> I_NO["Usage hint: /ultraplan <prompt>"]
    I1 -- Yes --> J[Run precondition check\n(bg_remote_eligibility_check)]
    J --> J1{Precondition\nresult?}
    J1 -- policy_denied --> J_P["Error: cloud sessions disabled by org"]
    J1 -- not_first_party --> J_F["Error: first-party API required"]
    J1 -- no_access_token --> J_T["Error: no access token"]
    J1 -- no_org_uuid --> J_U["Error: cannot get org UUID"]
    J1 -- Pass --> K[Teleport: upload git bundle\n(teleportToRemote)]
    K --> K1{Source decision}
    K1 -- github remote --> K2[Upload HEAD / squashed bundle]
    K1 -- no git at all --> K3["Empty sandbox (byoc_no_git_source)"]
    K2 --> L[POST session creation API]
    K3 --> L
    L --> L1{HTTP status}
    L1 -- 401/403/429 --> L_A["Error: github_repo_access_denied\nor auth failure"]
    L1 -- 500 --> L_B["Error: create_request_failed"]
    L1 -- 201 --> L_OK[Session created\nRecord session ID]
    L_OK --> M[Generate branch/title via LLM\n(teleport_generate_title)]
    M --> N[Start background polling loop\n(SmH / $yq)]
    N --> N1{Poll result}
    N1 -- needs_input / plan_ready --> O["tengu_ultraplan_plan_ready\nSurface draft plan text:\n'Here is a draft plan to refine:'"]
    O --> O1{User action}
    O1 -- Approved --> P["tengu_ultraplan_approved\nInject plan; cloud agent runs to completion\n→ PR created"]
    O1 -- Rejected/Timeout --> Q["Abort remote session"]
    N1 -- completed --> R["Session done; results in PR"]
    N1 -- terminated/archived --> S["tengu_ultraplan_failed\nSurface failure message"]
    N1 -- requires_action --> T["tengu_ultraplan_awaiting_input\nAsk user for input"]
    N1 -- timeout_pending --> U["timeout_pending error"]
    N1 -- timeout_no_plan --> V["timeout_no_plan error\n(exceeded 30 min / 1800000 ms)"]
    N1 -- network error --> W["tengu_ultraplan_failed\nLost connection; retries exhausted"]
    K --> X{teleport returns null?}
    X -- Yes --> X_Y["Error: teleport_null\ncreate_api_fail"]
    X -- No --> L
```

Analysis basis: CC v2.1.176 bundle.js:+12559141

---

## Behavioral Spec

### 1. Handler Entry Point (`handlerMain`)

The async handler `UoL` is registered via an inline `load: () => Promise.resolve({ call: UoL })` shape. When the slash command is invoked, the runtime resolves the load-ident and calls `UoL` directly.

```
async function handlerMain(commandInput, appContext):
    // Guard: remote sessions must be enabled
    if not appContext.settings["allow_remote_sessions"]:
        return  // silent skip

    // Read app state
    appState = appContext.getAppState()

    // Attempt to extract prompt text
    prompt = extractPromptFromInput(commandInput)

    // Check for duplicate in-flight launches
    if launchState == "already_polling" or launchState == "already_launching":
        emit warning "ultraplan: already launching. Please wait..."
        return

    // Validate prompt
    if not promptIsValid(prompt):
        emit usage hint
        return

    // Run full precondition + teleport flow
    result = await launchUltraplanSession(prompt, appContext)

    // Update app state with result
    appContext.setAppState(result)
```

Analysis basis: CC v2.1.176 bundle.js:+12559141

---

### 2. Prompt Extraction (`extractPromptFromInput`)

Implemented by `Dm8`, which delegates to `Ym8` → `KLA`.

```
function extractPromptFromInput(rawInput):
    // Normalize: collapse whitespace, strip leading markers
    normalized = normalizeWhitespace(rawInput)

    // Scan for the literal string "ultraplan" (case-insensitive, global flag "gi")
    matches = normalized.matchAll(/ultraplan/gi)

    // If found, slice text after the keyword; apply substitution pattern "$1$2"
    // to clean surrounding punctuation (slice offset 5)
    if matches found:
        candidate = normalized.slice(keywordOffset)
        candidate = candidate.replace(cleanupPattern, "$1$2")
        return candidate.trim()

    // If no keyword found, return raw input trimmed
    return normalized.trim()
```

Constants:
- Regex flags: `"gi"` (bundle.js:+10856358)
- Slice offset: `5` (bundle.js:+10857058)
- Replacement pattern: `"$1$2"` (bundle.js:+10857035)
- Truncation length for display: `40` characters (bundle.js:+17009361)

Analysis basis: CC v2.1.176 bundle.js:+12559141, +10856704, +10856358

---

### 3. Precondition / Eligibility Check (`runEligibilityCheck`)

Implemented by `$9`, which coordinates `AJH`, `yLH`, `Aq`, `GLH`, and related helpers. This is the "bg_remote_eligibility_check" phase.

```
async function runEligibilityCheck(appContext):
    // Check authentication type
    authType = getAuthType(appContext)  // "firstParty", "enterprise", "team"
    if authType != "firstParty":
        return { error: "not_first_party",
                 message: "Cloud sessions are only available on the first-party Anthropic API provider." }

    // Check login status
    if not userIsLoggedIn(appContext):
        return { error: "not_logged_in",
                 message: "Please run /login and sign in with your Claude.ai account (not Console)." }

    // Check git repository
    if not inGitRepo(appContext):
        return { error: "not_in_git_repo" }

    // Check git remote
    remoteUrl = getGitRemote()  // git config --get remote.origin.url
    if remoteUrl is empty:
        return { error: "no_git_remote",
                 message: "Cloud agents require a GitHub remote. Add one with `git remote add origin REPO_URL`." }

    // Check organizational policy (allow_product_feedback, policy flags)
    if orgPolicyBlocks(appContext):
        return { error: "policy_blocked",
                 message: "Cloud sessions are disabled by your organization's policy. Contact your organization admin to enable them." }

    // Check GitHub App installation
    ghAppStatus = await checkGithubAppInstalled(appContext)
    if not ghAppStatus.installed:
        return { error: "github_app_not_installed" }

    // Check access token
    token = getAccessToken(appContext)
    if token is missing:
        return { error: "no_access_token",
                 message: "No access token found for cloud session creation" }

    // Resolve organization UUID
    orgUuid = await resolveOrgUUID(appContext)
    if orgUuid is missing:
        return { error: "no_org_uuid",
                 message: "Unable to get organization UUID for cloud session creation" }

    return { ok: true, token, orgUuid }
```

Key literals observed:
- `"not_logged_in"` (bundle.js:+9440214)
- `"not_in_git_repo"` (bundle.js:+9440315)
- `"no_git_remote"` (bundle.js:+9440449)
- `"github_app_not_installed"` (bundle.js:+9440562)
- `"policy_blocked"` (bundle.js:+9440716)
- `"no_access_token"` (bundle.js:+9363853)
- `"no_org_uuid"` (bundle.js:+9364149)
- `"not_first_party"` (bundle.js:+9363516)
- Eligibility check API timeout: `15000` ms (bundle.js:+9310565)

Analysis basis: CC v2.1.176 bundle.js:+2536951, +9438286, +9440089

---

### 4. Teleport Session Launch (`teleportToRemote` / `qo`)

This is the "teleport" subsystem responsible for uploading the repository and creating the remote session.

```
async function teleportToRemote(prompt, eligibilityResult, appContext):
    // Phase: env-select
    log "[teleport] phase: env-select"
    environments = await listRemoteEnvironments(eligibilityResult.token, eligibilityResult.orgUuid)

    if environments is empty:
        // Attempt to auto-create a default environment
        created = await createDefaultEnvironment(eligibilityResult.token, eligibilityResult.orgUuid)
        if failed:
            warn "Could not create a cloud environment. Set one up at https://claude.ai/code/onboarding?magic=env-setup"
            return { error: "no_environments" }
        log "[teleportToRemote] Auto-created default cloud env"
        targetEnv = created

    // Phase: branch-detect
    log "[teleport] phase: branch-detect"
    branchInfo = await detectCurrentBranch()  // git symbolic-ref --short refs/remotes/origin/HEAD
    // Falls back to "main" then "master" (bundle.js:+1155749, +1155756)

    // Phase: bundle-upload
    log "[teleport] phase: bundle-upload"
    sourceDecision = await decideBundleSource(branchInfo, targetEnv)
    // Emits tengu_teleport_source_decision

    if sourceDecision == "github":
        bundle = await uploadGitBundle(branchInfo)
        // Stashes work-in-progress; uses refs/seed/stash and refs/seed/root
        // Git operations: stash create, for-each-ref, rev-parse HEAD, update-ref -d
        // Bundle file: ccr-seed.bundle / _source_seed.bundle
        // Emits tengu_ccr_bundle_upload
    else if sourceDecision == "no_git_at_all":
        log "[teleportToRemote] No repository detected — session will have an empty sandbox"
        bundle = null  // byoc_no_git_source

    // Generate title/branch name via LLM (teleport_generate_title)
    titleResult = await generateTaskTitle(prompt)
    // Branch name from title, max 75 chars, prefix "claude/task"

    // Phase: POST-sent
    log "[teleport] phase: POST-sent"
    requestBody = buildSessionRequest(prompt, titleResult, bundle, targetEnv, eligibilityResult)
    // Headers include: anthropic-beta: "ccr-byoc-2025-07-29", x-organization-uuid

    response = await httpPost(sessionCreationEndpoint, requestBody)

    if response.status in [401, 403, 429]:
        return { error: "github_repo_access_denied" }
    if response.status == 500:
        return { error: "create_request_failed" }
    if response.status != 201:
        return { error: "create_request_failed" }

    sessionId = response.data.id
    if sessionId is null:
        return { error: "malformed_response",
                 message: "Server returned a malformed session response (no session id)" }

    // Emit session link telemetry
    emit tengu_ccr_session_link

    return { sessionId, titleResult, targetEnv }
```

Key literals:
- `"refs/seed/stash"` (bundle.js:+9347840)
- `"refs/seed/root"` (bundle.js:+9347858)
- `"ccr-seed"` / `".bundle"` suffix (bundle.js:+9349035, +9349046)
- `"_source_seed.bundle"` (bundle.js:+9349342)
- `"claude/task"` branch prefix (bundle.js:+9351123)
- Title max length: `75` characters (bundle.js:+9351117)
- `"ccr-byoc-2025-07-29"` beta header (bundle.js:+9364326)
- HTTP `200` used internally for upload check (bundle.js:+9348556)
- HTTP `201` expected for session creation (bundle.js:+9365625)
- HTTP `401`, `403`, `429` trigger access-denied error (bundle.js:+9365693, +9365697, +9365701)
- HTTP `500` triggers create-failed error (bundle.js:+9365589)

Analysis basis: CC v2.1.176 bundle.js:+9363260, +9364415, +9365535

---

### 5. Launch Orchestration (`launchUltraplanSession` / `YU6`)

After the eligibility check and teleport session creation, this layer manages the launch lifecycle.

```
async function launchUltraplanSession(prompt, appContext):
    // Check / set launch state flags
    if launchState == "already_launching":
        emit "ultraplan: already launching. Please wait for the session to start."
        emit tengu_ultraplan_create_failed
        return

    setLaunchState("already_launching")

    try:
        // Run eligibility
        eligResult = await runEligibilityCheck(appContext)
        if eligResult.error:
            emit tengu_ultraplan_create_failed
            return eligResult

        // Teleport
        sessionResult = await teleportToRemote(prompt, eligResult, appContext)
        if sessionResult == null:
            emit { error: "teleport_null", kind: "create_api_fail" }
            return

        // Mark as launched
        emit tengu_ultraplan_launched
        setLaunchState("already_polling")

        // Start polling loop
        pollingResult = await pollUltraplanSession(sessionResult.sessionId, appContext)

        return pollingResult

    catch unexpectedError:
        emit { error: "unexpected_error" }
        emit "Ultraplan hit an unexpected error during launch. Wait for the user's next instructions."
        // Retry delay: 1500 ms (bundle.js:+12558422)
        return
    finally:
        clearLaunchState()
```

Key literals:
- `"already_launching"` guard string (bundle.js:+12556606)
- `"already_polling"` guard string (bundle.js:+12556588)
- `"ultraplan: already launching. Please wait for the session to start."` (bundle.js:+12555141)
- `"unexpected_error"` error kind (bundle.js:+12558493)
- Retry delay after unexpected error: `1500` ms (bundle.js:+12558422)
- `"Ultraplan hit an unexpected error during launch. Wait for the user's next instructions."` (bundle.js:+12558665)

Analysis basis: CC v2.1.176 bundle.js:+12556329, +12556629, +12556963

---

### 6. Session Polling Loop (`pollUltraplanSession` / `boL` + `C3K`)

This subsystem polls the remote session status and routes outcomes.

```
async function pollUltraplanSession(sessionId, appContext):
    // Timeout configuration
    // Max session duration: 1800000 ms = 30 minutes (bundle.js:+9446863)
    // Poll interval: 1000 ms (bundle.js:+9446856)
    // Timeout for pending state: configurable (tengu_ultraplan_timeout_seconds)
    // Max wait constant: 5400 (bundle.js:+12551895)

    startTime = Date.now()
    emit tengu_ultraplan_timeout_seconds

    loop:
        status = await fetchSessionStatus(sessionId)
        elapsed = Date.now() - startTime

        switch status.phase:
            case "plan_ready" | "needs_input":
                emit tengu_ultraplan_plan_ready
                planText = extractPlanText(status)
                // Surface with prefix: "Here is a draft plan to refine:"
                // Emits tengu_ultraplan_prompt_identifier
                userResponse = await promptUserForApproval(planText)

                if userResponse == "approved":
                    emit tengu_ultraplan_approved
                    // Inject plan into conversation; cloud agent continues → PR
                    return { outcome: "approved", plan: planText }
                else:
                    archiveSession(sessionId)
                    return { outcome: "rejected" }

            case "requires_action":
                emit tengu_ultraplan_awaiting_input
                // Surface agent's question to user

            case "completed":
                // Task done; results delivered as PR
                return { outcome: "completed" }

            case "terminated" | "archived":
                emit tengu_ultraplan_failed
                // "Cloud ultraplan session failed. Wait for the user's next instructions."
                return { outcome: "failed" }

            case "running" | "starting" | "pending":
                // Continue polling after interval

        // Timeout checks
        if elapsed > timeout and status == "pending":
            return { outcome: "timeout_pending" }
        if elapsed > timeout and no plan received:
            return { outcome: "timeout_no_plan" }

        // Network error handling with retry
        if networkError:
            if retriesExhausted:
                // "Lost connection to the cloud session after repeated retries"
                emit tengu_ultraplan_failed
                return { outcome: "network_or_unknown" }
            wait(retryInterval)
            continue

        await sleep(pollInterval)

    // Results will land as a PR when cloud session finishes
    // "Results will land as a pull request when the cloud session finishes.
    //  There is nothing to do here."
```

Key literals:
- Poll interval: `1000` ms (bundle.js:+9446856)
- Max session duration: `1800000` ms / 30 minutes (bundle.js:+9446863)
- Timeout granularity unit: `60000` ms = 1 minute (bundle.js:+12544041)
- Max polling constant: `5400` (bundle.js:+12551895)
- `"Here is a draft plan to refine:"` prefix (bundle.js:+12552202)
- `"plan_ready"` status (bundle.js:+12543911)
- `"needs_input"` status (bundle.js:+12543926)
- `"requires_action"` status (bundle.js:+12543859)
- `"terminated"` status (bundle.js:+12543721)
- `"timeout_pending"` outcome (bundle.js:+12544264)
- `"timeout_no_plan"` outcome (bundle.js:+12544282)
- `"network_or_unknown"` outcome (bundle.js:+12543147)
- `"Lost connection to the cloud session after repeated retries — the session may still be running"` (bundle.js:+12543221)
- `"Cloud ultraplan session failed. Wait for the user's next instructions."` (bundle.js:+12554306)
- `"Results will land as a pull request when the cloud session finishes. There is nothing to do here."` (bundle.js:+12553483)
- `"cloud session exceeded 30 minutes"` (bundle.js:+9449504)
- `"cloud session returned an error"` (bundle.js:+9449464)
- `"no review output — orchestrator may have exited early"` (bundle.js:+9449540)

Analysis basis: CC v2.1.176 bundle.js:+12552329, +12542723, +9445175, +9445700

---

### 7. Background Session Management (`backgroundSessionDriver` / `SmH` + `$yq`)

The polling loop is backed by a remote-agent background session driver. The driver manages the lifecycle of the cloud session connection.

```
async function backgroundSessionDriver(sessionId):
    // Generate session token: 8 random bytes (bundle.js:+13622746)
    sessionToken = generateToken(8)
    // Initial status: "pending" → transitions to "running" (bundle.js:+13622853, +9445286)

    sessionType = "remote_agent"  // (bundle.js:+9445178)

    // Track timestamps with Date.now()
    startTs = Date.now()

    // Event loop processes messages of types:
    //   "result", "hook_progress", "hook_response", "hook_started",
    //   "SessionStart", "idle", "starting"

    // Poll loop constraints:
    //   Outer timeout: 1800000 ms (30 min)
    //   Inner poll: 1000 ms
    //   Workflow type: "remote-workflow"

    // On receiving "result":
    //   findLast assistant message
    //   extract last marker position (b.lastIndexOf)
    //   slice relevant output (b.slice)

    // On "archived" status:
    //   Return archived result

    // On "completed":
    //   Return completed result

    // Timeout logic:
    //   if elapsed > 1800000 ms: surface "cloud session exceeded 30 minutes"

    // Output routing:
    //   "plan" channel → triggers plan-ready flow (bundle.js:+12557548)
    //   "cli" source → pipeline output back to CLI (bundle.js:+12557986)
```

Key literals:
- Token byte length: `8` (bundle.js:+13622746)
- `"remote_agent"` session type (bundle.js:+9445178)
- `"remote-workflow"` workflow type (bundle.js:+9447516)
- `"running"` transition state (bundle.js:+9445286)
- `"SessionStart"` event type (bundle.js:+9448663)
- `"hook_progress"` / `"hook_response"` / `"hook_started"` event types (bundle.js:+9448053, +9448082, +9448573)
- `"idle"` event type (bundle.js:+9448489)
- `"result"` event type (bundle.js:+9447870)
- `"archived"` state (bundle.js:+9447307)
- `"completed"` state (bundle.js:+9447382)

Analysis basis: CC v2.1.176 bundle.js:+9445175, +9445438, +9445498, +9445700

---

### 8. Orphaned Session Cleanup

If a previously launched session ID is found in app state at command start, the handler attempts to archive/retire it before proceeding.

```
function cleanupOrphanedSession(appState):
    if appState.previousSessionId is set:
        try:
            archiveSession(appState.previousSessionId)
        catch error:
            log "ultraplan: failed to archive orphaned session"
            // Non-fatal; continue
```

Literal: `"ultraplan: failed to archive orphaned session"` (bundle.js:+12558826)

Analysis basis: CC v2.1.176 bundle.js:+12558826

---

### 9. Git Bundle Upload Subsystem (`uploadGitBundle` / `OAA`)

```
async function uploadGitBundle(branchInfo, eligibilityResult):
    emit tengu_ccr_bundle_upload

    // Verify git state
    if not inGitRepo():
        return { error: "empty_repo", message: "Not in a git repository" }

    // Check for commits
    commitCount = gitForEachRef("refs/", "--count=1")
    if commitCount == 0:
        return { error: "empty_repo",
                 message: "Repository has no commits yet" }

    // Stash WIP if any
    stashRef = gitStashCreate()
    if stashRef:
        gitUpdateRef("refs/seed/stash", stashRef)
    headRef = gitRevParse("HEAD")
    gitUpdateRef("refs/seed/root", headRef)

    // Bundle strategies tried in order:
    // 1. "head"           — bundle current HEAD
    // 2. "fallback_head"  — fallback HEAD strategy
    // 3. "squashed"       — squash-merge bundle
    // 4. "fallback_squashed" — fallback squashed

    for strategy in bundleStrategies:
        bundleFile = createBundle(strategy)
        if bundleFile is ok:
            // Upload to pre-signed URL via HTTP POST
            uploadResult = httpPost(uploadUrl, bundleFile)
            if uploadResult.status != 200:
                if retries exhausted:
                    return { error: "upload_failed" }
                continue
            else:
                cleanupBundleFile(bundleFile)  // _K6.unlink
                return { status: "success", strategy }

    return { error: "stash_failed" }
```

Key literals:
- `"for-each-ref"` / `"--count=1"` / `"refs/"` (bundle.js:+9347942, +9347957, +9347969)
- `"stash"` / `"create"` git operations (bundle.js:+9348228, +9348236)
- `"update-ref"` / `"-d"` (bundle.js:+9347891, +9347904)
- `"rev-parse"` / `"--verify"` / `"HEAD"` (bundle.js:+9348580, +9348592, +9348603)
- `"stash_failed"` (bundle.js:+9348677)
- `"upload_failed"` (bundle.js:+9349491)
- `"head"` / `"fallback_head"` / `"squashed"` / `"fallback_squashed"` strategies (bundle.js:+9349712, +9349751, +9349786, +9349829)

Analysis basis: CC v2.1.176 bundle.js:+9347710, +9348032

---

### 10. GitHub App Check (`checkGithubAppInstalled` / `GmH`)

```
async function checkGithubAppInstalled(token, orgUuid):
    if token is null:
        log "checkGithubAppInstalled: No access token found, assuming app not installed"
        return { installed: false }

    if orgUuid is null:
        log "checkGithubAppInstalled: No org UUID found, assuming app not installed"
        return { installed: false }

    // HTTP GET to Anthropic API
    try:
        response = await httpGet(githubAppCheckEndpoint, headers={token, orgUuid})
        if response.status == 400:
            return { installed: false }
        if isAxiosError(response):
            // surface error details
        return { installed: response.data.installed }
    catch error:
        return { installed: false }
```

Log messages:
- `"checkGithubAppInstalled: No access token found, assuming app not installed"` (bundle.js:+9312301)
- `"checkGithubAppInstalled: No org UUID found, assuming app not installed"` (bundle.js:+9312414)
- `"is"` / `"is not"` installed log fragments (bundle.js:+9312812, +9312817)

Analysis basis: CC v2.1.176 bundle.js:+9312268, +9313018

---

### 11. Plan Draft Injection (`buildPlanMessage` / `CoL`)

When the cloud agent returns a plan, this function formats it for display in the local chat.

```
function buildPlanMessage(planLines):
    result = []
    result.push("Here is a draft plan to refine:")
    // RoL renders each plan item via IoL formatter
    for item in planLines:
        result.push(formatPlanItem(item))
    return result.join("\n")
```

Literal: `"Here is a draft plan to refine:"` (bundle.js:+12552202)

Analysis basis: CC v2.1.176 bundle.js:+12552195, +12552255, +12552285

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_ultraplan_create_failed` | Fired when the launch precondition or teleport creation fails (bundle.js:+12556366) |
| Telemetry: `tengu_ultraplan_prompt_identifier` | Fired when the plan prompt text is being identified/extracted (bundle.js:+12552028) |
| Telemetry: `tengu_ultraplan_launched` | Fired when the session is successfully created and polling begins (bundle.js:+12558073) |
| Telemetry: `tengu_ultraplan_timeout_seconds` | Records the configured polling timeout (bundle.js:+12551861) |
| Telemetry: `tengu_ultraplan_awaiting_input` | Fired when the remote agent needs user input during planning (bundle.js:+12552505) |
| Telemetry: `tengu_ultraplan_plan_ready` | Fired when the draft plan is returned from the cloud agent (bundle.js:+12552573) |
| Telemetry: `tengu_ultraplan_approved` | Fired when the user approves the draft plan (bundle.js:+12552993) |
| Telemetry: `tengu_ultraplan_failed` | Fired on session failure, termination, or network loss (bundle.js:+12553882) |
| Telemetry: `tengu_ccr_bundle_seed_enabled` | Fired when BYOC seed-bundle mode is active (bundle.js:+9438759) |
| Telemetry: `tengu_ccr_bundle_upload` | Fired on each git bundle upload attempt (bundle.js:+9348032) |
| Telemetry: `tengu_teleport_bundle_mode` | Records which bundle mode was selected (bundle.js:+9364670) |
| Telemetry: `tengu_ccr_session_link` | Records the cloud session link after creation (bundle.js:+9358015) |
| Telemetry: `tengu_teleport_source_decision` | Records the source strategy chosen for the session (bundle.js:+9370133) |
| Telemetry: `tengu_config_parse_error` | Fired on config file parse failure during handler setup (bundle.js:+3337357) |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Background daemon escalated SIGKILL (bundle.js:+16981999) |
| Telemetry: `tengu_bg_low_mem_mb` | Background session low memory warning (bundle.js:+13372785) |
| Telemetry: `tengu_bg_dispatch_low_mem` | Low-memory dispatch throttle triggered (bundle.js:+16982600) |
| Telemetry: `tengu_bg_spare_enable` | Spare background slot was enabled (bundle.js:+16983304) |
| Telemetry: `tengu_bg_spare_claim` | Spare slot claimed for this session (bundle.js:+16983432) |
| Telemetry: `tengu_bg_spare_claim_fail` | Spare slot claim failed (bundle.js:+16983698) |
| Telemetry: `tengu_bg_sendclaim_failed` | Background send-claim operation failed (bundle.js:+16959837) |
| Telemetry: `tengu_scheduled_task_missed` | A scheduled background task was missed (bundle.js:+16467492) |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` | Feature flag check pass/fail for remote sessions (bundle.js:+1018758, +1018825) |
| appState changes | Reads and writes `allow_remote_sessions` flag; reads/writes launch state flags (`already_launching`, `already_polling`); stores session ID; calls `_.getAppState()` and `_.setAppState()` (bundle.js:+12559476, +12559698) |
| Hook registration | `u9` registers a cleanup/dispose hook via `DyA.register` (bundle.js:+65203) |
| File I/O | Git bundle files written and then unlinked via `_K6.unlink` (bundle.js:+9349987); config files read via `readFileSync`; tmp directories managed |
| Network | HTTP POST to session creation endpoint; HTTP GET for environment list and GitHub App check; uses Axios (`OA.post`, `OA.get`, `OA.isAxiosError`, `OA.isCancel`) |
| Background process | Daemon background session spawned via `ed.spawn`; managed by `vVA`; IPC socket via `Wo8.connect`; cleanup via `TO.rm` / `TO.unlink` |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.176 | Initial analysis |

---

## Common Mistakes

1. **Running `/ultraplan` without a Claude.ai login** — The command requires a first-party Anthropic account authenticated via `/login`, not an API key. API key authentication alone will produce a `not_logged_in` or `not_first_party` error.

2. **No git remote configured** — The command requires a GitHub remote (`remote.origin.url`). Projects without a remote will fail with `no_git_remote`. Add one with `git remote add origin <REPO_URL>` before invoking.

3. **GitHub App not installed** — Even with a valid GitHub remote, the Anthropic GitHub App must be installed on the repository's organization. The `github_app_not_installed` error means the app has not been authorized; visit the GitHub App installation page.

4. **Invoking `/ultraplan` when a session is already launching** — Issuing the command a second time while the first is still in the "already launching" phase produces a warning and returns immediately. Wait for the first session to start before retrying.

5. **Organization policy blocks cloud sessions** — Enterprise organizations may disable cloud sessions via policy. The `policy_blocked` error requires an org admin to enable the feature; end users cannot work around it.

6. **Empty or uncommitted repository** — The teleport upload step requires at least one git commit. Repositories with no commits will receive the message "Repository has no commits — run `git add . && git commit -m \"initial\"` then retry".

7. **Providing no prompt** — Invoking `/ultraplan` without a `<prompt>` argument and without the word "ultraplan" appearing elsewhere in the conversation will trigger a usage hint rather than launching a session.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `UoL` | Main async handler for `/ultraplan` (entry point via load_ident) |
| `Dm8` | Prompt extraction coordinator (calls `Ym8`) |
| `Ym8` | Prompt normalization helper (calls `KLA`) |
| `KLA` | Keyword scan + slice logic; searches for "ultraplan" token, applies regex |
| `$9` | Eligibility / precondition check orchestrator |
| `Wg1` | Auth-type detection helper |
| `AJH` | Account / login status resolver |
| `xb` | Auth-type classifier (firstParty, enterprise, team) |
| `HP6` | Config file reader (readFileSync, utf-8) |
| `yLH` | Login state checker |
| `Aq` | Telemetry level resolver |
| `ycA` | Telemetry flag accessor |
| `A6` | String coercion / generic utility |
| `GLH` | Org-UUID resolver helper |
| `n$H` | App-state accessor |
| `YU6` | Launch orchestration layer (duplicate-launch guard, teleport call) |
| `d` | Generic async dispatcher |
| `K6` | Task / job scheduler primitive |
| `nM6` | Job registration utility |
| `f` | Promise lifecycle tracker (add/delete from in-flight set) |
| `F3K` | Session-state update helper |
| `Ag8` | Pre-flight check aggregator |
| `_g8` | Feature-flag pre-flight runner |
| `$6` | Feature-flag query / config reader |
| `koL` | Ultraplan-specific pre-flight check |
| `poL` | Full teleport + polling workflow coordinator |
| `ETH` | Remote eligibility check dispatcher |
| `Kyq` | `bg_remote_eligibility_check` implementation |
| `d9` | Error code classifier |
| `eG` | Error type sentinel A |
| `G5` | Error type sentinel B |
| `CoL` | Plan message builder ("Here is a draft plan to refine:") |
| `RoL` | Plan item renderer |
| `qo` | `teleportToRemote` core implementation |
| `x6` | Current-branch resolver |
| `nf` | Branch-name normalizer |
| `t$` | Token refresh helper |
| `uS8` | Access-token getter |
| `kH` | HTTP error logger / reporter |
| `Ib` | Axios error unwrapper |
| `F1` | OAuth endpoint validator (local/staging/prod) |
| `ID` | Auth-header builder |
| `OAA` | Git bundle upload subsystem (`teleport_git_bundle_upload`) |
| `S6` | Error-type tagger |
| `N` | Log-level message emitter (debug/warn/error) |
| `eH` | Event emitter / state broadcaster |
| `Pb` | Git remote URL getter (`git config --get remote.origin.url`) |
| `Nhq` | Remote task record constructor (randomUUID) |
| `zC6` | Session request body builder |
| `CH` | JSON serializer wrapper |
| `vhq` | Session-link telemetry recorder |
| `GS8` | Environment selector helper |
| `bHH` | `teleport_environments_list` implementation |
| `iq6` | Default environment auto-creator |
| `TH` | String coercion utility |
| `O` | Background session state map |
| `NOL` | Task title/branch generator (`teleport_generate_title`) |
| `rS` | BYOC session creation helper |
| `GmH` | `checkGithubAppInstalled` implementation |
| `xy` | Current git branch detector |
| `g1` | UI notification helper |
| `P_H` | Git remote URL parser |
| `i` | Output stream writer |
| `JA` | Error constructor wrapper |
| `Oz` | Cancel-check utility |
| `pz` | Axios cancel-token helper |
| `oY` | Claude.ai base URL resolver (local/staging/prod) |
| `x_` | HTTP client factory |
| `uU_` | HTTP client URL configurator |
| `uoL` | Ultraplan-specific session status renderer |
| `SmH` | Background remote-agent session driver (outer loop) |
| `tI` | Session token generator (randomBytes) |
| `pq6` | PTY/pipe opener for remote agent |
| `H0` | Session timestamp tracker |
| `OzL` | Session status string formatter |
| `$yq` | Background polling inner loop (message dispatch) |
| `Zv` | Task-state store manager |
| `u0L` | Task `task_started` state writer |
| `b0L` | Task `task_updated` state writer |
| `xKA` | State persistence helper |
| `m0L` | `local_workflow` state updater |
| `p0L` | Object-keyed workflow state updater |
| `mKH` | Task status classifier (active/aborted/user_typed) |
| `boL` | Main polling driver (`C3K` + state transitions) |
| `C3K` | Poll-loop executor with retry/timeout/ingestion |
| `yoL` | Session state initializer |
| `moL` | Mid-poll state updater |
| `CC6` | Session file cleanup (OPA / nK.unlink) |
| `K` | Column-padded display formatter |
| `BU` | Cloud session POST retry helper |
| `u9` | Cleanup hook registrar (DyA.register) |
| `xoL` | Post-launch task watcher |
| `C6` | Config file system accessor (reads/watches project config) |
| `Q6` | Config root path resolver |
| `ZN_` | Config schema validator |
| `G5H` | Config loader with stat/readdir/copyFile |
| `c6` | JSON.parse wrapper |
| `Jm` | Path prefix stripper |
| `E8` | Generic event-emitter helper |
| `gK9` | Config backup directory scanner |
| `vN_` | Backup path builder (xD.join + M_) |
| `$` | Set/Map utility with `kPK` backing |
| `D` | Background daemon session process manager |
| `b` | Background process record (spawn metadata) |
| `n8` | Async timeout wrapper (setTimeout/clearTimeout) |
| `bH` | Feature-bad telemetry helper |
| `IH` | Feature-ok telemetry helper |
| `Yd8` | macOS memory check helper |
| `aSH` | Session artifact cleanup (lstat/rm/readFile) |
| `Q` | PTY/IPC socket session lifecycle manager |
| `WVA` | Background session claim + socket connect |
| `vVA` | Background session full lifecycle driver |
| `Y` | Forced-shutdown handler (process.exit + z.abort) |
| `F` | Disposable resource handle |
| `ug4` | Config file watcher (z38.watchFile/unwatchFile) |
| `Kg` | Config watcher callback |
| `s76` | Parallel session-state refresh (Promise.all over Pb/rS/I4/x6/A6/GmH) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.