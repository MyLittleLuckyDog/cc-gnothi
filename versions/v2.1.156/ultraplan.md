---
type: feature-spec
feature: "ultraplan"
cc_version: "2.1.156"
updated: "2026-06-02"
tags: ["ultraplan", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.156 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultraplan`

> Analysis basis: CC v2.1.156 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.156

---

## Overview

`/ultraplan` launches a remote Claude Code web session that drafts an implementation plan the user can review and approve before execution proceeds. The command bundles local git state, teleports it to a cloud environment, and polls the resulting remote session until the plan is ready for user sign-off or until a terminal outcome (approval, failure, timeout) is reached. Results are delivered back as a pull request once the remote session completes.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultraplan` |
| description | `… · Claude Code on the web drafts a plan you can edit and approve. See …` |
| argumentHint | `<prompt>` |
| load_inline | `true` |
| load_ident | `zK5` |
| loc_byte | `11929803` |
| loc_byte_end | `11930047` |
| loc_line | `8772` |
| arbor_handler.name | `zK5` |
| arbor_handler.fqn | `claude-2.1.156::zK5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `load_ident` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.156 bundle.js:+11929803

The handler was inlined into a `load:()=>Promise.resolve({call: zK5})` shape. The Arbor symbol graph resolved `zK5` via the `load_ident` path with exactly one hit, confirming it is the sole handler for this command.

---

## Input Branching

The command has more than three distinct decision paths (eligibility checks, guard states, polling outcomes, plan-approval flow), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/ultraplan <prompt> invoked"]) --> B{allow_remote_sessions\nconfigured?}
    B -- No --> C[Return early:\npolicy blocked message]
    B -- Yes --> D{User logged in\nwith Claude.ai account?}
    D -- No --> E[Return error:\nnot_logged_in\nPlease run /login …]
    D -- Yes --> F{Inside a git repo?}
    F -- No --> G[Return error:\nnot_in_git_repo]
    F -- Yes --> H{Git remote present\n(github.com)?}
    H -- No --> I[Return error:\nno_git_remote\nAdd origin REPO_URL]
    H -- Yes --> J{GitHub App installed\nfor org?}
    J -- No --> K[Return error:\ngithub_app_not_installed\nSetup at claude.ai/code]
    J -- Yes --> L{State: already_polling\nor already_launching?}
    L -- already_launching --> M[Return error:\nultraplan: already launching…]
    L -- already_polling --> N[Attach to existing\npolling session]
    L -- Neither --> O[Run eligibility check\nbg_remote_eligibility_check]
    O --> P{Prompt contains\n"ultraplan" keyword\nor command invoked?}
    P --> Q[Extract / build prompt]
    Q --> R[Bundle git state\n& upload seed\n(teleport_git_bundle_upload)]
    R --> S{Bundle mode decision\ntengu_teleport_bundle_mode}
    S -- too_large --> T[Warn; use fallback source]
    S -- ok --> U[POST session create\nvia Ml / remote session API]
    U --> V{HTTP response}
    V -- 401/403/429 --> W[Auth / rate error]
    V -- 500 / malformed --> X[create_api_fail / teleport_null]
    V -- 201 Created --> Y[Store session id\nBegin polling loop LK5]
    Y --> Z{Poll outcome}
    Z -- plan_ready --> AA[Present plan to user\nfor approval]
    AA --> AB{User approves?}
    AB -- Yes --> AC[Send approval event\ntengu_ultraplan_approved\nEmit: results land as PR]
    AB -- No / edit --> AD[Refine local plan\nloop back]
    Z -- needs_input --> AE[Await user input\ntengu_ultraplan_awaiting_input]
    Z -- approved --> AC
    Z -- terminated / failed --> AF[tengu_ultraplan_failed\nReport error]
    Z -- timeout_pending\nor timeout_no_plan --> AG[Timeout error message]
    Z -- unexpected_error --> AH[tengu_ultraplan unexpected\nerror; wait for instructions]
```

Analysis basis: CC v2.1.156 bundle.js:+11927947, +11925210, +11921319, +11912901

---

## Behavioral Spec

### 1. Handler Entry — `ultraplanHandler` (`zK5`)

```
async function ultraplanHandler(context):
    // Check org policy
    if not appState.allow_remote_sessions:
        return policyBlockedError()            // "policy_blocked"

    // Read current guard flags
    guardState = getGuardState(context)        // calls buildPromptContext (v9)
    if guardState == "already_launching":
        return earlyReturn("already launching. Please wait…")
    if guardState == "already_polling":
        attachToExistingSession()
        return

    // Identify prompt source ("slash" invocation)
    promptSource = "slash"
    promptText   = extractPrompt(context)       // normalisePrompt (PG8)

    // Launch the remote session workflow
    result = await launchUltraplanSession(context, promptText, promptSource)

    // Update app state on completion
    appState.setAppState(result)
```

Analysis basis: CC v2.1.156 bundle.js:+11928000, +11928075, +11928282, +11928500

### 2. Prompt Normalisation — `normalisePrompt` (`PG8`)

```
function normalisePrompt(rawInput):
    // Strip leading command token via parseCommandArgs (XG8 → FQ_)
    parts = parseCommandArgs(rawInput)

    // If the word "ultraplan" appears anywhere in the input string,
    // the remainder is treated as the task description
    if parts.startsWith("ultraplan"):          // literal: "ultraplan" +9676437
        taskText = parts.slice(relevant_offset)
    else:
        taskText = parts

    // Apply a substitution pattern ($1$2) to clean up whitespace runs
    taskText = taskText.replace(pattern_gi, "$1$2")  // literals: "gi" +9676085, "$1$2" +9676763

    // Trim to a maximum of 5 segments
    return taskText.slice(0, 5)                // literal: 5 +9676786
```

Analysis basis: CC v2.1.156 bundle.js:+11927947, +9676437, +9676085, +9676763, +9676786

### 3. Eligibility / Precondition Check — `eligibilityCheck` (`W11`)

```
async function eligibilityCheck(context):
    emit telemetry("bg_remote_eligibility_check")   // literal +8882559

    // 1. Authentication
    loginInfo = await getLoginInfo(v9)
    if not loginInfo or loginInfo.type != "firstParty":  // literal +4104560
        return { code: "not_logged_in",              // literal +8884403
                 message: "Please run /login …"      // literal +8884425 }

    // 2. Git repository presence
    if not inGitRepo():
        return { code: "not_in_git_repo" }           // literal +8884504

    // 3. GitHub remote
    originUrl = getGitRemoteOriginUrl()              // git config --get remote.origin.url +1062354
    if not originUrl or not originUrl.includes("github.com"):  // literal +8883150
        return { code: "no_git_remote",
                 message: "Background tasks require a GitHub remote…" }  // literal +8884664

    // 4. GitHub App installation
    appInstalled = await checkGithubAppInstalled()
    if not appInstalled:
        return { code: "github_app_not_installed" }  // literal +8884759

    // 5. Org policy
    if policyBlocked():
        return { code: "policy_blocked",
                 message: "Remote sessions are disabled by your organization's policy…" }  // literal +8884936

    return { ok: true }
```

Analysis basis: CC v2.1.156 bundle.js:+8882489, +8882559, +8884403, +8884504, +8884664, +8884759, +8884936

### 4. Git Bundle & Seed Upload — `gitBundleUpload` (`yU_`)

```
async function gitBundleUpload(sessionParams):
    emit telemetry("teleport_git_bundle_upload")     // literal +8798396

    if not inGitRepo():
        throw Error("Not in a git repository")       // literal +8798457

    // Check for commits
    hasCommits = git("for-each-ref", "--count=1", "refs/")  // literals +8798599, +8798614, +8798626
    if not hasCommits:
        throw Error("Repository has no commits yet")  // literal +8798803

    // Stash working-tree changes under a seed ref
    stashOid = git("stash", "create")                // literals +8798881, +8798889
    if stashOid and stashOid.status == 200:
        git("update-ref", "refs/seed/stash", stashOid)  // literals +8798548, +8798497
    headOid = git("rev-parse", "--verify", "HEAD")   // literals +8799233, +8799245, +8799256

    // Create bundle file named "ccr-seed.bundle"
    bundlePath = tmpDir + "ccr-seed.bundle"          // literals +8799684, +8799695
    writeBundleFile(bundlePath)

    // Upload via signed URL
    uploadResult = uploadBundle(bundlePath)
    emit telemetry("tengu_ccr_bundle_upload")        // +8798689

    // Determine bundle mode
    mode = decideBundleMode(uploadResult)            // tengu_teleport_bundle_mode +8814043
    // Possible modes: "head", "fallback_head", "squashed",
    //                 "fallback_squashed", "too_large", "bundle",
    //                 "explicit_env_bundle", "git_repository"

    return { bundleMode: mode, headOid: headOid }
```

Analysis basis: CC v2.1.156 bundle.js:+8798396, +8798457, +8798803, +8799684, +8799695, +8814043

### 5. Remote Session Creation — `createRemoteSession` (`Ml`)

```
async function createRemoteSession(params):
    // Validate org UUID
    orgUuid = getOrgUuid()
    if not orgUuid:
        throw Error("Unable to get organization UUID for remote session creation")  // literal +8813294

    // Build request headers including beta flag
    headers = {
        "anthropic-beta": "ccr-byoc-2025-07-29",    // literal +8813633
        "x-organization-uuid": orgUuid,              // literal +8813655
        "Content-Type": "application/json"           // literal +3153367
    }

    // POST to sessions endpoint
    response = await httpClient.post(sessionEndpoint, payload, headers)

    if response.status >= 500:
        return { code: "create_api_fail" }           // literal +11926606
    if response.status in [401, 403, 429]:
        handleAuthOrRateError(response)
    if response.status == 201:
        sessionId = response.data.id
        if not sessionId:
            throw Error("Server returned a malformed session response (no session id)")  // literal +8815392

    emit telemetry("tengu_ccr_session_link")         // +8808444
    return { sessionId: sessionId }
```

Analysis basis: CC v2.1.156 bundle.js:+8813294, +8813633, +8813655, +8814875, +8815035, +8815039, +8815043, +8815392

### 6. Session Polling Loop — `pollSessionLoop` (`LK5`)

```
async function pollSessionLoop(sessionId, startTime):
    timeout_ms = 5400 * 1000   // 5400 seconds total  (literal +11920885)
    pollIntervalMs = 1000      // 1 second between polls (literal +8890994)
    maxRuntimeMs   = 1800000   // 30-minute cap       (literal +8891001)

    loop:
        elapsed = Date.now() - startTime
        if elapsed > timeout_ms:
            emit telemetry("tengu_ultraplan_timeout_seconds")   // +11920851
            return timeoutResult()

        session = await fetchSession(sessionId)   // pollFetch (mB1)
        status  = session.status

        switch status:
            case "plan_ready":
                emit telemetry("tengu_ultraplan_plan_ready")    // +11921563
                planText = extractPlan(session)
                return { outcome: "plan_ready", plan: planText }

            case "needs_input":
                emit telemetry("tengu_ultraplan_awaiting_input") // +11921495
                waitForUserInput()
                continue

            case "approved":
                emit telemetry("tengu_ultraplan_approved")       // +11921971
                return { outcome: "approved" }

            case "terminated" | "failed":
                emit telemetry("tengu_ultraplan_failed")         // +11922844
                return { outcome: "failed", error: session.error }

            case "requires_action":
                handleAction(session)
                continue

            case "running" | "starting" | "pending":
                sleep(pollIntervalMs)
                continue

        if networkError(session):
            if retryExhausted():
                return { outcome: "network_or_unknown",          // literal +11912135
                         message: "Lost connection to the remote session after repeated retries…" }  // literal +11912209
            sleep(pollIntervalMs)
            continue
```

Analysis basis: CC v2.1.156 bundle.js:+11920885, +11921319, +11921563, +11921495, +11921971, +11922844, +8890994, +8891001

### 7. Plan Presentation & Approval — `presentPlan` (`OK5`)

```
async function presentPlan(plan, sessionId):
    // Prefix draft plan with a fixed preamble
    prefixedPlan = "Here is a draft plan to refine:\n" + plan   // literal +11921192

    // Display to user via task-notification channel
    notifyUser({ type: "task-notification",   // literal +11926227
                 title: "Ultraplan",          // literal +11927073
                 body: prefixedPlan })

    // Offer "Refine local plan" action
    actions = [{ label: "Refine local plan",  // literal +11926370
                 value: "plan" }]             // literal +11926405

    userChoice = await awaitUserResponse(actions)

    if userChoice == "plan":
        // Re-enter refinement: emit approval and inject result message
        emit telemetry("tengu_ultraplan_approved")
        injectMessage("Results will land as a pull request when the remote session finishes. "
                      + "There is nothing to do here.")          // literal +11922457
    else:
        injectMessage("Remote Ultraplan session failed. "
                      + "Wait for the user's next instructions.")  // literal +11923251
```

Analysis basis: CC v2.1.156 bundle.js:+11921192, +11926227, +11926370, +11926405, +11927073, +11922457, +11923251

### 8. Error / Guard State Handling — `launchOrchestrator` (`Sk6`)

```
async function launchOrchestrator(context, promptText, promptSource):
    // Debounce: reject if already in flight
    if appState.guard == "already_launching":   // literal +11925480
        emit telemetry("tengu_ultraplan_create_failed")   // +11925247
        return errorMessage("ultraplan: already launching. Please wait for the session to start.")
                                                // literal +11924074

    // Validate that a usable prompt was provided
    if not promptText or
       (promptText == "Usage: /ultraplan <prompt>, or include \"ultraplan\" anywhere"  // literal +11925526
        + " in your prompt"):                   // literal +11925592
        return usageHint()

    // Attempt session creation
    setGuard("already_launching")
    try:
        result = await createAndMonitorSession(promptText, promptSource)
    catch unexpectedError:
        emit telemetry("tengu_ultraplan_create_failed")   // +11925247
        // After 1500 ms delay surface to user
        sleep(1500)                             // literal +11927258
        injectMessage("Ultraplan hit an unexpected error during launch. "
                      + "Wait for the user's next instructions.")  // literal +11927484
        return { code: "unexpected_error" }    // literal +11927326
    finally:
        clearGuard()
```

Analysis basis: CC v2.1.156 bundle.js:+11925247, +11924074, +11925526, +11927258, +11927484, +11927326

### 9. Session Link Helper — `getSessionLink` (`u86`)

```
async function getSessionLink(sessionId):
    // Resolve correct base URL per environment
    baseUrl = resolveBaseUrl()                  // local: +4769873, staging: +4769915, prod: +4769957

    await Promise.all([
        checkAuthState(BS),
        checkFeatureFlags(ky),
        checkContextState(I4)
    ])

    // Build clickable URL for the remote session
    sessionUrl = baseUrl + "/claude/task/" + sessionId   // literal "claude/task" +8801690
    return sessionUrl
```

Analysis basis: CC v2.1.156 bundle.js:+11928471, +4769873, +4769915, +4769957, +8801690

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — ultraplan lifecycle | `tengu_ultraplan_create_failed`, `tengu_ultraplan_prompt_identifier`, `tengu_ultraplan_launched`, `tengu_ultraplan_timeout_seconds`, `tengu_ultraplan_awaiting_input`, `tengu_ultraplan_plan_ready`, `tengu_ultraplan_approved`, `tengu_ultraplan_failed` |
| Telemetry — CCR / teleport | `tengu_ccr_bundle_seed_enabled`, `tengu_ccr_bundle_upload`, `tengu_teleport_bundle_mode`, `tengu_ccr_session_link`, `tengu_teleport_source_decision`, `tengu_teleport_bundle_mode`, `tengu_teleport_generate_title`, `tengu_teleport_environments_list`, `tengu_teleport_default_environment_create` |
| Telemetry — background dispatch | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_low_mem_mb`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_sendclaim_failed`, `tengu_bg_spare_claim`, `tengu_bg_spare_spawn`, `tengu_bg_spare_claim_fail` |
| Telemetry — config / feature | `tengu_config_parse_error`, `tengu_feature_bad`, `tengu_feature_ok` |
| appState reads | `allow_remote_sessions` (org policy flag), guard state (`already_polling`, `already_launching`) |
| appState writes | `_.setAppState(result)` called at handler exit (+11928500); guard flags set and cleared around session launch |
| File system | Git stash bundle written to tmp as `ccr-seed.bundle`; `_source_seed.bundle` intermediate; unlinkSync on cleanup |
| Network | HTTP POST to remote sessions API; HTTP GET polling; Axios cancel-token checked |
| `setTimeout` usage | 1 500 ms delay before surfacing unexpected-error message (+11927258); 1 000 ms poll interval; 10 000 ms retry back-off in `lu` (+8822003) |
| Plan injection | On approval: literal message "Results will land as a pull request…" injected into conversation context |
| Orphan-session cleanup | Archived orphaned sessions on launch; logged as "ultraplan: failed to archive orphaned session" (+11927632) |
| Hook registration | `_9` → `f$A.register` (+58450) — hooks registered during background-task lifecycle |

---

## Version History

| Version | Change |
|---|---|
| v2.1.156 | Initial analysis |

---

## Common Mistakes

1. **Invoking without a Claude.ai login.** The command requires OAuth (`firstParty` auth type), not an API key. Running `/ultraplan` with only an API key set produces the error: "Claude Code web sessions require authentication with a Claude.ai account. API key authentication is not sufficient." Run `/login` first.

2. **No GitHub remote configured.** The command hard-requires a `github.com` remote (`remote.origin.url`). A local-only or non-GitHub remote produces the `no_git_remote` error. Fix: `git remote add origin REPO_URL`.

3. **Invoking in a repository with no commits.** An empty repository (no commits yet) causes the bundle upload to abort with "Repository has no commits — run `git add . && git commit -m \"initial\"` then retry".

4. **GitHub App not installed for the organization.** The command queries whether the GitHub App is active for the org UUID. If the app is absent, the command exits with `github_app_not_installed` and instructs the user to visit `https://claude.ai/code`.

5. **Double-invocation during launch.** Calling `/ultraplan` again while a session is still initialising triggers the `already_launching` guard and returns immediately. Wait for the first session to start or to fail before re-invoking.

6. **Org policy blocking remote sessions.** An admin can disable remote sessions via policy. The command surfaces `policy_blocked` with the message "Remote sessions are disabled by your organization's policy. Contact your organization admin to enable them."

7. **Expecting an immediate inline answer.** Results are delivered as a pull request, not as chat output. The literal injected message states: "Results will land as a pull request when the remote session finishes. There is nothing to do here."

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `zK5` | Main handler (`ultraplanHandler`) — async entry point for `/ultraplan` |
| `PG8` | Prompt normalisation (`normalisePrompt`) — strips command token, applies regex, trims |
| `XG8` | Command-args parser wrapper (calls `FQ_`) |
| `FQ_` | Core argument-parsing implementation; does `startsWith`, `matchAll`, `some`, `push` |
| `v9` | Auth / guard context builder — checks `allow_remote_sessions`, `allow_product_feedback`, login state |
| `H89` | Auth info loader (calls `iD6`) |
| `iD6` | Auth detail resolver (calls `CR`, `nD6`, `I4H`) |
| `CR` | Auth credential helpers (`GA`, `R5`, `u$`, `bP`, `Uq`) |
| `nD6` | Config file reader (`readFileSync`, encoding utf-8) |
| `I4H` | License/tier checker — inspects `enterprise`, `team`, `firstParty` strings |
| `q1` | Telemetry-mode resolver (checks `essential-traffic`, `no-telemetry`) |
| `zEA` | Telemetry transport wrapper |
| `xH` | String coercion helper |
| `VKH` | String-formatting utility |
| `_5H` | App-state accessor helper |
| `Sk6` | Launch orchestrator — debounce guard, prompt validation, session kick-off |
| `d` | General async task-runner / deferred executor |
| `L` | Set-based guard tracker (`add`, `delete`, `finally`) |
| `cB1` | Context-builder helper |
| `rN8` | Session-notification registrar |
| `iN8` | Notification dispatch implementation |
| `E6` | Event-emitter core (`hz6`, `Sz6`, `Mx`, `hzH`, `Iz6`) |
| `_K5` | Notification-type classifier |
| `OK5` | Full session-creation + plan-presentation pipeline |
| `fXH` | Feature-flag / eligibility-check wrapper (calls `W11`) |
| `W11` | Eligibility check implementation (`bg_remote_eligibility_check`) |
| `KK5` | Plan-text assembler (pushes lines, joins with delimiter, prepends preamble) |
| `qK5` | Plan-section formatter |
| `Ml` | Remote-session creation state machine (main HTTP logic) |
| `C6` | Configuration reader |
| `WO` | OAuth endpoint selector (`m3_`) |
| `bU_` | Access-token retrieval |
| `hH` | Log-error utility (`logError`) |
| `pb` | Request parameter builder |
| `Sq` | Base-URL resolver (validates `local`, `staging`, `prod`, custom OAuth) |
| `jX` | HTTP header builder (`Content-Type`, `anthropic-version`, `anthropic-beta`) |
| `yU_` | Git bundle seed uploader (`teleport_git_bundle_upload`) |
| `k6` | Small utility (calls `ov`) |
| `N` | Log-level router (`debug`, `warn`, `error`, `info`, `toUpperCase`) |
| `BS` | Git remote-URL resolver (`git config --get remote.origin.url`) |
| `B91` | Control-request builder (`control_request`, `set_permission_mode`, `randomUUID`) |
| `RH` | JSON serialiser wrapper |
| `U91` | Session-link data builder |
| `ua` | Environment-list fetcher (`teleport_environments_list`) |
| `QtH` | Default-environment creator (`teleport_default_environment_create`) |
| `ZH` | String coercion / safe-string helper |
| `iGL` | Session-title generator (`teleport_generate_title`; calls Zod schema) |
| `ky` | Feature-flag checker (checks `hzH`, `Iz6`, `y88`) |
| `oyH` | GitHub-App installation checker |
| `ON` | Default-branch resolver (`symbolic-ref`, `main`, `master`) |
| `J9` | JSX render helper (`Ce`, `e9`, `$X`) |
| `c` | Active-tool-use filter (`gh8`) |
| `et` | Remote-URL validator (regex match, `https`, `http`, depth 3/4) |
| `F_` | Error normaliser |
| `LP` | Cancel-check helper |
| `OY` | Error-display renderer |
| `Ow` | Claude.ai base-URL picker (`G_`, `q`, `o0_`) |
| `G_` | Module export initialiser |
| `o0_` | Staging / prod URL table (`Zj6`, `dV7`) |
| `MK5` | State-mutation helper for session record |
| `MhH` | Remote-agent session monitor (polling outer wrapper) |
| `Sk` | Random-bytes session-token generator |
| `utH` | Browser-open helper (`Bs.open`) |
| `J2` | Session start-time recorder |
| `kTL` | Duration formatter (seconds → `minute` / `minutes`) |
| `E11` | Session-event processor — handles `hook_progress`, `hook_response`, `hook_started`, `SessionStart`, `result` |
| `ph` | Task-state poller |
| `QhL` | `task_started` event handler |
| `FhL` | `task_updated` event handler |
| `xQ_` | Poll-state transition helper |
| `dhL` | Local-workflow poller |
| `chL` | Object-keys-based status checker |
| `KAH` | User-typed input router (`user_typed`, `active`, `aborted`) |
| `LK5` | Polling-loop implementation (`pollSessionLoop`) |
| `mB1` | Single-poll fetch with retry logic |
| `e15` | Poll-error classifier |
| `$K5` | Poll-result extractor |
| `MZ6` | Cleanup on poll exit (`_7.unlink`) |
| `K` | Table/column pad formatter |
| `lu` | Plan-submission POST helper (retry with 409 conflict handling) |
| `_9` | Hook-registration wrapper (`f$A.register`) |
| `fK5` | Fallback or finalization handler |
| `b6` | Config-file watcher and loader (`bzH`, `Y17`) |
| `B6` | Config-file path resolver |
| `vz_` | Config-validation helper |
| `bzH` | Config-file reader (readFileSync, readdirStringSync, mkdirSync, copyFileSync) |
| `m6` | JSON.parse wrapper |
| `kb` | String-prefix stripper (`startsWith` / `slice`) |
| `J8` | JSON-write helper |
| `UBq` | Backup-directory scanner |
| `Sz_` | Backup path joiner |
| `$` | Misc array / collection helper (`bo1`) |
| `w` | Background-process manager (spawn, kill, SIGKILL, free-mem checks) |
| `R` | Supervisor write-channel |
| `uH` | Feature-check "bad" reporter |
| `yH` | Feature-check "ok" reporter |
| `eI8` | macOS memory probe |
| `FD6` | Conversation-file reader and filter |
| `B` | MCP tool-use filter |
| `W5A` | Background-session claim & connect |
| `N5A` | Background-task lifecycle manager (add/delete/kill/unlink) |
| `D` | Background-session disposer |
| `S` | Session-socket handle |
| `Y17` | Config-file watcher (`B88.watchFile` / `unwatchFile`) |
| `Mr` | Watch-event debouncer |
| `u86` | Session-URL builder (resolves environment base URL, runs auth / flag pre-checks) |