---
type: feature-spec
feature: "ultraplan"
cc_version: "2.1.185"
updated: "2026-06-21"
tags: ["ultraplan", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.185 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultraplan`

> Analysis basis: CC v2.1.185 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.185

---

## Overview

`/ultraplan` drafts an editable, cloud-backed task plan by launching a remote (teleport) session on Claude.ai. The command validates local prerequisites (login, git state, organization policy, GitHub App installation), uploads a git bundle to seed the remote sandbox, posts a session-creation request, and then polls the cloud session until a plan is ready or a terminal state is reached. The resulting plan is surfaced locally for the user to review, edit, and approve before the cloud agent proceeds.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultraplan` |
| description | `Draft an editable plan in Claude Code on the web ( … ) · See  …` |
| argumentHint | `<prompt>` |
| load_inline | `true` |
| load_ident | `zrf` |
| loc_byte | `12494016` |
| loc_byte_end | `12494248` |
| loc_line | `8086` |
| arbor_handler.name | `zrf` |
| arbor_handler.fqn | `claude-2.1.185::zrf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `load_ident` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.185 bundle.js:+12494016

The handler was resolved via the inline `Promise.resolve({call: zrf})` pattern (`load_ident`). The registration block spans bytes `(12494016, 12494248)`.

---

## Input Branching

The command passes through more than three distinct decision branches (prompt detection, eligibility checks, git/bundle state, session creation outcome, polling states). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/ultraplan <prompt> invoked"] --> B{Prompt extraction\nextractUltraplanPrompt}
    B -->|prompt absent / "ultraplan" keyword\nnot detected| C[Show usage hint\n& abort]
    B -->|prompt present| D{Remote session eligibility\ncheckRemoteEligibility}

    D -->|not logged in| E[Error: run /login\nnot_logged_in]
    D -->|not first-party provider| F[Error: first-party only\nnot_first_party]
    D -->|policy blocked| G[Error: org policy\npolicy_blocked]
    D -->|allow_remote_sessions flag off| H[Error: sessions disabled]
    D -->|eligible| I{already_launching /\nalready_polling guard}

    I -->|duplicate launch| J["Error: ultraplan: already launching.\nPlease wait for the session to start."]
    I -->|clear| K{Git repository\nstate check}

    K -->|no git at all| L[Session created with\nempty sandbox\nbyoc_no_git_source]
    K -->|not in git repo| M[Error: not_in_git_repo]
    K -->|no GitHub remote| N[Error: no_git_remote\nCloud agents require a GitHub remote]
    K -->|GitHub App not installed| O[Error: github_app_not_installed]
    K -->|git repo OK| P{Bundle upload\nteleportGitBundleUpload}

    P -->|empty repo / no commits| Q[Error: commit at least once]
    P -->|upload failed| R[Error: upload_failed]
    P -->|success| S[POST session creation request\nmo.post]

    S -->|HTTP 401/403/429| T[Auth / rate-limit error]
    S -->|HTTP 409| U[Conflict — retry or surface error]
    S -->|malformed response / no session id| V[Error: malformed_response]
    S -->|201 Created| W[Poll cloud session\npollUltraplanSession]

    W -->|timeout_pending| X[Timeout waiting for plan]
    W -->|timeout_no_plan| Y[Timeout — no plan produced]
    W -->|needs_input| Z[Emit awaiting-input state\ntengu_ultraplan_awaiting_input]
    W -->|plan_ready| AA[Present draft plan locally\ntengu_ultraplan_plan_ready]
    W -->|approved| AB[Inform agent: results will\narrive as pull request\ntengu_ultraplan_approved]
    W -->|terminated / failed| AC[Error: cloud session failed\ntengu_ultraplan_failed]
    W -->|unexpected_error| AD[Error: unexpected error during launch\ntengu_ultraplan_create_failed]

    AA --> AE{User edits & approves plan}
    AE -->|approved locally| AB
    AE -->|cancelled| AC
```

Analysis basis: CC v2.1.185 bundle.js:+12492151 (handler entry `zrf`), +12489339 (launch orchestrator `ejt`), +12490108 (eligibility `rce`), +12492279 (session flow `ejt`)

---

## Behavioral Spec

### 1. Handler Entry (`zrf`)

```
async function ultraplanHandler(toolContext):
    appState = toolContext.getAppState()
    
    # Check allow_remote_sessions flag before anything else
    if not appState.allow_remote_sessions:
        return earlyExit("system", "allow_remote_sessions flag not set")
    
    promptText = extractUltraplanPrompt(appState.inputBuffer, appState.messages)
    # see §2 for extraction logic
    
    eligibility = checkRemoteEligibility(appState)
    # see §3 for eligibility checks
    if eligibility.error:
        return renderError(eligibility)
    
    launchResult = await launchUltraplanSession(promptText, appState)
    # see §4 for launch logic
    
    toolContext.setAppState(updatedState)
```

Analysis basis: CC v2.1.185 bundle.js:+12492151 (`zrf` → `tGn`), +12492169 (`zrf` → `di`), +12492486 (`zrf` → `t.getAppState`), +12492708 (`zrf` → `t.setAppState`)

---

### 2. Prompt Extraction (`tGn` / `eGn` / `Hgo`)

```
function extractUltraplanPrompt(rawInput, messageHistory):
    # Step 1: scan message history for "ultraplan" keyword (case-insensitive, global match)
    # Regex flags: "gi"  (bundle.js:+10949838)
    matches = rawInput.matchAll(/ultraplan/gi)
    
    if rawInput.startsWith("ultraplan"):          # bundle.js:+10949440
        # Trim the leading "ultraplan" command token
        candidate = rawInput.slice(commandTokenLength)
        # Normalise whitespace: replace capture groups → "$1$2"  (bundle.js:+10950515)
        candidate = candidate.replace(normalisationRegex, "$1$2")
        # Trim to max 5 words for identifier  (bundle.js:+10950538)
        return candidate
    
    # Also scan history for implicit "ultraplan" mentions
    # index offset 0 used as sentinel  (bundle.js:+10949485)
    if any message contains "ultraplan" keyword:
        return derivedPromptFromHistory
    
    # No prompt found
    return usageError(
        'Usage: /ultraplan <prompt>, or include "ultraplan" anywhere in your prompt'
        # bundle.js:+12489663
    )
```

Analysis basis: CC v2.1.185 bundle.js:+10950390 (`tGn` → `eGn`), +10950184 (`eGn` → `Hgo`), +10949440 (`Hgo` → `e.startsWith`), +10949846 (`Hgo` → `e.matchAll`), +10950489 (`tGn` → `n.replace`)

String `"ultraplan"` appears as a literal at bundle.js:+10950190.
Pattern literal `"gi"` at bundle.js:+10949838.
Replacement literal `"$1$2"` at bundle.js:+10950515.
Word-count limit `5` at bundle.js:+10950538.

---

### 3. Remote Eligibility Check (`di` / `rce` / `oca`)

```
function checkRemoteEligibility(appState):
    provider = getProviderInfo(appState)   # pB / Cz / Oxt / Mme
    
    # Must be first-party Anthropic API  (bundle.js:+8568960)
    if not provider.isFirstParty:
        return error("not_first_party",
            "Cloud sessions are only available on the first-party Anthropic API provider.")
    
    # Organisation policy check  (bundle.js:+8568844 / +8583853)
    if provider.policyDenied:
        return error("policy_denied",
            "Cloud sessions are disabled by your organization's policy.")
    
    # Authentication: must have Claude.ai login  (bundle.js:+8569103)
    if not hasClaudeAiLogin(appState):
        return error("no_access_token",
            "Cloud sessions require a claude.ai login. Run /login to authenticate.")
    
    # Org UUID required  (bundle.js:+8569451)
    orgUuid = getOrgUuid(appState)
    if not orgUuid:
        return error("no_org_uuid",
            "Unable to get organization UUID for cloud session creation")
    
    # Background eligibility: git repo + GitHub remote + app installed  (bundle.js:+7180615)
    repoCheck = checkBgRemoteEligibility(appState)  # oca
    if repoCheck.error == "not_in_git_repo":
        return error("not_in_git_repo")
    if repoCheck.error == "no_git_remote":
        return error("no_git_remote",
            "Cloud agents require a GitHub remote. Add one with `git remote add origin REPO_URL`.")
        # bundle.js:+8583585
    if repoCheck.error == "github_app_not_installed":
        return error("github_app_not_installed")
    
    # BYOC environments: check seed-bundle flag  (bundle.js:+7181088)
    if repoCheck.byocSeedBundleEnabled:
        emitTelemetry("tengu_ccr_bundle_seed_enabled")
    
    return eligible()
```

Analysis basis: CC v2.1.185 bundle.js:+3344001 (`di` → `oAi`), +7180615 (`oca` → `di`), +8568960, +8569103, +8569451, +8583585

Telemetry: `tengu_ccr_bundle_seed_enabled` at bundle.js:+7181088.

---

### 4. Launch Orchestrator (`ejt`)

```
async function launchUltraplan(promptText, appState):
    # Guard: reject if already launching or polling
    if sessionState == "already_launching":   # bundle.js:+12489616
        return userMessage(
            "ultraplan: already launching. Please wait for the session to start.")
            # bundle.js:+12488151
    if sessionState == "already_polling":     # bundle.js:+12489598
        return userMessage(...)
    
    # Precondition check step (label "precondition")  (bundle.js:+12490191)
    precheck = await runPreconditions(appState)   # Qe / ogt, Fqn / ct path
    if precheck.failed:
        emitTelemetry("tengu_ultraplan_create_failed")  # bundle.js:+12489376
        return renderError(precheck)
    
    # Attach task-notification hook  (bundle.js:+12490367)
    registerTaskNotificationHook()    # KEl
    
    # Generate draft plan locally (local branch "plan")  (bundle.js:+12490558)
    planContext = await buildPlanContext(promptText)   # $qn / Fqn / Grf
    # Grf prepends "Here is a draft plan to refine:"  (bundle.js:+12485212)
    
    # Prompt identifier telemetry  (bundle.js:+12485038)
    emitTelemetry("tengu_ultraplan_prompt_identifier", { identifier: planContext.id })
    
    # Eligibility for remote (Krf sub-flow)
    eligibilityResult = await checkTeleportEligibility(appState)  # Krf → rce
    
    # Bundle upload phase  (bundle.js:+8574911)
    bundleResult = await uploadGitBundle(appState)    # y6 → Goo
    emitTelemetry("tengu_ccr_bundle_upload")          # bundle.js:+8553525
    
    # POST session creation  (bundle.js:+8571093 mo.post)
    sessionResponse = await createCloudSession(planContext, eligibilityResult)
    # E6 sub-handler; 10-second timeout  (bundle.js:+10000 at +8579302)
    
    if sessionResponse.status == 201:                # bundle.js:+8571185
        emitTelemetry("tengu_ultraplan_launched")    # bundle.js:+12491083
        sessionId = sessionResponse.data.id
    elif sessionResponse.status in [401, 403, 429]:  # bundle.js:+8571254/8/62
        return error("create_request_failed")
    elif no sessionId:
        return error("malformed_response",
            "Server returned a malformed session response (no session id)")
            # bundle.js:+8571759
    
    # Poll loop  (bundle.js:+12491354 jrf)
    pollResult = await pollUltraplanSession(sessionId, appState)
    
    return handlePollResult(pollResult)
```

Analysis basis: CC v2.1.185 bundle.js:+12489339 (`ejt`), +12489598, +12489616, +12490191, +12490367, +12490558, +12491073 (`qrf`), +12491083, +12491354 (`jrf`)

---

### 5. Git Bundle Upload (`y6` / `Goo`)

```
async function uploadGitBundle(appState):
    # Phase log: "[teleport] phase: bundle-upload"  (bundle.js:+8574911)
    
    # Determine bundle mode  (bundle.js:+8570220)
    emitTelemetry("tengu_teleport_bundle_mode", { mode: bundleMode })
    
    bundleMode =
        if env var explicit bundle path set → "explicit_env_bundle"   # bundle.js:+8570327
        elif in git repo with commits      → "git_repository"          # bundle.js:+8570380
        elif no git at all                 → "no_git_at_all"           # bundle.js:+8574070
    
    if bundleMode == "git_repository":
        # Detect branch  (bundle.js:+8573775 "[teleport] phase: branch-detect")
        branch = detectCurrentBranch()    # CR → symbolic-ref --short refs/remotes/origin/HEAD
        # Fallback candidates: "main", "master"  (bundle.js:+1162420/27)
        
        # Check GitHub preflight  (bundle.js:+8574391/413)
        preflightOk = await checkGithubPreflight()   # T3e
        if not preflightOk:
            emitTelemetry("tengu_teleport_source_decision", { result: "github_preflight_failed" })
        else:
            emitTelemetry("tengu_teleport_source_decision", { result: "github_preflight_ok" })
        
        # Git stash → bundle creation
        # Seed refs: "refs/seed/stash", "refs/seed/root"  (bundle.js:+8553333/51)
        # Bundle filename pattern: "ccr-seed" + ".bundle"  (bundle.js:+8554528/39)
        bundleData = await teleportGitBundleUpload(branch)   # Goo
        emitTelemetry("tengu_ccr_bundle_upload", { status: bundleData.status })
        # Status values: "success", "failed", "upload_failed", "stash_failed",
        #                "head", "fallback_head", "squashed", "fallback_squashed"
        #                (bundle.js:+8555136, +8554940, +8554984, +8554170, etc.)
    
    elif bundleMode == "no_git_at_all":
        # Session created with empty sandbox  (bundle.js:+8576223)
        log("[teleportToRemote] No repository detected — session will have an empty sandbox")
        emitTelemetry("tengu_teleport_source_decision", { result: "byoc_no_git_source" })
    
    return bundleResult
```

Analysis basis: CC v2.1.185 bundle.js:+8553203 (`Goo`), +8553232 (`teleport_git_bundle_upload`), +8570220, +8574911, +8573775, +1162282, +8554528

---

### 6. Poll Loop (`jrf` / `FEl`)

```
async function pollUltraplanSession(sessionId, appState):
    # Max poll duration: 5400 seconds  (bundle.js:+12484905)
    maxSeconds = 5400
    emitTelemetry("tengu_ultraplan_timeout_seconds", { seconds: maxSeconds })
    
    startTime = Date.now()
    
    loop:
        response = await fetchSessionStatus(sessionId)   # Nrf → ct
        status = response.status
        
        if status == "needs_input":
            emitTelemetry("tengu_ultraplan_awaiting_input")   # bundle.js:+12485515
            # Present plan-refinement UI (prefix "Here is a draft plan to refine:")
            # bundle.js:+12485212
        
        elif status == "plan_ready":
            emitTelemetry("tengu_ultraplan_plan_ready")       # bundle.js:+12485583
            return { outcome: "plan_ready", plan: response.plan }
        
        elif status == "approved":
            emitTelemetry("tengu_ultraplan_approved")         # bundle.js:+12486003
            return { outcome: "approved",
                     message: "Results will land as a pull request when the cloud session finishes."
                     # bundle.js:+12486493
                   }
        
        elif status in ["terminated", "failed", "archived"]:
            emitTelemetry("tengu_ultraplan_failed")           # bundle.js:+12486892
            return { outcome: "failed",
                     message: "Cloud ultraplan session failed. Wait for the user's next instructions."
                     # bundle.js:+12487316
                   }
        
        elif status == "requires_action":
            # hook_progress / hook_response events  (bundle.js:+8591167/96)
            handleRemoteHook(response)
        
        elif elapsedSeconds > maxSeconds:
            if no plan yet:
                return error("timeout_no_plan")    # bundle.js:+12477292
            else:
                return error("timeout_pending")    # bundle.js:+12477274
        
        # Poll interval: 1000 ms base; timeout window: 1 800 000 ms  (bundle.js:+8589970/77)
        await sleep(1000)
    
    # Network-error handling (FEl)
    on repeated network failures:
        return error("network_or_unknown",
            "Lost connection to the cloud session after repeated retries — "
            "the session may still be running")
            # bundle.js:+12476231
```

Analysis basis: CC v2.1.185 bundle.js:+12485339 (`jrf` → `PM`), +12485435 (`jrf` → `FEl`), +12484905 (5400), +12484871 (`tengu_ultraplan_timeout_seconds`), +12476231, +8589970

Poll cycle constants:
- Base sleep interval: `1000` ms (bundle.js:+8589970)
- Outer timeout window: `1 800 000` ms / 30 minutes (bundle.js:+8589977)
- Max poll seconds: `5400` (bundle.js:+12484905)

---

### 7. Session Creation POST (`E6` / `mst` / `qee`)

```
async function createCloudSession(planContext, eligibility):
    # Build request headers
    headers = {
        "Content-Type": "application/json",              # bundle.js:+3287344/59
        "anthropic-version": "2023-06-01",               # bundle.js:+3287378/98
        "anthropic-beta": "ccr-byoc-2025-07-29",         # bundle.js:+8569853/70
        "x-organization-uuid": orgUuid,                  # bundle.js:+8569892
    }
    
    # POST with 10-second timeout  (bundle.js:+8579302 value 10000)
    response = await mo.post(sessionEndpoint, payload, { timeout: 10000 })
    
    if response.status == 201:          # bundle.js:+8571185
        return response
    if response.status == 409:          # bundle.js:+8579591
        # Conflict — retry after 1500 ms  (bundle.js:+12491432)
        await sleep(1500)
        return retryCreate()
    if response.status in [401, 403, 429]:
        emitTelemetry("tengu_ultraplan_create_failed")
        return error("create_request_failed")  # bundle.js:+8571608
    return error("unexpected_error")
```

Analysis basis: CC v2.1.185 bundle.js:+8579311 (`E6` → `Ac`), +8579495 (`E6` → `mo.post`), +3287344, +8569853, +8571185, +8579591, +12491432

---

### 8. Environment Selection (`qee` / `mst`)

```
async function selectOrCreateCloudEnvironment(orgUuid, accessToken):
    # Phase log: "[teleport] phase: env-select"  (bundle.js:+8571970)
    
    # List available environments  (bundle.js:+7176221 teleport_environments_list)
    environments = await fetchEnvironments(orgUuid, accessToken)
    
    if environments is empty:
        # Auto-create a default environment  (bundle.js:+8572078)
        log("[teleportToRemote] Auto-created default cloud env")
        defaultEnv = await createDefaultEnvironment()  # mst
        # Default env: name "Default", type "anthropic_cloud"  (bundle.js:+7177586/46)
        # Runtime: python 3.11, node 20  (bundle.js:+7177724/41/55/70)
        # Home dir: "/home/user"  (bundle.js:+7177662)
        emitTelemetry("env_create")   # bundle.js:+8572340
        
        if createFailed:
            log("warn", "Could not create a cloud environment. Set one up at " +
                "https://claude.ai/code/onboarding?magic=env-setup")
                # bundle.js:+8572236
            return error("no_default_env")   # bundle.js:+8573150
    
    # No environments after all attempts
    if still empty:
        return error("no_environments",
            "No environments available for session creation")  # bundle.js:+8573258
    
    return selectedEnvironment
```

Analysis basis: CC v2.1.185 bundle.js:+8571970, +7176221, +8572078, +7177586, +7177662, +8572236, +8573150, +8573258

---

### 9. Orphaned Session Cleanup

```
async function archiveOrphanedSession(sessionId):
    try:
        await archiveSession(sessionId)   # j$t → Rl.unlink, JLo, ds
    except:
        log("ultraplan: failed to archive orphaned session")  # bundle.js:+12491836
```

Analysis basis: CC v2.1.185 bundle.js:+12491836, +12491354 (`jrf`), +13451207 (`j$t` → `JLo`)

---

### 10. App-State Updates

```
function applyStateTransition(appState, phase, result):
    # State keys used (derived from literals and Hkn → zhe.setState):
    # "Ultraplan"  (bundle.js:+12491247) — task label written to state
    # "task_started"  (bundle.js:+10365488) — T1p / S1p path via PM
    # "task_updated"  (bundle.js:+10364543)
    # "user_typed"  (bundle.js:+10361360) — Wce path
    # Status values: "active" (bundle.js:+10361408), "aborted" (bundle.js:+10361581)
    # workflowName: "local_workflow"  (bundle.js:+10366007)
    # agentType stored in task state  (bundle.js:+10365580)
    
    zhe.setState({ ...appState, ultraplanPhase: phase, ultraplanResult: result })
    
    # Feature-flag telemetry via ke / Re (bundle.js:+1021887/954)
    emitTelemetry("tengu_feature_ok")   # or "tengu_feature_bad"
```

Analysis basis: CC v2.1.185 bundle.js:+7041088 (`Hkn` → `zhe.setState`), +10365488, +10364543, +10361360, +12491247

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_ultraplan_create_failed` | Fired when session creation fails (precondition or HTTP error) · bundle.js:+12489376 |
| Telemetry: `tengu_ultraplan_prompt_identifier` | Fires with a derived identifier for the prompt · bundle.js:+12485038 |
| Telemetry: `tengu_ultraplan_launched` | Fires after successful 201 session creation · bundle.js:+12491083 |
| Telemetry: `tengu_ultraplan_timeout_seconds` | Records configured poll timeout (5400 s) · bundle.js:+12484871 |
| Telemetry: `tengu_ultraplan_awaiting_input` | Poll loop detected `needs_input` state · bundle.js:+12485515 |
| Telemetry: `tengu_ultraplan_plan_ready` | Cloud session emitted a draft plan · bundle.js:+12485583 |
| Telemetry: `tengu_ultraplan_approved` | User approved the plan · bundle.js:+12486003 |
| Telemetry: `tengu_ultraplan_failed` | Cloud session terminated/failed · bundle.js:+12486892 |
| Telemetry: `tengu_ccr_bundle_seed_enabled` | BYOC seed-bundle feature active · bundle.js:+7181088 |
| Telemetry: `tengu_ccr_bundle_upload` | Git bundle upload attempted · bundle.js:+8553525 |
| Telemetry: `tengu_teleport_bundle_mode` | Records which bundle strategy was chosen · bundle.js:+8570220 |
| Telemetry: `tengu_ccr_session_link` | Session URL link recorded · bundle.js:+8563534 |
| Telemetry: `tengu_teleport_source_decision` | Records git/bundle source path chosen · bundle.js:+8575821 |
| Telemetry: `tengu_config_parse_error` | Config file parse failure during git-state check · bundle.js:+13969321 |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` | Feature-flag gate result · bundle.js:+1021887 / +1021954 |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Daemon escalated SIGKILL · bundle.js:+17275024 |
| Telemetry: `tengu_bg_low_mem_mb` / `tengu_bg_dispatch_low_mem` | Low memory warnings in daemon · bundle.js:+13292201 / +17275625 |
| Telemetry: `tengu_bg_spare_enable` / `tengu_bg_spare_claim` / `tengu_bg_spare_claim_fail` | Spare-slot management · bundle.js:+17276322 / +17276450 / +17276716 |
| Telemetry: `tengu_bg_sendclaim_failed` | Daemon claim send failure · bundle.js:+17251556 |
| Telemetry: `tengu_scheduled_task_missed` | Scheduled task missed · bundle.js:+16742322 |
| Hook registration | Task-notification hook registered at launch via `KEl` · bundle.js:+12492607 |
| appState changes | `t.setAppState` called on entry and after each phase transition · bundle.js:+12492708 |
| appState changes | `zhe.setState` called by `Hkn` with task-started / task-updated payloads · bundle.js:+7041088 |
| File I/O | Git bundle written to temp path (`ccr-seed*.bundle`), cleaned up via `Rl.unlink` / `j$t` · bundle.js:+13451224 |
| File I/O | `B7n.watchFile` / `B7n.unwatchFile` for config-change detection (`Ebf`) · bundle.js:+13964841 |
| File I/O | `readFileSync`, `copyFileSync`, `mkdirSync` during config access (`q_e`) · bundle.js:+13968746 |
| Network | `mo.post` to session-creation endpoint with `anthropic-beta: ccr-byoc-2025-07-29` header · bundle.js:+8571093 |
| Network | `mo.get` during poll loop · bundle.js:+7176776 |
| Background daemon | Spawns / claims background session via `zq.spawn` / `zq.claim` · bundle.js:+17276779 / +17251355 |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.185 | Initial analysis |

---

## Common Mistakes

1. **Running `/ultraplan` without a Claude.ai login** — The command requires `claude.ai` OAuth authentication, not just an API key. API key authentication alone triggers the `no_access_token` error. Run `/login` first.
2. **Using `/ultraplan` outside a git repository with a GitHub remote** — The cloud agent needs a GitHub remote (`remote.origin.url`) to deliver results as a pull request. Repositories without `git remote add origin …` will fail with `no_git_remote`.
3. **Running `/ultraplan` without the GitHub App installed** — Even with a valid remote, the GitHub App must be installed on the target organisation. The error code is `github_app_not_installed`.
4. **Triggering a second `/ultraplan` while one is already launching** — The command rejects concurrent launches with the `already_launching` guard and the message "ultraplan: already launching. Please wait for the session to start."
5. **Expecting instant results** — The command polls a remote cloud session for up to 5 400 seconds (90 minutes). The plan appears only when the cloud session reaches `plan_ready` or `needs_input` state. There is nothing to do locally while the session runs; results arrive as a pull request.
6. **Using `/ultraplan` on a non-first-party provider** — The command is restricted to the Anthropic first-party API endpoint. Third-party or custom API providers are rejected with `not_first_party`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `zrf` | Main handler for `/ultraplan` (AsyncFunction, entry point via `load_ident`) |
| `tGn` | Prompt extraction orchestrator |
| `eGn` | Inner prompt tokeniser |
| `Hgo` | Keyword-scan and slice logic (checks `startsWith`, `matchAll`) |
| `di` | Remote-eligibility dispatcher |
| `oAi` | Provider-info resolver |
| `Cz` | Provider-config aggregator |
| `pB` | Provider-flag reader (firstParty, enterprise, team) |
| `Oxt` | Config-file reader (`readFileSync`, utf-8) |
| `Mme` | Policy/telemetry-consent checker |
| `ra` | Traffic-category resolver (`essential-traffic`, `no-telemetry`) |
| `eJo` | String conversion helper |
| `st` | String coercion utility |
| `Eme` | Supplemental string helper |
| `hte` | App-state accessor helper |
| `ejt` | Launch orchestrator (guards, plan build, session POST) |
| `Qe` | Precondition runner |
| `ogt` | Precondition predicate |
| `KEl` | Task-notification hook registrar |
| `$qn` | Plan-context builder wrapper |
| `Fqn` | Plan-context builder (prepends draft-plan prefix) |
| `ct` | Session-state reader / caching layer |
| `Frf` | Plan-prompt formatter |
| `Krf` | Teleport eligibility + session-creation main flow |
| `rce` | Background remote-eligibility check dispatcher |
| `oca` | Git/GitHub eligibility checker (`bg_remote_eligibility_check`) |
| `ks` | Utility: `gx` + `wf` helpers |
| `gx` | General-purpose utility (used by `ks`, `Lt`) |
| `wf` | General-purpose utility (used by `ks`) |
| `Grf` | Draft-plan assembler (joins sections with `r.join`) |
| `Brf` | Plan section formatter |
| `y6` | Teleport-to-remote main function (bundle upload → POST → poll) |
| `Mt` | Message formatter |
| `Ac` | HTTP auth header builder |
| `Lh` | Token-refresh helper (`refreshed` state) |
| `lFn` | Auth-header assembler |
| `De` | Error display / log-error handler |
| `X2` | Session context builder |
| `Ps` | Endpoint URL resolver (local / staging / prod) |
| `YE` | HTTP response header builder (`Content-Type`, `anthropic-version`) |
| `Goo` | Git bundle upload orchestrator (`teleport_git_bundle_upload`) |
| `Lt` | Logger / output helper |
| `T` | Message-type classifier |
| `Ue` | JSX render helper |
| `XO` | Git remote URL resolver (`git config --get remote.origin.url`) |
| `fDa` | Session payload builder (`plt.randomUUID`) |
| `oNt` | Object-key iteration helper |
| `Pe` | JSON serialiser |
| `ne` | Stream multiplexer (`ee`, `te`, `E`, `v`) |
| `pDa` | Session-link UI component |
| `zkn` | Environment-list fetcher |
| `qee` | Environment-selection flow (`teleport_environments_list`) |
| `mst` | Default-environment creation (`teleport_default_environment_create`) |
| `Ee` | String coercion for display |
| `Ehp` | Branch/title generator (`teleport_generate_title`, `claude/task` prefix) |
| `oF` | Tool-permission checker |
| `T3e` | GitHub App installation checker |
| `CR` | Current-branch detector (`symbolic-ref --short refs/remotes/origin/HEAD`) |
| `js` | Sub-utility (`jK`, `_s`, `Pg`) |
| `goe` | GitHub remote URL parser / normaliser |
| `K` | Output-stream writer |
| `re` | Input-line trimmer / splitter |
| `Ho` | Error wrapper (Error + String) |
| `hH` | Cancel-check helper |
| `KH` | Kill-signal helper |
| `Sy` | WebSocket / connection factory (`ro`, `CWr`) |
| `ro` | WebSocket constructor |
| `CWr` | Connection wrapper (`oPt`, `QLd`) |
| `qrf` | Sub-state router inside launch orchestrator |
| `Bge` | Background remote-agent session creator (`remote_agent`) |
| `d3` | Random-bytes ID generator (`KOl.randomBytes`, 8 bytes) |
| `mlt` | Session file opener (`Wne.open`) |
| `u0` | Session timestamp recorder |
| `xhp` | Session-string builder |
| `gDa` | Cloud-session event poller (main poll body, `setTimeout` driven) |
| `PM` | Task-state machine (task_started, task_updated, Hkn) |
| `T1p` | Task-started state handler |
| `S1p` | Task-updated state handler |
| `Hkn` | App-state dispatcher (`zhe.setState`) |
| `Jfo` | State-machine transition helper |
| `I1p` | Task-completion handler |
| `C1p` | Task-iteration handler |
| `Wce` | User-typed-input watcher |
| `jrf` | Poll-loop controller (5400 s max, FEl error handler) |
| `FEl` | Network-error / retry handler for poll loop |
| `Nrf` | Session-status fetcher |
| `Vrf` | Poll-response validator |
| `j$t` | Orphaned-session archiver (`Rl.unlink`, `JLo`) |
| `E6` | Session-creation POST handler (10 s timeout, 409 retry) |
| `qi` | Hook registrar (`B2o.register`) |
| `Wrf` | Cleanup / teardown handler |
| `Ct` | Config reader / watcher orchestrator |
| `jt` | File-path resolver |
| `Hko` | Config-key validator |
| `q_e` | Config-file accessor (`readFileSync`, `mkdirSync`, `copyFileSync`) |
| `Gt` | JSON parser |
| `V9` | Path prefix stripper |
| `dn` | Error code classifier |
| `RFl` | Backup-directory scanner |
| `Sko` | Path join helper |
| `l` | Path-starts-with checker |
| `f` | Background-session spawn / lifecycle manager |
| `M` | Scheduled-task runner |
| `Bn` | Timeout / clearTimeout wrapper |
| `Re` | Feature-OK telemetry emitter |
| `ke` | Feature-bad telemetry emitter |
| `YKn` | Low-memory checker (macOS `freemem`) |
| `B$e` | Temp-file cleaner (`fT.lstat`, `fT.rm`, `fT.readFile`) |
| `$` | Permission-classifier (`zlt`, `R6`) |
| `NNo` | Unix-socket connection manager (`xZn.connect`) |
| `jNo` | Daemon session lifecycle (spawn, roster, cleanup) |
| `p` | Forced-shutdown handler (`process.exit`, `u.abort`) |
| `R` | Resource disposer |
| `Ebf` | Config-file watcher (`B7n.watchFile` / `B7n.unwatchFile`) |
| `Kq` | Config-key enumerator |
| `Zft` | Pre-flight aggregator (`Promise.all` over `XO`, `oF`, `Du`, `Mt`, `T3e`) |