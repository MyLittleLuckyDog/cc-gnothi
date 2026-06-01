---
type: feature-spec
feature: "ultraplan"
cc_version: "2.1.141"
updated: "2026-05-31"
tags: ["ultraplan", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.141 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultraplan`

> Analysis basis: CC v2.1.141 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.141

---

## Overview

`/ultraplan` launches a remote Claude Code web session that drafts a structured plan for the user's prompt, then streams the plan back to the local CLI for inline editing and approval before execution. The command orchestrates eligibility checks, git-bundle seeding, remote session creation, polling for plan readiness, and finally local agent hand-off once the plan is approved. It is the primary entry point for the "background remote planning" workflow introduced in the teleport/CCR subsystem.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultraplan` |
| description | `… Claude Code on the web drafts a plan you can edit and approve. See …` |
| argumentHint | `<prompt>` |
| load\_inline | `true` |
| load\_ident | `dT7` |
| loc\_byte | `11128295` |
| loc\_byte\_end | `11128539` |
| loc\_line | `6725` |
| arbor\_handler.name | `dT7` |
| arbor\_handler.kind | `AsyncFunction` |
| arbor\_handler.fqn | `claude-2.1.141::dT7` |
| arbor\_handler.resolution\_path | `load_ident` |
| arbor\_handler.n\_hits | `1` |
| `loc_byte_end` | `11128539` |
| `arbor_handler.name` | `dT7` |
| `arbor_handler.kind` | `AsyncFunction` |
| `arbor_handler.resolution_path` | `load_ident` |
| `arbor_handler.fqn` | `claude-2.1.141::dT7` |
| `arbor_handler.n_hits` | `1` |

The handler was resolved via the inline `Promise.resolve({call: dT7})` shape (resolution path: `load_ident`). Arbor confirms a single unambiguous hit.

Analysis basis: CC v2.1.141 bundle.js:+11128295

---

## Input Branching

The command has 6+ distinct decision branches (eligibility gates, launch-state guards, plan-poll transitions, approval, failure, and timeout paths), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/ultraplan <prompt>"]) --> B{allow_remote_sessions\nconfigured?}
    B -- "no / blocked by policy" --> ERR_POLICY["Exit: policy_blocked\n(org policy message)"]
    B -- yes --> C{User logged in\nwith Claude.ai account?}
    C -- no --> ERR_LOGIN["Exit: not_logged_in\n(run /login message)"]
    C -- yes --> D{Inside a\ngit repo?}
    D -- no --> ERR_GIT["Exit: not_in_git_repo"]
    D -- yes --> E{GitHub remote\npresent?}
    E -- no --> ERR_REMOTE["Exit: no_git_remote\n(add origin message)"]
    E -- yes --> F{GitHub App\ninstalled?}
    F -- no --> ERR_APP["Exit: github_app_not_installed"]
    F -- yes --> G{Launch state:\nalready_polling or\nalready_launching?}
    G -- already_launching --> WARN_LAUNCH["Warn: already launching,\nplease wait"]
    G -- already_polling --> SKIP["skip — return immediately"]
    G -- idle --> H[Extract / normalize\nprompt text]
    H --> I{Prompt contains\n'ultraplan' keyword\nor is empty?}
    I -- "missing / wrong form" --> ERR_USAGE["Exit: usage hint\n(Usage: /ultraplan <prompt>…)"]
    I -- valid --> J[Seed git bundle\n& upload to CCR]
    J --> K[Create remote\nteleport session via API]
    K -- "API error / null session" --> ERR_CREATE["tengu_ultraplan_create_failed\nExit: create_api_fail or teleport_null"]
    K -- success --> L[Poll for plan readiness\n(max 5400 s timeout)"]
    L -- "timeout_pending\nor timeout_no_plan" --> ERR_TIMEOUT["Emit timeout error\nto local agent"]
    L -- "plan_ready /\nneeds_input" --> M["Display draft plan\n'Here is a draft plan to refine:'"]
    M --> N{User approves\nor edits plan?}
    N -- approved --> O["tengu_ultraplan_approved\nHand off to local agent:\nresults land as PR"]
    N -- "remote session\nfailed" --> ERR_REMOTE_FAIL["tengu_ultraplan_failed\nEmit failure message to agent"]
    L -- "terminated /\nrequires_action" --> ERR_REMOTE_FAIL
    O --> P([Done])
    ERR_REMOTE_FAIL --> P
```

Analysis basis: CC v2.1.141 bundle.js:+11126449 (handler entry), +11123711 (launch guard), +11124027 (usage check), +11125419 (launched telemetry), +11119351 (timeout), +11120063 (plan_ready)

---

## Behavioral Spec

### 1. Handler Entry — `handlerMain` (`dT7`)

```
async function handlerMain(commandInput, context):
    # Check remote-sessions policy flag
    if not appState.allow_remote_sessions:
        return policyBlockedError()

    # Normalize raw prompt text
    rawPrompt = extractPromptText(commandInput)          # → normalizePrompt (nJ8)
    trimmedPrompt = stripUltraplanKeyword(rawPrompt)     # → promptStripper (nJ8 → lJ8/Dwq)

    # Read current app state
    state = _.getAppState()

    # Guard: deduplicate concurrent launches
    if state == "already_polling":
        return skip                                      # literal "skip" @+11127109
    if state == "already_launching":
        warn("ultraplan: already launching. Please wait…") # @+11122575
        return

    # Set launching state
    _.setAppState("already_launching")                   # @+11126991

    try:
        result = await launchOrchestrator(trimmedPrompt, context)  # → launchFlow (f06)
    finally:
        if orphaned:
            log.warn("ultraplan: failed to archive orphaned session") # @+11126134

    return result
```

Analysis basis: CC v2.1.141 bundle.js:+11126449, +11126502, +11126773, +11126890, +11126991

---

### 2. Prompt Normalization — `normalizePrompt` (`nJ8` → `lJ8` / `Dwq`)

```
function normalizePrompt(rawInput):
    # lJ8: tokenize raw input with global regex (flag "gi") @+11112059
    tokens = rawInput.matchAll(globalRegex)

    # Dwq: scan token list; if any token starts with the known prefix:
    for token in tokens:
        if token.startsWith(knownPrefix):               # @+11111661
            pushToQueue(token)                          # @+11111878 (q.push)

    # nJ8: slice and reassemble, replace pattern "$1$2" @+11112655
    sliced  = rawInput.slice(...)                       # @+11112558
    cleaned = sliced.replace("$1$2", ...)               # @+11112629

    # Limit: replacement group count ≤ 5  @+11112678
    return cleaned
```

The string literal `"ultraplan"` appears at +11112411 and is used as the identity marker during token scanning — confirming that the keyword `ultraplan` embedded anywhere in the prompt is recognized as a valid invocation trigger.

Analysis basis: CC v2.1.141 bundle.js:+11112530, +11112558, +11112655

---

### 3. Eligibility Check — `checkRemoteEligibility` (`pq` → `kAq` / `ZR_` / `bp`)

```
async function checkRemoteEligibility(context):
    # bp: determine account tier
    tier = getAccountTier()   # values: "firstParty" @+9899838, "enterprise" @+9900124, "team" @+9900159

    # ZR_: read config file (utf-8) @+9902014 via vAq (readFileSync)
    config = readConfigFile()

    # pq: verify product-feedback consent flag
    if not config.allow_product_feedback:               # @+9903400
        return ineligible("no_consent")

    # pq: check tf7 membership set for deduplication    @+9903369
    if tf7.has(sessionId):
        return ineligible("duplicate")

    # Vq → cMA → RH: resolve session routing            @+9903388
    routingInfo = resolveRouting()

    # J0H: format eligibility response string           @+9903426
    return buildEligibilityResponse(tier, routingInfo)
```

Telemetry: `tengu_slate_kestrel` fires during tier resolution at +9900038.

Analysis basis: CC v2.1.141 bundle.js:+9903353, +9903382, +9903776

---

### 4. Launch Flow — `launchFlow` (`f06`)

```
async function launchFlow(prompt, context):
    # Re-check eligibility (pq) before proceeding         @+11123711
    eligibility = await checkRemoteEligibility(context)
    if not eligibility.ok:
        emit(tengu_ultraplan_create_failed)               # @+11123748
        return buildFailureResult(eligibility.reason)

    # Compute session key (Q)                             @+11123746
    sessionKey = computeSessionKey(prompt)

    # Set up progress tracking ref (kYH)                  @+11123821
    progressRef = initProgressRef()

    # Register cleanup handler (L)                        @+11123900
    registerCleanup(progressRef)

    # Setup task notification (Twq)                       @+11124003
    registerTaskNotification("task-notification")         # literal @+11124728

    # Launch main session orchestrator (QT7)              @+11124230
    sessionResult = await sessionOrchestrator(prompt, sessionKey, progressRef)

    # On hard failure, register background task (BT7)     @+11124337
    if sessionResult.failed:
        await registerBackgroundTask(sessionResult)

    return sessionResult
```

Analysis basis: CC v2.1.141 bundle.js:+11123711, +11124003, +11124230, +11124337

---

### 5. Session Orchestrator — `sessionOrchestrator` (`QT7`)

```
async function sessionOrchestrator(prompt, sessionKey, progressRef):
    # UVH → Mz1: run background-eligibility check        @+11124472
    eligibilityCheck = await bgRemoteEligibilityCheck()   # telemetry: tengu_ccr_bundle_seed_enabled @+6538388

    # F5: enqueue precondition                            @+11124659  literals: "precondition" @+11124552, "later" @+4523111, "enqueue" @+4523131
    enqueueResult = await enqueueOperation(eligibilityCheck)

    # rJ8: emit prompt identifier telemetry               @+11124783
    emitPromptIdentifier()                                # telemetry: tengu_ultraplan_prompt_identifier @+11119518

    # pT7: compose plan draft prefix                      @+11124791
    # Prepends literal "Here is a draft plan to refine:" @+11119692
    planHeader = composePlanHeader(prompt)

    # HKH: create the remote teleport session             @+11124816
    session = await createTeleportSession(planHeader)     # see §6

    # iY → qA → gM_: open browser window to session URL  @+11125286
    # Resolves to https://claude.ai (prod) / staging / localhost per env @+4594247
    openBrowserWindow(session.url)

    # L: register session in live-session set             @+11125340
    registerLiveSession(session)

    # FT7: setup fallback handler                         @+11125409
    setupFallback()

    # LnH → Gh1: start long-poll monitor (remote_agent)   @+11125517
    # Uses "remote_agent" literal @+7944181; polling interval base 1000 ms @+7945769
    # Max poll duration: 1 800 000 ms (30 min) @+7945776
    pollHandle = await pollRemoteSession(session)         # telemetry: tengu_ultraplan_launched @+11125419

    # eN, UT7: process poll events                        @+11125656
    # (see §7 — Poll Event Processor)
    outcome = await processPollEvents(pollHandle)

    # b9: update state atom with outcome                  @+11125702
    # Wait 1500 ms before state flush @+11125760
    await delay(1500)
    updateStateAtom(outcome)

    # DQ: dispatch session-close notification             @+11125752
    await dispatchCloseNotification(session)

    # kH: persist session metadata                        @+11125780
    persistSessionMetadata(session)

    if outcome.error:
        emitAgentMessage("Ultraplan hit an unexpected error…") # @+11125986
        emit(tengu_ultraplan_failed)                           # @+11121344
    else:
        return outcome
```

Analysis basis: CC v2.1.141 bundle.js:+11124472, +11124659, +11124816, +11125286, +11125517, +11125656

---

### 6. Remote Session Creation — `createTeleportSession` (`HKH`)

```
async function createTeleportSession(planHeader):
    # Validate policy flag                               @+7930241 → "Remote sessions are disabled…"
    if policyBlocked:
        throw PolicyError("policy_blocked")

    # Validate access token                             @+7930349
    if not hasAccessToken:
        throw AuthError("No access token found for remote session creation")

    # Retrieve org UUID                                 @+7930659
    orgUuid = getOrgUuid()
    if not orgUuid:
        throw OrgError("Unable to get organization UUID for remote session creation")

    # Build request headers:                            @+7930981
    #   anthropic-beta: "ccr-byoc-2025-07-29"  @+7930998
    #   x-organization-uuid: orgUuid            @+7931020
    headers = buildHeaders(orgUuid)

    # IT_: upload git seed bundle                       @+7931147
    # telemetry: tengu_ccr_bundle_upload @+7916172, tengu_teleport_bundle_mode @+7931402
    bundleRef = await uploadGitSeedBundle()
    # Bundle modes observed: "bundle", "explicit_env_bundle", "git_repository",
    #   "too_large", "explicit_source_url", "no_git_at_all"            @+7931330–7934768

    # Generate session UUID (Ph1 → NT_.randomUUID)     @+7931785
    sessionId = crypto.randomUUID()

    # Build session payload (Object.keys)               @+7932106
    payload = buildSessionPayload(planHeader, bundleRef, sessionId)

    # POST to session creation endpoint (x8.post)       @+7932227
    # HTTP 201 = created @+7932319; 401/403/429 = auth/rate errors @+7932379–7932387
    # HTTP 500 gate @+7932281
    response = await http.post(sessionEndpoint, payload, headers)

    if response.status == 201:
        if not response.data.session_id:
            throw Error("Server returned a malformed session response (no session id)") # @+7932704
        return response.data

    if response.status in [401, 403]:
        throw AuthError()
    if response.status == 429:
        throw RateLimitError()

    # Zy: resolve git remote URL                        @+7931624
    # git config --get remote.origin.url @+1038554
    remoteUrl = resolveGitRemoteUrl()

    # Auto-create default cloud environment if none     @+7932879
    # Logs: "[teleportToRemote] Auto-created default cloud env" @+7932898
    # Warning on failure: https://claude.ai/code/onboarding?magic=env-setup @+7933056
    env = await ensureCloudEnvironment()

    # iB4: generate task title (teleport_generate_title) @+7934624
    # template "{description}" @+7919087; max chars hinted at 75 @+7919045
    taskTitle = await generateTaskTitle(planHeader)

    # Verify GitHub app preflight (OZH)                 @+7934990
    # Results: github_preflight_ok / github_preflight_failed / ghes_optimistic @+7935016–7935076
    ghStatus = await checkGithubPreflight()

    # aR: select source branch (GV)                     @+7934911
    # git symbolic-ref --short refs/remotes/origin/HEAD @+1047232
    # Fallbacks: "main" @+1047345, "master" @+1047352
    branch = resolveDefaultBranch()

    return buildFinalSessionObject(sessionId, env, branch, taskTitle)
```

Key HTTP status codes handled: 200 (+7916543), 201 (+7932319), 400 (+6536671), 401/403/429 (+7932379–7932387), 409 (+7938403), 500 (+7932281).
Timeout for environment list call: 15 000 ms (+6534321).

Analysis basis: CC v2.1.141 bundle.js:+7930180, +7930981, +7931147, +7931785, +7932227, +7932704, +7934624, +7934990

---

### 7. Poll Event Processor — `pollEventProcessor` (`UT7` / `$wq`)

```
async function pollEventProcessor(session, pollHandle):
    startTime = Date.now()                               # @+11119829

    # CT7 → j6: set timeout watchdog (5400 s)           @+11119385 — "5400" seconds = 90 minutes
    watchdog = setTimeoutWatchdog(5400)                  # telemetry: tengu_ultraplan_timeout_seconds @+11119351

    loop:
        event = await pollHandle.nextEvent()             # $wq @+11119915

        if pollStopped:
            break                                        # literal "poll stopped by caller" @+11109187

        match event.type:
            case "plan_ready":                           # @+11110232
                emit(tengu_ultraplan_plan_ready)         # @+11120063
                showPlanToUser(event.plan)

            case "needs_input":                          # @+11110247
                emit(tengu_ultraplan_awaiting_input)     # @+11119995
                waitForUserInput()

            case "approved":                             # @+11109854
                emit(tengu_ultraplan_approved)           # @+11120471
                # Inform local agent: results land as PR @+11120957
                emitAgentMessage("Results will land as a pull request…")
                return Success

            case "terminated" | "requires_action":      # @+11110041, +11110180
                return Failure("terminated")

            case "remote":                               # @+11109926
                handleRemoteEvent(event)

            case "teleport":                             # @+11109948
                handleTeleportEvent(event)

        # Round elapsed time to nearest minute (60 000 ms) @+11110362
        elapsed = Math.round(Date.now() - startTime, "minute") # @+11110377

        if elapsed >= softTimeoutPending:
            emit("timeout_pending")                      # @+11110585
        if elapsed >= hardTimeout:
            emit("timeout_no_plan")                      # @+11110603

    # On network loss after repeated retries:            @+11109540
    throw NetworkError("Lost connection to the remote session after repeated retries…")
```

Polling constants:
- Base interval: 1 000 ms (+7945769)
- Session hard ceiling: 1 800 000 ms / 30 min (+7945776)
- Watchdog: 5 400 s / 90 min (+11119385)
- State-flush delay: 1 500 ms (+11125760)
- `$wq` elapsed rounding unit: 60 000 ms / 1 minute (+11110362)

Analysis basis: CC v2.1.141 bundle.js:+11119351, +11119829, +11109854, +11110232, +11110585, +11120063, +11120471

---

### 8. Background Daemon Interactions (`w` / `Mo_` / `Ao_`)

The local daemon is used for spare-process pre-warming and claim:

```
function claimOrSpawnDaemonWorker(sessionKey):
    # Ao_: attempt to claim a spare worker from daemon socket (qU.claim) @+14446959
    claimed = qU.claim(sessionKey)
    if claimed:
        emit(tengu_bg_spare_claim)                       # @+14466418
        return claimed

    # Fall back to spawning a new worker (qU.spawn)     @+14466740
    emit(tengu_bg_spare_spawn)                           # @+14464880
    return spawnWorker(sessionKey)
```

Low-memory guard: if `os.freemem()` drops below threshold, `tengu_bg_dispatch_low_mem` fires and the spare pool is paused (+14465682).

Analysis basis: CC v2.1.141 bundle.js:+14446959, +14465682, +14466418, +14466740

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_ultraplan_create_failed` | Fires when eligibility check rejects the launch (+11123748) |
| Telemetry: `tengu_ultraplan_prompt_identifier` | Fires when prompt identifier is extracted (+11119518) |
| Telemetry: `tengu_ultraplan_launched` | Fires after successful session enqueue (+11125419) |
| Telemetry: `tengu_ultraplan_awaiting_input` | Fires when remote session reports `needs_input` (+11119995) |
| Telemetry: `tengu_ultraplan_plan_ready` | Fires when remote session returns a draft plan (+11120063) |
| Telemetry: `tengu_ultraplan_approved` | Fires when plan is approved by user (+11120471) |
| Telemetry: `tengu_ultraplan_failed` | Fires on remote session failure (+11121344) |
| Telemetry: `tengu_ultraplan_timeout_seconds` | Records elapsed seconds on timeout (+11119351) |
| Telemetry: `tengu_ccr_bundle_seed_enabled` | Records whether seed bundle upload is active (+6538388) |
| Telemetry: `tengu_ccr_bundle_upload` | Records git bundle upload result (+7916172) |
| Telemetry: `tengu_teleport_bundle_mode` | Records which bundle delivery mode was chosen (+7931402) |
| Telemetry: `tengu_ccr_session_link` | Records session link emitted to user (+7925806) |
| Telemetry: `tengu_teleport_source_decision` | Records which git source strategy was used (+7936401) |
| Telemetry: `tengu_teleport_bundle_mode` | Bundle mode decision event (+7931402) |
| Telemetry: `tengu_slate_kestrel` | Fires during account-tier resolution (+9900038) |
| Telemetry: `tengu_bg_spare_claim` / `_spawn` / `_enable` | Daemon spare-worker lifecycle (+14466418, +14464880, +14466297) |
| Telemetry: `tengu_bg_dispatch_low_mem` / `_sigkill_escalate` | Daemon resource-pressure events (+14465682, +14465103) |
| Telemetry: `tengu_config_parse_error` | Config read error (+3143249) |
| Telemetry: `tengu_feature_ok` / `_bad` | Feature-flag gate pass/fail (+945566, +945624) |
| appState changes | `_.setAppState("already_launching")` set at invocation (+11126991); cleared after completion |
| appState read | `_.getAppState()` polled to detect duplicate invocations (+11126773) |
| Hook registration | Task-notification hook registered via `Twq` ("task-notification") (+11124003) |
| File I/O | Git seed bundle written to temp path, uploaded, then `KnH.unlink`-ed after upload (+7917954); config read via `readFileSync` (+9901991); backup copies via `copyFileSync` (+3143757) |
| Network | HTTP POST to session creation endpoint (+7932227); HTTP GET for environment list (+6534241); Axios used (`x8.post`, `x8.get`, `x8.isAxiosError`, `x8.isCancel`) |
| Browser | `vr.open` (Q58) opens Claude.ai session URL in system browser (+12080585) |
| Sound | Not observed in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.141 | Initial analysis |

---

## Common Mistakes

1. **Invoking without a Claude.ai login.** The command requires a `claude.ai` account session (not an API key). Running it with only an API key set produces the `not_logged_in` error with the message "Please run /login and sign in with your Claude.ai account (not Console)." (+7940623)

2. **Missing git remote.** The command requires a GitHub remote (`origin`). Repositories with no remote will fail with `no_git_remote` and the message "Add one with `git remote add origin REPO_URL`." (+7940862)

3. **GitHub App not installed.** Even with a remote, the GitHub App must be installed in the repository's organization. Failure produces `github_app_not_installed` (+7940957).

4. **Calling `/ultraplan` twice rapidly.** The second invocation is silently skipped if the state is `already_polling`, or warns and returns if it is `already_launching` (+11122575). There is no visual indicator that the second call was dropped.

5. **Using the command in a non-git directory.** There is an explicit `not_in_git_repo` gate (+7940702). The empty-sandbox fallback only engages when no git repository *at all* is detected, not as a user-facing workaround.

6. **Org policy blocks.** If the organization admin has disabled remote sessions, the command fails immediately with `policy_blocked` and "Remote sessions are disabled by your organization's policy." (+7941134). This cannot be overridden client-side.

7. **Waiting too long to approve the plan.** The remote session has a hard ceiling of 30 minutes (+7945776) and a watchdog of 5 400 seconds / 90 minutes (+11119385) on the polling side. A session that exceeds the 30-minute remote cap will report `timeout_pending` or `timeout_no_plan` regardless of local inactivity.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `dT7` | Main async handler for `/ultraplan` (arbor-resolved entry point) |
| `nJ8` | Prompt normalization — outer wrapper |
| `lJ8` | Prompt tokenizer — inner worker |
| `Dwq` | Token scanner / keyword detector (`startsWith`, `matchAll`, `push`) |
| `pq` | Remote-eligibility checker |
| `kAq` | Eligibility sub-checker (calls `ZR_`) |
| `ZR_` | Config reader and routing resolver |
| `bp` | Account-tier resolver (`firstParty`, `enterprise`, `team`) |
| `vAq` | File-based config reader (`readFileSync`, `utf-8`) |
| `Vq` | Session routing resolver |
| `cMA` | Routing helper (calls `RH`) |
| `RH` | String conversion / formatting utility |
| `J0H` | Eligibility response formatter |
| `kYH` | Progress-tracking reference holder |
| `f06` | Launch-flow coordinator |
| `Q` | Session-key / hash computation utility |
| `L` | Live-session set / cleanup registry |
| `Twq` | Task-notification hook registrar |
| `oJ8` | Orchestrator outer wrapper |
| `rJ8` | Prompt-identifier emitter |
| `j6` | Generic hook / event dispatch utility |
| `xT7` | Secondary prompt-identifier helper |
| `QT7` | Session orchestrator — main async body |
| `UVH` | Background-eligibility check bridge |
| `Mz1` | `bg_remote_eligibility_check` implementation |
| `F5` | Precondition enqueue helper (`later` / `enqueue` queue-operation) |
| `R$H` | State freeze + event-emitter helper |
| `zTH` | Queue-operation executor |
| `pT7` | Plan-draft header composer (`"Here is a draft plan to refine:"`) |
| `mT7` | Plan-header builder sub-function |
| `HKH` | `createTeleportSession` — remote session creation |
| `N6` | Node/env utility (config key reader) |
| `Xf` | Access-token validator |
| `ST_` | Auth / OAuth environment resolver |
| `kH` | Session metadata persister |
| `qN` | Org-UUID resolver |
| `bA` | Environment / endpoint validator (`local`, `staging`, `prod`) |
| `xO` | HTTP client config builder (Content-Type, anthropic-version headers) |
| `IT_` | Git seed bundle uploader (`teleport_git_bundle_upload`) |
| `V6` | Queue-operation base |
| `v` | Log-level formatter (`debug`, `warn`, `error`) |
| `Zy` | Git remote URL resolver (`git config --get remote.origin.url`) |
| `Ph1` | Session UUID generator (`crypto.randomUUID`) |
| `SH` | JSON serializer (`JSON.stringify`) |
| `kT_` | Session-link emitter (`tengu_ccr_session_link`) |
| `ln` | `teleport_environments_list` fetcher |
| `VdH` | `teleport_default_environment_create` — auto-create default cloud env |
| `TH` | String coercion utility |
| `iB4` | Task-title generator (`teleport_generate_title`) |
| `aR` | Source-branch selector |
| `OZH` | GitHub App preflight checker (`checkGithubAppInstalled`) |
| `GV` | Default-branch resolver (`git symbolic-ref`, `main`/`master` fallback) |
| `m1` | Notification / toast helper |
| `k_` | Error code extractor |
| `Ud` | Cancel-token checker |
| `Yy` | Post-session cleanup |
| `iY` | Browser-window opener (routes to `qA` / `gM_`) |
| `qA` | URL resolution + `window.open` dispatcher |
| `gM_` | Browser URL builder (localhost / staging / prod) |
| `FT7` | Fallback handler setup |
| `LnH` | Long-poll session monitor (`remote_agent`, `tengu_ultraplan_*` events) |
| `ch` | Random-bytes nonce generator |
| `Q58` | Browser-open helper (`vr.open`) |
| `t2` | Poll-timer utility |
| `AF4` | Session-URL formatter |
| `Gh1` | Poll-events inner loop |
| `eN` | Poll-event dispatcher (`task_started`, `task_updated`) |
| `Of4` | Task-started handler |
| `Mf4` | Task-updated handler |
| `cY_` | Event delivery helper |
| `zf4` | Timestamped event recorder |
| `Yf4` | Keyed-event recorder (`Object.keys`) |
| `UT7` | Poll-event processor (`plan_ready`, `needs_input`, `approved`, etc.) |
| `$wq` | Low-level poll loop (network retry, `NYH`, `ZdH`) |
| `CT7` | Watchdog-timeout setter |
| `gT7` | Poll-state transition helper |
| `PJ6` | Temp-file cleanup on poll end (`GL.unlink`) |
| `K` | Column-pad formatter (`padEnd`) |
| `DQ` | Session-close notification dispatcher |
| `b9` | State-atom updater (`jI8.add` / `jI8.delete` / `Object.assign`) |
| `JKK` | State-atom value guard |
| `BT7` | Background-task fallback registrar |
| `h6` | Config file accessor / watcher |
| `x6` | Config path resolver |
| `_9_` | Config watch flag |
| `cMH` | Config read/write implementation |
| `b6` | JSON parser |
| `DR` | Config key prefix stripper |
| `M8` | Schema validator |
| `rE9` | Config directory scanner (`readdirStringSync`) |
| `$9_` | Config path joiner (`dz.join`) |
| `$` | XTq-based path helper |
| `w` | Daemon subprocess manager |
| `S` | Subprocess resource monitor |
| `xH` | Feature-ok telemetry emitter |
| `hH` | Feature-bad telemetry emitter |
| `YG6` | macOS memory monitor |
| `u` | Subprocess I/O writer |
| `Ao_` | Daemon spare-process claimer |
| `Mo_` | Daemon process lifecycle manager |
| `D` | Spare-process spawner |
| `p` | Process disposer |
| `EhL` | File-watcher helper (`watchFile` / `unwatchFile`) |
| `Jl` | Watch-event handler |
| `baH` | Session-archive async helper (`Promise.all`, `OZH`, `aR`) |