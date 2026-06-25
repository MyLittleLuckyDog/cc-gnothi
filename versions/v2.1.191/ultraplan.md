---
type: feature-spec
feature: "ultraplan"
cc_version: "2.1.191"
updated: "2026-06-25"
tags: ["ultraplan", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.191 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultraplan`

> Analysis basis: CC v2.1.191 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.191

---

## Overview

`/ultraplan` drafts an editable implementation plan by launching a background cloud session (teleport) on Claude.ai that analyzes the current git repository and user prompt, then delivers a structured plan back to the local session — optionally allowing the user to approve and continue into a full remote execution. It is a `local-jsx` command whose handler (`pvf`) is inlined via the `load_ident` pattern (`load:()=>Promise.resolve({call: pvf})`). The command encapsulates a multi-phase preflight, session-creation, and long-poll lifecycle, with each phase emitting structured telemetry.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultraplan` |
| description | `"Draft an editable plan in Claude Code on the web ( ... ) · See  ... "` |
| argumentHint | `<prompt>` |
| load_inline | `true` |
| load_ident | `pvf` |
| loc_byte | `12377365` |
| loc_byte_end | `12377597` |
| loc_line | `8172` |
| arbor_handler.name | `pvf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.fqn | `claude-2.1.191::pvf` |
| arbor_handler.resolution_path | `load_ident` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.191 bundle.js:+12377365

---

## Input Branching

The command has more than three distinct branches spanning preflight checks, prompt parsing, launch guards, session polling states, and approval routing. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/ultraplan <prompt>"]) --> B{allow_remote_sessions?}
    B -- no --> ERR_REMOTE["Error: remote sessions disabled\n(policy_blocked)"]
    B -- yes --> C{User logged in?\n(access token present)}
    C -- no --> ERR_LOGIN["Error: not_logged_in\nPlease run /login"]
    C -- yes --> D{In a git repo?}
    D -- no --> ERR_GIT["Error: not_in_git_repo"]
    D -- yes --> E{Git remote present?}
    E -- no --> ERR_REMOTE2["Error: no_git_remote\nAdd GitHub remote"]
    E -- yes --> F{GitHub App installed?}
    F -- no --> ERR_APP["Error: github_app_not_installed"]
    F -- yes --> G{Already launching /\nalready polling?}
    G -- yes --> ERR_LAUNCH["Error: already_launching\nPlease wait"]
    G -- no --> H[Parse prompt\nvia promptParser + nameReplacer]
    H --> I{Prompt contains\n'ultraplan' keyword?}
    I -- yes --> J[Strip keyword from prompt text]
    I -- no --> J
    J --> K[Run eligibility check\nbg_remote_eligibility_check]
    K --> L{Eligibility passed?}
    L -- no --> ERR_ELIG["Error: precondition failed\n(various sub-codes)"]
    L -- yes --> M[Generate title + branch name\nteleport_generate_title]
    M --> N[Select / auto-create\ncloud environment\n(env-select phase)]
    N --> O[Upload git bundle\n(bundle-upload phase)]
    O --> P[POST session creation request\nwith anthropic-beta: ccr-byoc-2025-07-29]
    P --> Q{Response status}
    Q -- 201 Created --> R[Start long-poll loop\n(avf / zNl)]
    Q -- 401/403/429/500 --> ERR_API["Error: create_request_failed\nor specific error code"]
    Q -- malformed / no session id --> ERR_MAL["Error: malformed_response"]
    R --> S{Poll result status}
    S -- plan_ready --> T["Emit plan to local session\n'Here is a draft plan to refine:'\n→ tengu_ultraplan_plan_ready"]
    S -- needs_input / awaiting_input --> U["Prompt user for clarification\n→ tengu_ultraplan_awaiting_input"]
    U --> R
    S -- approved --> V["Session approved — results via PR\n→ tengu_ultraplan_approved"]
    S -- terminated / session_error --> W["Error message to agent\n→ tengu_ultraplan_failed"]
    S -- poll_timeout --> X["Timeout error\n→ tengu_ultraplan_timeout_seconds"]
    S -- orchestrator_error --> W
    T --> Y{User approves plan?}
    Y -- yes --> V
    Y -- no --> Z["Refine local plan\n(falls back to local agent)"]
```

Analysis basis: CC v2.1.191 bundle.js:+12375500, +12372688, +12368690, +12359082

---

## Behavioral Spec

### 1. Entry Point — Handler `pvf`

The main async handler `pvf` is the resolved entry point (Arbor: `load_ident` path).

```
async function ultraplanHandler(toolContext):
    appState = toolContext.getAppState()

    // Guard: remote sessions must be enabled
    if not appState.settings["allow_remote_sessions"]:
        return errorMessage("policy_blocked", ...)

    // Guard: user must be authenticated (vs / checkSessionEligibility)
    eligibility = await checkSessionEligibility(appState)
    if eligibility.error:
        return errorMessage(eligibility.code, eligibility.message)

    // Delegate to launch coordinator
    result = await launchCoordinator(toolContext, appState)
    toolContext.setAppState(updatedState)
    return result
```

Analysis basis: CC v2.1.191 bundle.js:+12375500, +12375835, +12376057

---

### 2. Prompt Parsing — `promptParser` (Czn) and `nameReplacer`

Before the cloud session is created the raw argument string is normalised.

```
function parseUltraplanPrompt(rawArgument):
    // Czn → Izn → Yvo pipeline
    tokens = tokenise(rawArgument)   // Yvo: splits on whitespace, checks startsWith
    for each token:
        if token.matchAll(globalCaseInsensitiveRegex("ultraplan")):
            mark for removal
        push remaining tokens into result array

    cleaned = result.join(" ")

    // nameReplacer (Czn step 2): normalise whitespace
    cleaned = cleaned.slice(...)               // strip leading/trailing
    cleaned = cleaned.replace(/(\S)(\s{2,})/g, "$1$2")  // collapse runs → single space
    cleaned = cleaned.slice(0, 5)              // internal truncation constant: 5 words?

    return cleaned
```

Regex flag literal `"gi"` found at bundle.js:+10997037. Replacement pattern `"$1$2"` at +10997714. Constant `5` at +10997737.

Analysis basis: CC v2.1.191 bundle.js:+10997589, +10997617, +10997688

---

### 3. Session Eligibility Check — `checkSessionEligibility` (vs / CCa)

```
async function checkSessionEligibility(appState):
    // vs: checks product-feedback / telemetry flags
    if not hasProductFeedbackFlag(appState):   // "allow_product_feedback"
        return { error: true, code: "policy_blocked" }

    // H_d.has / __d.has — internal capability sets
    if not capabilitySet.has("allow_remote_sessions"):
        return { error: true, code: "policy_blocked" }

    // Yi / Qge: resolve telemetry consent level
    consentLevel = resolveTelemetryConsent(appState)
    // "essential-traffic" | "no-telemetry" | "default"

    // CCa: background remote eligibility
    result = await bgRemoteEligibilityCheck(appState)
    // Emits: tengu_ccr_bundle_seed_enabled
    // Checks: byoc flag, github.com remote, org UUID
    return result
```

Known error codes from eligibility layer: `not_logged_in`, `not_in_git_repo`, `no_git_remote`, `github_app_not_installed`, `policy_blocked`, `not_first_party`, `no_access_token`, `no_org_uuid`.

Analysis basis: CC v2.1.191 bundle.js:+3356853, +3356897, +3356935, +7323948, +12375518

---

### 4. Duplicate Launch Guard — `launchCoordinator` (CKt)

```
async function launchCoordinator(toolContext, appState):
    if appState.ultraplanState == "already_polling":
        emit tengu_ultraplan_create_failed
        return error("already_polling")

    if appState.ultraplanState == "already_launching":
        return error("already_launching",
            "ultraplan: already launching. Please wait for the session to start.")

    // Usage hint when prompt is empty/missing
    if not prompt:
        return hint(
            'Usage: /ultraplan <prompt>, or include "ultraplan" anywhere in your prompt'
        )

    // Signal: invocation source = "slash"
    // Context system message role: "system"
    // Delegate to session launcher (dvf)
    return await sessionLauncher(toolContext, appState, cleanedPrompt)
```

Literal `"already_launching"` at bundle.js:+12372965; `"already_polling"` at +12372947; usage string at +12373012; `"in your prompt"` continuation at +12373078.

Analysis basis: CC v2.1.191 bundle.js:+12372688, +12372723, +12372802, +12372881

---

### 5. Session Launcher — `sessionLauncher` (dvf)

`dvf` orchestrates the multi-phase teleport workflow:

```
async function sessionLauncher(toolContext, appState, prompt):
    // Phase: precondition
    preconditionResult = await runPreconditionChecks(appState)
    // Emits: tengu_ccr_session_link
    if preconditionResult.failed:
        return errorBlock("precondition", preconditionResult.code)

    // Phase: task-notification setup
    taskNotification = setupTaskNotification()

    // Phase: env-select (jte / Ict)
    // Logs: "[teleport] phase: env-select"
    environments = await listTeleportEnvironments(appState)
    // Auto-creates default env if none present (teleport_default_environment_create)
    // Logs: "[teleportToRemote] Auto-created default cloud env"
    selectedEnv = selectBestEnvironment(environments)

    // Phase: branch-detect (Ck)
    // git symbolic-ref --short refs/remotes/origin/HEAD → extracts main/master
    branch = await detectDefaultBranch()

    // Phase: bundle-upload (Ego)
    // Logs: "[teleport] phase: bundle-upload"
    // git stash create → pack refs → upload to API
    // Emits: tengu_ccr_bundle_upload, tengu_teleport_bundle_mode,
    //         tengu_teleport_source_decision
    uploadResult = await uploadGitBundle(appState, selectedEnv)

    // Phase: POST-sent
    // Logs: "[teleport] phase: POST-sent"
    // POST with headers:
    //   anthropic-beta: ccr-byoc-2025-07-29
    //   x-organization-uuid: <org_uuid>
    //   Content-Type: application/json
    //   anthropic-version: 2023-06-01
    sessionResponse = await createRemoteSession(appState, prompt, selectedEnv, uploadResult)

    if not sessionResponse.session_id:
        return error("malformed_response",
            "Server returned a malformed session response (no session id)")

    // Emit: tengu_ultraplan_launched
    emit("tengu_ultraplan_launched", { ... })

    // Enter poll loop
    return await pollSessionLoop(sessionResponse.session_id, toolContext, prompt)
```

Timeout constant: `5400` seconds (bundle.js:+12368254). Poll interval: `1000` ms with max `1800000` ms (30 min) timeout (bundle.js:+8743969, +8743976).

Analysis basis: CC v2.1.191 bundle.js:+12373215, +12373457, +12373648, +12373784, +12374299, +12374703

---

### 6. Plan Draft Assembly — `planDraftBuilder` (ivf / svf)

When the remote session signals `plan_ready`, the plan content is assembled locally:

```
function buildPlanDraft(rawPlanChunks):
    result = []
    result.push("Here is a draft plan to refine:")   // literal at +12368561
    for chunk in rawPlanChunks:
        formatted = formatChunk(chunk)    // svf → nvf
        result.push(formatted)
    return result.join("")
```

Analysis basis: CC v2.1.191 bundle.js:+12368554, +12368614

---

### 7. Poll Loop — `pollSessionLoop` (avf / zNl)

```
async function pollSessionLoop(sessionId, toolContext, prompt):
    startTime = Date.now()
    timeoutMs = 5400 * 1000    // 5400 s, +12368254
    pollInterval = 1000        // ms, +8743969

    while elapsed < timeoutMs:
        status = await fetchSessionStatus(sessionId)  // zNl

        switch status.state:
            case "plan_ready":
                emit("tengu_ultraplan_plan_ready")
                planText = assemblePlanDraft(status.plan)
                return presentPlanToUser(planText)

            case "needs_input" | "awaiting_input":
                emit("tengu_ultraplan_awaiting_input")
                userInput = await requestUserInput()
                await sendInputToSession(sessionId, userInput)
                continue

            case "approved":
                emit("tengu_ultraplan_approved")
                // Agent message: "Results will land as a pull request..."
                return systemMessage(
                    "Results will land as a pull request when the cloud session finishes. " +
                    "There is nothing to do here."
                )

            case "terminated" | "session_error" | "orchestrator_error":
                emit("tengu_ultraplan_failed")
                return agentMessage(
                    "Cloud ultraplan session failed. Wait for the user's next instructions."
                )

            case "poll_timeout" | "poll_timeout_after_api_error":
                emit("tengu_ultraplan_timeout_seconds", elapsed)
                return timeoutError()

            default:
                await sleep(pollInterval)

    emit("tengu_ultraplan_timeout_seconds", elapsed)
    return timeoutError("timeout_no_plan" or "timeout_pending")
```

Poll timeout sub-codes: `"timeout_pending"` (+12360623), `"timeout_no_plan"` (+12360641). Connection-loss message: `"Lost connection to the cloud session after repeated retries — the session may still be running"` (+12359580).

Analysis basis: CC v2.1.191 bundle.js:+12368690, +12359082, +12360318, +12360387

---

### 8. Environment Selection — `teleportEnvironments` (jte / Ict)

```
async function listAndSelectEnvironment(appState):
    // Emits: teleport_environments_list
    // Requires: first-party Anthropic API (not_first_party guard)
    // Requires: claude.ai account login (not API key)
    environments = await fetchEnvironments(appState)
    // timeout: 15000 ms (+7320048)

    if environments is empty:
        // Auto-create a Default environment
        // POST with: anthropic_cloud type, /home/user workdir,
        //            python 3.11, node 20
        // Emits: teleport_default_environment_create
        newEnv = await createDefaultEnvironment(appState)
        if failed:
            warn("Could not create a cloud environment. " +
                 "Set one up at https://claude.ai/code/onboarding?magic=env-setup")
            emit("env_create", { code: "no_default_env" })
        return [newEnv]

    // Prefer "bridge" type env; fall back to first available
    return selectPreferredEnv(environments)
```

Analysis basis: CC v2.1.191 bundle.js:+7319410, +7320469, +7320884, +7320914, +8725428

---

### 9. Git Bundle Upload — `gitBundleUpload` (Ego)

```
async function uploadGitBundle(appState, env):
    // Emits: teleport_git_bundle_upload
    // Guards: must be in a git repo

    if not inGitRepo():
        throw Error("Not in a git repository", code: "empty_repo")

    // Check for commits
    result = git("for-each-ref", "--count=1", "refs/")
    if no commits:
        throw Error("Repository has no commits yet")

    // Strategy: head → fallback_head → squashed → fallback_squashed
    bundleFile = createBundleFile("ccr-seed.bundle")
    stashOid = git("stash", "create")
    if stashOid:
        git("update-ref", "refs/seed/stash", stashOid)
    git("update-ref", "refs/seed/root", "HEAD")

    uploadResult = await PUT(bundleUrl, bundleFile)
    // Emits: tengu_ccr_bundle_upload { strategy: "head"|"fallback_head"|... }
    // Emits: tengu_teleport_bundle_mode
    // Emits: tengu_teleport_source_decision

    // Cleanup: Apt.unlink(bundleFile)
    return uploadResult
```

Bundle naming constant: `"ccr-seed"` + `".bundle"` (+8706614, +8706625). Seed bundle name `"_source_seed.bundle"` (+8706921). Git refs used: `"refs/seed/stash"` (+8705419), `"refs/seed/root"` (+8705437).

Analysis basis: CC v2.1.191 bundle.js:+8705289, +8705611, +8706610, +8707222

---

### 10. Error Recovery — Orphaned Session Archival

```
async function archiveOrphanedSession(sessionId):
    try:
        await archiveSession(sessionId)
    catch err:
        log.warn("ultraplan: failed to archive orphaned session", err)
        // literal at +12375185
```

Analysis basis: CC v2.1.191 bundle.js:+12375185

---

### 11. Task State Management — `taskStateManager` (TM / avf)

```
function updateTaskState(taskId, event, payload):
    switch event:
        case "task_started":    // +10395265
            setState(taskId, {
                agentType: payload.agentType,    // +10395357
                workflowName: payload.workflowName, // +10395423
                prompt: payload.prompt,          // +10395471
                status: "active"
            })
            emit W_e.setState(...)

        case "task_updated":    // +10394320
            updateExisting(taskId, payload)

        case "local_workflow":  // +10395784
            // retain existing entry
            break
```

Analysis basis: CC v2.1.191 bundle.js:+10393524, +10393546, +10393789, +10394119

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_ultraplan_create_failed` | Fired when a duplicate-launch guard fires or creation fails (bundle.js:+12372725) |
| Telemetry: `tengu_ultraplan_prompt_identifier` | Fired to record how the prompt was identified/classified (bundle.js:+12368387) |
| Telemetry: `tengu_ultraplan_launched` | Fired after the remote session POST succeeds (bundle.js:+12374432) |
| Telemetry: `tengu_ultraplan_awaiting_input` | Fired when the cloud session requests more input (bundle.js:+12368864) |
| Telemetry: `tengu_ultraplan_plan_ready` | Fired when the cloud session returns a draft plan (bundle.js:+12368932) |
| Telemetry: `tengu_ultraplan_approved` | Fired when the plan is approved and execution continues (bundle.js:+12369352) |
| Telemetry: `tengu_ultraplan_failed` | Fired on session error or termination (bundle.js:+12370241) |
| Telemetry: `tengu_ultraplan_timeout_seconds` | Fired on poll timeout, carries elapsed seconds (bundle.js:+12368220) |
| Telemetry: `tengu_ccr_bundle_seed_enabled` | Fired during eligibility check for BYOC seed bundles (bundle.js:+7324421) |
| Telemetry: `tengu_ccr_bundle_upload` | Fired after git bundle upload attempt with strategy tag (bundle.js:+8705611) |
| Telemetry: `tengu_teleport_bundle_mode` | Records which bundle mode was chosen (bundle.js:+8723374) |
| Telemetry: `tengu_ccr_session_link` | Fired when the cloud session link is generated (bundle.js:+8715637) |
| Telemetry: `tengu_teleport_source_decision` | Records source repo decision (bundle.js:+8729195) |
| Telemetry: `tengu_daemon_yield` | Background daemon yield event (bundle.js:+17391071) |
| Telemetry: `tengu_config_parse_error` | Fired on config file parse failure (bundle.js:+13869283) |
| Hook registration | `_i` calls `xqo.register` at bundle.js:+67562 — registers a background task notification hook |
| appState changes | `t.getAppState()` read at +12375835; `t.setAppState()` written at +12376057 — ultraplan launch/poll state stored in app state |
| File I/O | `gvi.readFileSync` (config, UTF-8), `r.readFileSync`, `r.mkdirSync`, `r.copyFileSync`, `r.readdirStringSync`, `r.statSync`, `fl.unlink`, `Apt.unlink` (bundle cleanup), `Tps.watchFile` / `_Xl.unwatchFile` (config watch) |
| Network | `go.post` (session creation, environment API), `go.get` (status polling), `go.isAxiosError` / `go.isCancel` (error classification) |
| Random ID generation | `bpt.randomUUID()` at +8721151 (session IDs); `LKKl.randomBytes` at +13438773 (crypto nonce) |
| Timeout: poll interval | 1,000 ms (+8743969) |
| Timeout: max poll duration | 1,800,000 ms / 30 min (+8743976) |
| Timeout: overall session | 5,400 s / 90 min (+12368254) |
| Timeout: environment list | 15,000 ms (+7320048) |
| HTTP status handling | 200 OK, 201 Created, 400, 401, 403, 409 Conflict, 429 Rate-limit, 500 Server error |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.191 | Initial analysis |

---

## Common Mistakes

1. **Running `/ultraplan` without a Claude.ai login.** The command requires an OAuth-based claude.ai session — an API key alone is not sufficient. Error code: `not_logged_in` / `no_access_token`. Fix: run `/login`.
2. **No GitHub remote configured.** The cloud session requires a GitHub remote (`remote.origin.url`). Error code: `no_git_remote`. Fix: `git remote add origin REPO_URL`.
3. **Running the command in a non-git directory.** The bundle-upload phase will fail immediately. Error code: `not_in_git_repo`. Fix: initialise a git repository first.
4. **Invoking `/ultraplan` while a previous session is still launching.** The duplicate-launch guard returns `"already_launching"` immediately. Wait for the existing session to start or complete before retrying.
5. **Expecting instant results.** The command starts a background cloud session. The plan arrives asynchronously via polling; the poll may take up to 90 minutes before timing out (`timeout_no_plan`).
6. **Using `/ultraplan` on a non-first-party Anthropic API provider.** Cloud sessions are exclusively available via the Anthropic first-party API. Error code: `not_first_party`.
7. **Empty repository.** A repository with no commits causes the git bundle upload to fail. Fix: `git add . && git commit -m "initial"` before invoking the command.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `pvf` | Main async handler for `/ultraplan` (entry point, AsyncFunction) |
| `Czn` | Prompt parser — strips `ultraplan` keyword and normalises whitespace |
| `Izn` | Prompt tokeniser sub-step (called by Czn) |
| `Yvo` | Token-level scanner; checks `startsWith`, runs `matchAll` against `"ultraplan"` regex |
| `vs` | Session eligibility checker; inspects capability sets and telemetry consent |
| `Hvi` | Eligibility check sub-call (called by vs) |
| `G4` | Eligibility inner resolver |
| `gF` | Eligibility detail fetcher |
| `PDt` | Config file reader (`readFileSync`, UTF-8) |
| `che` | Capability predicate helper (checks `n.some`, `t.includes`) |
| `Yi` | Telemetry consent level resolver |
| `ncs` | Consent string normaliser |
| `rt` | String utility / toString wrapper |
| `Qge` | Product-feedback flag resolver |
| `gne` | App-state accessor helper |
| `CKt` | Launch coordinator — guards against duplicate launches and dispatches to dvf |
| `Ve` | UI component wrapper (JSX) |
| `eze` | Base JSX component |
| `nUl` | Notification / user-message emitter |
| `OQn` | Polling orchestrator outer wrapper |
| `PQn` | Polling orchestrator inner (calls `nt`) |
| `nt` | Session-status fetch function |
| `rvf` | Poll result handler helper |
| `dvf` | Session launcher — full teleport lifecycle |
| `pue` | Pre-session setup helper |
| `CCa` | Background remote eligibility check (`bg_remote_eligibility_check`) |
| `cs` | React context/state accessor |
| `ux` | React `useContext` hook |
| `Pu` | React context value |
| `ivf` | Plan draft builder — concatenates plan header and chunks |
| `svf` | Plan chunk formatter |
| `nvf` | Raw chunk processor (called by svf) |
| `L6` | Teleport-to-remote main orchestrator |
| `Dt` | Telemetry / diagnostic emitter |
| `jl` | First-party provider check (`firstParty`) |
| `Ng` | Token refresh helper (`refreshed`) |
| `H5n` | Access token retriever |
| `Le` | Logger / error reporter (`GQ.logError`, `sXe.push`) |
| `oB` | Organisation UUID resolver |
| `xs` | API base-URL resolver (local / staging / prod) |
| `rS` | HTTP headers builder (Content-Type, anthropic-version, etc.) |
| `Ego` | Git bundle creator and uploader (`teleport_git_bundle_upload`) |
| `wt` | React `useContext` hook variant |
| `T` | Message type / role classifier |
| `Pe` | JSX component (renders UI blocks) |
| `jO` | Git remote URL extractor (`remote.origin.url`) |
| `rja` | Session control-request builder (permission mode, flags) |
| `OBt` | Session response validator |
| `ke` | JSON serialiser wrapper |
| `ne` | UI notification components (Z, te, A, w) |
| `Ago` | Session-created success handler |
| `bgo` | Session-creation error handler |
| `nja` | Session link / URL builder |
| `KNn` | Session status code mapper |
| `jte` | Environment list fetcher (`teleport_environments_list`) |
| `Ict` | Default environment creator (`teleport_default_environment_create`) |
| `Ae` | String coercion utility |
| `dFp` | Branch name and title generator (`teleport_generate_title`) |
| `hFp` | Environment filter helper |
| `fF` | GitHub App installation status checker |
| `L5e` | GitHub App installation verifier (`checkGithubAppInstalled`) |
| `Ck` | Default branch detector (symbolic-ref, show-ref) |
| `Es` | Error code mapper for API errors |
| `Ase` | Git remote URL parser (https/http protocol extractor) |
| `K` | Environment list state |
| `se` | String trim/split utility |
| `fo` | Error constructor helper |
| `uh` | Abort/cancel check helper |
| `t_` | Task state transition helper |
| `Ly` | HTTP client factory (axios / fetch wrapper) |
| `io` | HTTP client initialiser |
| `DFt` | HTTP client instance builder |
| `cvf` | Local fallback plan handler |
| `Gye` | Remote session state watcher / poller (outer) |
| `C3` | Random bytes generator |
| `Ipt` | Pending-state initialiser |
| `_C` | Session-start timestamp recorder |
| `SFp` | Session display string builder |
| `aja` | Core session polling loop |
| `TM` | Task manager state machine |
| `XXp` | Task-started handler |
| `zXp` | Task-updated handler |
| `gNn` | App-state `setState` caller (`W_e.setState`) |
| `kTo` | Task key generator |
| `JXp` | Task-started event processor |
| `QXp` | Task-updated event processor |
| `Que` | Task query / selector |
| `avf` | Poll loop coordinator (wraps zNl, feeds results to TM) |
| `zNl` | Long-poll fetch loop — handles plan_ready / approved / terminated etc. |
| `tvf` | Poll timeout checker |
| `uvf` | Poll state update helper |
| `E5t` | Temp file cleanup utility (`fl.unlink`) |
| `x6` | Session update poster (go.post) |
| `_i` | Background hook registrar (`xqo.register`) |
| `lvf` | Launch-state cleanup helper |
| `kt` | Config file manager (read / watch / backup) |
| `Gt` | Config directory path resolver |
| `C2o` | Config schema validator |
| `tEt` | Config file read + migration handler |
| `$t` | JSON.parse wrapper |
| `n4` | Config key prefix stripper |
| `dn` | Config value deserialiser |
| `L2o` | Config backup path builder |
| `R2o` | Config backup directory joiner |
| `K9f` | Config file watcher setup |
| `$vt` | File-watch callback handler (`Tps.watchFile`) |
| `Hpe` | Config hot-reload handler |
| `v_t` | Startup precondition checker (Promise.all over jO, fF, _u, Dt) |
| `Hke` | Session event dispatcher |
| `lja` | Plan review output extractor |
| `wgo` | Session message ingester |
| `bH` | Hook progress event handler |
| `Bye` | Hook response event handler |
| `sja` | Session start event handler (`SessionStart`) |
| `CFp` | Orchestrator error classifier |
| `AFp` | Session error classifier |
| `TFp` | Poll timeout classifier |
| `IFp` | No-review-output classifier |
| `ija` | Session idle-state handler |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.