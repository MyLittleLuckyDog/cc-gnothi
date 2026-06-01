---
type: feature-spec
feature: "ultraplan"
cc_version: "2.1.146"
updated: "2026-06-01"
tags: ["ultraplan", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.146 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultraplan`

> Analysis basis: CC v2.1.146 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.146

---

## Overview

`/ultraplan` launches a remote planning session on Claude.ai: the local CLI packages the current git repository state, teleports it to a cloud environment, runs an AI-assisted planning agent there, and returns a draft plan that the user can edit and approve before execution continues. The command enforces several preconditions (login, git repo, GitHub remote, organizational policy) and falls back gracefully at each step with a descriptive error. Once a plan is approved, the remote session proceeds autonomously and delivers results as a pull request.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultraplan` |
| description | `... · Claude Code on the web drafts a plan you can edit and approve. See ...` |
| argumentHint | `<prompt>` |
| load_inline | `true` |
| load_ident | `Xb7` |
| loc_byte | `11647798` |
| loc_byte_end | `11648042` |
| loc_line | `9481` |
| arbor_handler.name | `Xb7` |
| arbor_handler.fqn | `claude-2.1.146::Xb7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `load_ident` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.146 bundle.js:+11647798

The handler is inlined via `Promise.resolve({call: Xb7})`; Arbor resolved it via `load_ident` path with a single unambiguous hit.

---

## Input Branching

The command has more than three distinct branching paths (prompt presence check, already-launching guard, remote eligibility, precondition checks, plan-ready/approved/failed states), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/ultraplan <prompt>]) --> B{allow_remote_sessions\nconfig flag set?}
    B -- No --> B1["Emit error:\npolicy_blocked\n(org policy message)"]
    B -- Yes --> C{Check prompt text:\ndoes it contain 'ultraplan'\nor is it a slash invocation?}
    C -- "already_polling / already_launching" --> D["Warn: already launching,\nplease wait"]
    C -- "No prompt / usage error" --> E["Emit usage hint:\n/ultraplan <prompt> or\ninclude 'ultraplan' in prompt"]
    C -- Valid prompt --> F[Run remote eligibility check\npreconditionChecker / udq]
    F --> G{not_logged_in?}
    G -- Yes --> G1["Error: Please run /login\n(Claude.ai account required)"]
    G -- No --> H{not_in_git_repo?}
    H -- Yes --> H1["Warn: not in a git repo"]
    H -- No --> I{no_git_remote?}
    I -- Yes --> I1["Error: Add GitHub remote\ngit remote add origin REPO_URL"]
    I -- No --> J{github_app_not_installed?}
    J -- Yes --> J1["Error: Setup GitHub at\nhttps://claude.ai/code"]
    J -- No --> K{policy_blocked?}
    K -- Yes --> K1["Error: Org policy disables\nremote sessions"]
    K -- No --> L[Build git bundle / teleport\nseed upload — zk_]
    L --> M[Generate title + branch\nvia titleGenerator — Z87]
    M --> N[Create remote session\nvia sessionCreator — Dd]
    N --> O{Session created OK?}
    O -- create_api_fail --> P["Error: create_api_fail\nSee --debug"]
    O -- teleport_null --> Q["Error: teleport_null\nSee --debug"]
    O -- Success --> R[Poll remote session\nstatePollLoop — Db7 / QT1]
    R --> S{Remote session state}
    S -- "plan_ready / requires_action" --> T["Display draft plan\nPrompt user to approve or refine"]
    T -- "Approved" --> U[Continue remote execution\n→ PR delivered]
    T -- "Refine local plan" --> V[Re-enter planning loop]
    S -- "approved" --> U
    S -- "terminated / archived" --> W["Emit: Remote Ultraplan\nsession failed"]
    S -- "timeout_pending / timeout_no_plan" --> X["Timeout error\n(max ~90 min / 5400 s)"]
    S -- "unexpected_error" --> Y["Emit unexpected error\nmessage, wait for user"]
    S -- "needs_input" --> Z["Emit awaiting_input event\nStream partial results"]
```

Analysis basis: CC v2.1.146 bundle.js:+11645941 (handler entry `Xb7`), +11643204 (`cT6` branching), +11644276 (`Pb7` session flow), +11639617 (`Db7` polling loop)

---

## Behavioral Spec

### 1. Handler Entry and Precondition Gate (`Xb7`)

```
async function ultraplanHandler(args, context):
    // Check org/account policy
    if not context.appState.allow_remote_sessions:
        emit error "policy_blocked"
        return

    // Normalize prompt from slash invocation
    rawPrompt = extractPrompt(args)           // calls promptExtractor (XD8)
    normalizedPrompt = normalizePromptText(rawPrompt)

    // Guard against concurrent launches
    if sessionState == "already_polling":
        warn "ultraplan: already launching. Please wait for the session to start."
        return
    if sessionState == "already_launching":
        warn "ultraplan: already launching. Please wait for the session to start."
        return

    // Validate prompt contains meaningful content
    if not normalizedPrompt or not valid:
        emit usage "Usage: /ultraplan <prompt>, or include 'ultraplan' anywhere in your prompt"
        return

    // Record invocation source as "slash"
    invocationSource = "slash"

    // Delegate to launch orchestrator
    result = await launchUltraplan(normalizedPrompt, context)  // cT6

    // Post-launch: update appState, archive orphaned sessions
    context.setAppState(...)
    if orphanedSession:
        archiveOrphanedSession()   // logs "ultraplan: failed to archive orphaned session"
```

Analysis basis: CC v2.1.146 bundle.js:+11645941, +11645962, +11646069, +11646276, +11646494

---

### 2. Prompt Extraction and Normalization (`XD8` → `LR_`)

```
function extractPrompt(rawInput):
    // Determine if input starts with a known prefix
    if rawInput.startsWith(knownPrefix):
        sliceIndex = 0               // literal: 0, loc +9415374
        remainder = rawInput.slice(sliceIndex)
    
    // Run matchAll with "gi" flag regex  // literal: "gi", loc +9415727
    matches = rawInput.matchAll(pattern, "gi")
    
    // Check if any existing session tokens match
    if sessions.some(matchesCurrent):
        pushToQueue(...)

    // Normalize: apply replacement pattern "$1$2"  // literal: "$1$2", loc +9416404
    // Truncate to length 5 if needed               // literal: 5, loc +9416427
    normalized = applyReplacement(rawInput, "$1$2")
    
    // Tag result with command name "ultraplan"     // literal: "ultraplan", loc +9416079
    return { prompt: normalized, tag: "ultraplan" }
```

Analysis basis: CC v2.1.146 bundle.js:+11645941, +9416279, +9415329, +9415727, +9416404

---

### 3. Remote Eligibility Check (`udq` — `preconditionChecker`)

The eligibility checker runs several sequential checks and aborts at the first failure.

```
async function preconditionChecker(context):
    // Emit telemetry: tengu_ccr_bundle_seed_enabled
    
    // 1. Login check
    if not hasAccessToken():
        return { code: "not_logged_in",
                 message: "Please run /login and sign in with your Claude.ai account (not Console)." }
    
    // 2. Git repo check
    if not isInGitRepo():
        return { code: "not_in_git_repo" }
    
    // 3. Git remote check
    if not hasGitRemote():
        return { code: "no_git_remote",
                 message: "Background tasks require a GitHub remote. Add one with `git remote add origin REPO_URL`." }
    
    // 4. GitHub app installation check
    orgUUID = getOrgUUID()
    if not orgUUID:
        log "checkGithubAppInstalled: No org UUID found, assuming app not installed"
        return { code: "github_app_not_installed" }
    
    githubStatus = await checkGithubApp(orgUUID)   // CNH
    // Logs "is" / "is not" installed
    if not githubStatus.installed:
        return { code: "github_app_not_installed",
                 message: ". Please setup GitHub on https://claude.ai/code" }
    
    // 5. Policy check (BYOC / org-level)
    if policyBlocksRemoteSessions():
        return { code: "policy_blocked",
                 message: "Remote sessions are disabled by your organization's policy. Contact your organization admin to enable them." }
    
    return { ok: true }
```

Analysis basis: CC v2.1.146 bundle.js:+8602266, +8602336, +8604164, +8604265, +8604403, +8604520, +8604674

---

### 4. Git Bundle / Teleport Seed Upload (`zk_` — `teleportGitBundleUpload`)

```
async function teleportGitBundleUpload(repoPath, context):
    // Emit telemetry: tengu_ccr_bundle_upload
    
    if not isGitRepo(repoPath):
        return { status: "empty_repo", error: "Not in a git repository" }
    
    // Clean up seed stash refs
    gitUpdateRef("-d", "refs/seed/stash")    // literal: "refs/seed/stash", +8526797
    gitUpdateRef("-d", "refs/seed/root")     // literal: "refs/seed/root",  +8526815
    
    // Check for commits
    refCount = gitForEachRef("--count=1", "refs/")  // +8526914
    if refCount == 0:
        // Try to stash
        stashResult = gitStash("create")             // literal: "create", +8527189
        if stashResult.status != 200:
            return { status: "stash_failed" }
    
    // Resolve HEAD
    headSHA = gitRevParse("--verify", "HEAD")        // +8527396
    
    // Create bundle file
    bundleFile = "ccr-seed.bundle"                   // literal: +8527835
    write bundle to "_source_seed.bundle"            // literal: +8528138
    
    // Attempt upload strategies in order: head, fallback_head, squashed, fallback_squashed
    for strategy in ["head", "fallback_head", "squashed", "fallback_squashed"]:
        result = tryUpload(strategy, bundleFile)
        if result.status == "success":
            // Clean up temp file
            unlinkSync(bundleFile)
            return { status: "success", strategy: strategy }
        if result.status == "failed":
            continue
    
    return { status: "upload_failed" }
```

Analysis basis: CC v2.1.146 bundle.js:+8526667, +8526696, +8526797, +8527189, +8527835, +8528138, +8528432

---

### 5. Session Creation (`Dd` — `remoteSessionCreator`)

```
async function remoteSessionCreator(prompt, context, bundleInfo):
    // Emit telemetry: tengu_teleport_bundle_mode
    
    // Determine source URL strategy
    bundleMode = determineBundleMode(bundleInfo)
    // Values: "too_large", "bundle", "explicit_env_bundle", "git_repository", "no_git_at_all"
    // Emit telemetry: tengu_teleport_source_decision
    
    // Get organization UUID
    orgUUID = getOrgUUID(context)    // QI
    if not orgUUID:
        throw Error("Unable to get organization UUID for remote session creation")
    
    // Build request headers
    headers = {
        "anthropic-beta": "ccr-byoc-2025-07-29",   // literal: +8541786
        "x-organization-uuid": orgUUID,              // literal: +8541808
        "Content-Type": "application/json"
    }
    
    // Check environments list (Ir — teleportEnvironmentsList)
    envs = await teleportEnvironmentsList(context)
    if envs is empty:
        // Auto-create default cloud environment (XrH — teleportDefaultEnvCreate)
        newEnv = await teleportDefaultEnvCreate(context)
        // Logs "[teleportToRemote] Auto-created default cloud env"
        // Default env spec: anthropic_cloud, /home/user, python 3.11, node 20
        if not newEnv:
            warn "Could not create a cloud environment. Set one up at https://claude.ai/code/onboarding?magic=env-setup"
    
    // Select environment ("bridge" preferred, else first available)
    selectedEnv = envs.find(e => e.type == "bridge") ?? envs[0]
    if not selectedEnv:
        throw Error("No environments available for session creation")
    
    // Generate task title and branch name (Z87 — taskTitleGenerator)
    { title, branch } = await taskTitleGenerator(prompt, selectedEnv)
    // Uses claude/task schema, max title length 75 chars  // literal: 75, +8529835
    // Emits telemetry: tengu_teleport_generate_title
    
    // Build session payload with randomUUID (qdq)
    sessionId = crypto.randomUUID()
    payload = buildSessionPayload(prompt, selectedEnv, title, branch, sessionId)
    
    // POST to remote API
    response = await httpClient.post(sessionEndpoint, payload, headers)
    // Handle status codes: 201 success, 401/403/429 auth/rate errors, 500 server error
    if response.status != 201:
        return { status: "create_api_fail" }
    
    if not response.data.session_id:
        throw Error("Server returned a malformed session response (no session id)")
    
    return { status: "success", sessionId: response.data.session_id }
```

Analysis basis: CC v2.1.146 bundle.js:+8540968, +8541786, +8541808, +8541382, +8542051, +8542587, +8543028, +8543120, +8543500

---

### 6. Plan Draft Display and Approval (`Pb7` — `planOrchestrator`)

```
async function planOrchestrator(session, prompt, context):
    // Emit telemetry: tengu_ultraplan_launched

    // Initial precondition display
    showPreconditionStatus(session)     // type: "precondition"

    // Show task notification bar
    showTaskNotification(session)       // type: "task-notification"

    // Build draft plan text for display
    draftText = buildDraftPlan(prompt)  // Yb7
    // Prepends "Here is a draft plan to refine:"   // literal: +11639185
    // Emits telemetry: tengu_ultraplan_prompt_identifier

    // Launch web session link opener (SD → qY_)
    openWebSessionLink(session)
    // Resolves environment URL:
    //   local:   "http://localhost:4000"            // literal: +4721245
    //   staging: "https://claude-ai.staging.ant.dev"// literal: +4721287
    //   prod:    "https://claude.ai"               // literal: +4721329

    // Wait for remote plan to arrive (Db7 / QT1 polling loop)
    planResult = await pollForPlan(session)         // Db7

    // Handle result states
    switch planResult.status:
        case "plan_ready":
            // Emit telemetry: tengu_ultraplan_plan_ready
            displayPlan(planResult.content)
            showButtons(["Refine local plan", "Approve"])
            // "Refine local plan" literal: +11644364

        case "approved":
            // Emit telemetry: tengu_ultraplan_approved
            emitMessage("Results will land as a pull request when the remote session finishes. There is nothing to do here.")
            // literal: +11640450

        case "terminated" or "archived":
            // Emit telemetry: tengu_ultraplan_failed
            emitMessage("Remote Ultraplan session failed. Wait for the user's next instructions.")
            // literal: +11641244

        case "timeout_pending" or "timeout_no_plan":
            emitTimeoutMessage(elapsedMinutes)

        case "unexpected_error":
            // Emit telemetry (inline in Pb7 at +11645320)
            emitMessage("Ultraplan hit an unexpected error during launch. Wait for the user's next instructions.")
            // literal: +11645478

        case "needs_input":
            // Emit telemetry: tengu_ultraplan_awaiting_input
            streamPartialResults(planResult)
```

Analysis basis: CC v2.1.146 bundle.js:+11644276, +11644284, +11644309, +11644364, +11644901, +11644953, +11645009, +11645148, +11645174

---

### 7. Remote Session Polling Loop (`Db7` / `QT1` — `sessionPoller` / `pollCycle`)

```
async function sessionPoller(sessionId, context):
    startTime = Date.now()
    maxTimeout = 5400 seconds              // literal: 5400, +11638878
    
    // Get or create polling tracker (fb7 / N6)
    tracker = getOrCreateTracker(sessionId)
    
    while true:
        elapsed = Date.now() - startTime
        if elapsed > maxTimeout * 1000:
            return { status: "timeout_no_plan" }
        
        pollResult = await pollCycle(sessionId, context)  // QT1
        
        switch pollResult.state:
            case "plan_ready":
                return { status: "plan_ready", content: pollResult.content }
            case "approved":
                return { status: "approved" }
            case "requires_action":
                // Emit telemetry: tengu_ultraplan_awaiting_input
                yield partialUpdate(pollResult)
            case "terminated" or "archived":
                return { status: "terminated" }
            case "error":
                retryCount++
                if retryCount > maxRetries:
                    return { status: "network_or_unknown",
                             message: "Lost connection to the remote session after repeated retries — the session may still be running" }
                    // literal: +11630202
            case "running":
                // continue polling
        
        // Polling interval: 1000 ms, max 1800000 ms  // literals: +8610444, +8610451
        await sleep(pollIntervalMs)
        
        elapsedMinutes = Math.round(elapsed / 60000)  // literal: 60000, +11631024
        emitProgressUpdate(elapsedMinutes, "minute" / "minutes")
```

Analysis basis: CC v2.1.146 bundle.js:+11639312, +11639408, +11638878, +11630202, +8610444, +8610451, +11631024

---

### 8. Config and Account Eligibility Check (`AK` — `accountEligibilityChecker`)

```
function accountEligibilityChecker(context):
    // Check feature flags set
    if featureSet.has("allow_product_feedback"):    // literal: +4659271
        pass
    
    // Check org type
    orgType = getOrgType(context)   // om
    // Accepted values: "firstParty", "enterprise", "team"
    // literals: +4655710, +4655996, +4656031
    
    if orgType in ["enterprise", "team"]:
        return { eligible: true }
    
    // Read config file (ao9 → readFileSync with "utf-8")
    configData = readConfigFile("utf-8")  // literal: +4657885
    
    // Check telemetry preference
    telemetryMode = configData.telemetry
    // Values: "essential-traffic", "no-telemetry", "default"
    // literals: +959957, +960016, +960090
    
    return { eligible: orgType == "firstParty", telemetryMode }
```

Analysis basis: CC v2.1.146 bundle.js:+4659224, +4659240, +4659271, +4655710, +4655996, +4656031, +4657862, +4657885

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_ultraplan_create_failed` | Fired when the remote session creation API call fails (loc +11643241) |
| Telemetry: `tengu_ultraplan_prompt_identifier` | Fired when the draft plan prompt is constructed (loc +11639011) |
| Telemetry: `tengu_ultraplan_launched` | Fired after session created and web link opened (loc +11644911) |
| Telemetry: `tengu_ultraplan_timeout_seconds` | Fires with elapsed seconds on timeout; max 5400 s (loc +11638844) |
| Telemetry: `tengu_ultraplan_awaiting_input` | Fires when remote session enters `needs_input` / `requires_action` state (loc +11639488) |
| Telemetry: `tengu_ultraplan_plan_ready` | Fires when remote plan draft is received (loc +11639556) |
| Telemetry: `tengu_ultraplan_approved` | Fires when user approves the plan (loc +11639964) |
| Telemetry: `tengu_ultraplan_failed` | Fires when the remote session terminates with failure (loc +11640837) |
| Telemetry: `tengu_ccr_bundle_seed_enabled` | Fires during remote eligibility check (loc +8602336) |
| Telemetry: `tengu_ccr_bundle_upload` | Fires during git bundle upload attempt (loc +8526989) |
| Telemetry: `tengu_teleport_bundle_mode` | Fires with bundle mode decision (loc +8542196) |
| Telemetry: `tengu_ccr_session_link` | Fires with the remote session link (loc +8536596) |
| Telemetry: `tengu_teleport_source_decision` | Fires with the chosen source strategy (loc +8547197) |
| Telemetry: `tengu_teleport_generate_title` | Fires after title/branch generation for the task (loc +8530139) |
| Telemetry: `tengu_slate_kestrel` | Fires during account/org eligibility check (loc +4655910) |
| Telemetry: `tengu_config_parse_error` | Fires on config file parse failure (loc +3171293) |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Background daemon escalation event (loc +15060413) |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` | Feature flag check result events (loc +955938, +955996) |
| Telemetry: `tengu_bg_low_mem_mb` / `tengu_bg_dispatch_low_mem` | Low-memory daemon guard events |
| Telemetry: `tengu_daemon_idle_exit` / `tengu_bg_spare_enable` / `tengu_bg_spare_claim` / `tengu_bg_spare_spawn` / `tengu_bg_spare_claim_fail` / `tengu_bg_sendclaim_failed` | Background daemon spare-process lifecycle events |
| appState read | `_.getAppState()` called at loc +11646276 to read `allow_remote_sessions` and session state |
| appState write | `_.setAppState()` called at loc +11646494 to persist session state after launch |
| File system | Git bundle temp file `ccr-seed.bundle` / `_source_seed.bundle` created and unlinked during teleport seed upload (loc +8527835, +8528138, +8528771) |
| File system | Config file read via `readFileSync` (loc +4657862) |
| File system | Backup config copies via `copyFileSync` (loc +3171801) |
| Network | HTTP POST to remote session API (loc +8543028); GET for environment list (loc +8490527) |
| Browser open | `Co.open` called to open the Claude.ai web session link (loc +12644325) |
| Hook registration | `c9` → `c_A.register` is called during plan orchestrator setup (loc +57267) |
| Timeout | Remote session polling hard-capped at 5400 seconds (≈ 90 minutes); polling interval 1000 ms with max wait 1 800 000 ms (30 minutes) (loc +11638878, +8610444, +8610451) |
| Concurrent-launch guard | `already_polling` / `already_launching` state literals prevent duplicate launches (loc +11643456, +11643474) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.146 | Initial analysis |

---

## Common Mistakes

1. **Using an API key instead of a Claude.ai account login.** The command explicitly requires OAuth authentication (`/login` with a Claude.ai account). API key users will receive the `not_logged_in` error with a message directing them to `/login`. Analysis basis: CC v2.1.146 bundle.js:+8604164
2. **Running outside a git repository or without a GitHub remote.** Both conditions are hard preconditions. A repo without a remote will fail with `no_git_remote` and a prompt to run `git remote add origin REPO_URL`. Analysis basis: CC v2.1.146 bundle.js:+8604265, +8604403
3. **Running in a repository with no commits.** The teleport seed uploader requires at least one commit. Users will see "Repository has no commits — run `git add . && git commit -m "initial"` then retry". Analysis basis: CC v2.1.146 bundle.js:+8546634
4. **Triggering a second `/ultraplan` while one is already running.** The command silently guards with `already_polling` / `already_launching` and emits a single warning rather than launching a parallel session. Analysis basis: CC v2.1.146 bundle.js:+11643456, +11643474, +11642068
5. **Expecting immediate local results.** The command delivers its output as a pull request after the remote session finishes; the local terminal is non-blocking after approval and shows only status messages. Analysis basis: CC v2.1.146 bundle.js:+11640450
6. **Organization policy blocking remote sessions.** Enterprise accounts may have remote sessions disabled by admin policy (`policy_blocked`). The error message directs users to contact their organization administrator. Analysis basis: CC v2.1.146 bundle.js:+8604674, +8604697

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Xb7` | Main handler — `ultraplanHandler` (AsyncFunction, entry point) |
| `XD8` | Prompt extraction and normalization dispatcher |
| `PD8` | Prompt pre-processor sub-step |
| `LR_` | Raw prompt normalizer (regex match, slice, replace) |
| `AK` | Account / org eligibility checker |
| `to9` | Eligibility check delegator |
| `Wz_` | Eligibility resolution helper |
| `om` | Org type resolver (firstParty / enterprise / team) |
| `ao9` | Config file reader (readFileSync utf-8) |
| `X1` | Telemetry mode resolver |
| `lYA` | Telemetry string builder |
| `mH` | String coercion utility |
| `kGH` | Secondary string formatter |
| `C4H` | Session state container / carrier |
| `cT6` | Launch orchestrator (pre-session setup) |
| `c` | Generic async wrapper / promise utility |
| `L` | Tracked promise helper (add/delete/finally) |
| `aT1` | Agent type token |
| `c28` | Context builder for launch |
| `d28` | Dispatch context assembler |
| `N6` | Feature-flag / permission checker |
| `$b7` | Session metadata builder |
| `Pb7` | Plan orchestrator (main remote session driver) |
| `VwH` | Remote eligibility wrapper |
| `udq` | Precondition checker (login / git / github / policy) |
| `Yb7` | Draft plan text builder |
| `zb7` | Plan section formatter |
| `Dd` | Remote session creator (full lifecycle) |
| `x6` | Context accessor |
| `u3` | Lq_ caller (queue utility) |
| `Jk_` | Access-token fetcher |
| `SH` | Error logger / push helper |
| `QI` | Org UUID resolver |
| `V9` | Environment URL selector (local/staging/prod) |
| `_Y` | HTTP header builder (DqH delegator) |
| `zk_` | Git bundle / teleport seed upload handler |
| `S6` | Utility value extractor |
| `N` | General-purpose string formatter |
| `Mh` | Git remote URL resolver (remote.origin.url) |
| `qdq` | Session payload builder (randomUUID) |
| `CH` | JSON serializer wrapper |
| `Adq` | Session link emitter |
| `Ir` | Teleport environments list fetcher |
| `XrH` | Default cloud environment auto-creator |
| `ZH` | String coercion / cast helper |
| `Z87` | Task title and branch name generator |
| `UC` | Permission mode setter |
| `CNH` | GitHub app installation checker |
| `sV` | Default branch resolver (main/master) |
| `mq` | Miscellaneous queue / signal helper |
| `n_` | Error normalizer (Error / String) |
| `bc` | Cancellation guard |
| `Cz` | Abort signal helper |
| `SD` | Web session link opener setup |
| `l_` | Module initializer / bind helper |
| `qY_` | Claude.ai URL resolver (local/staging/prod) |
| `jb7` | Boolean flag transformer |
| `dNH` | Remote agent session launcher (dNH) |
| `TN` | Random byte generator for session token |
| `$rH` | Browser open helper (Co.open) |
| `IX` | Session pending state watcher |
| `H_7` | Session state string builder |
| `Bdq` | Remote session state machine / stream ingestor |
| `Ly` | Task stream listener / dispatcher |
| `e77` | Task started event handler |
| `s77` | Task updated event handler |
| `tS_` | Stream state transition helper |
| `H57` | Hook progress handler |
| `_57` | Hook response handler |
| `a6H` | User-typed message event handler |
| `Db7` | Session poller orchestrator |
| `QT1` | Single poll cycle executor |
| `fb7` | Polling tracker initializer |
| `Jb7` | Plan-ready result extractor |
| `GX6` | Temp file cleanup helper |
| `K` | String padding / column formatter |
| `Ox` | Session POST retry helper |
| `c9` | Hook registration wrapper (c_A.register) |
| `wb7` | Orphaned session cleanup helper |
| `m6` | Config accessor (main entry) |
| `Q6` | Config path resolver |
| `pK_` | Config permission guard |
| `Y$H` | Config read/write handler |
| `g6` | JSON.parse wrapper |
| `AC` | Config path prefix stripper |
| `L8` | Config schema validator |
| `rI9` | Config directory reader |
| `cK_` | Config backup path builder |
| `$` | Traversal / filter utility |
| `w` | Background session process manager |
| `C` | Supervisor process helper |
| `uH` | Feature-ok signal emitter |
| `bH` | Feature-bad signal emitter |
| `rE6` | Memory check reporter |
| `x` | Idle-timeout tracker |
| `AHA` | Background session connection handler |
| `$HA` | Background session lifecycle manager |
| `D` | Spare process disposer |
| `S` | Spare process state holder |
| `cB4` | Config file watcher |
| `zn` | Config change notifier |
| `ZtH` | Session initialization helper (Promise.all setup) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.