---
type: feature-spec
feature: "ultraplan"
cc_version: "2.1.159"
updated: "2026-06-02"
tags: ["ultraplan", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.159 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultraplan`

> Analysis basis: CC v2.1.159 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.159

---

## Overview

`/ultraplan` launches a remote, web-based planning session on Claude.ai that drafts a structured implementation plan for a given prompt. The user may review and edit the draft plan locally before approving it, after which the remote agent executes the approved plan and delivers results as a GitHub pull request. The command integrates prerequisite checking (login, git repo, GitHub remote, GitHub App installation, and org policy) before initiating the remote session.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultraplan` |
| description | `… Claude Code on the web drafts a plan you can edit and approve. See …` |
| argumentHint | `<prompt>` |
| load_inline | `true` |
| load_ident | `V45` |
| loc_byte | `11943214` |
| loc_byte_end | `11943458` |
| loc_line | `7793` |
| arbor_handler.name | `V45` |
| arbor_handler.fqn | `claude-2.1.159::V45` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `load_ident` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.159 bundle.js:+11943214

---

## Input Branching

The command has well over three distinct branches (prerequisite failures, duplicate-launch guards, prompt-parsing variants, remote session lifecycle states, plan-ready approval, and error paths). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/ultraplan <prompt>"]) --> B{allow_remote_sessions\nconfigured?}
    B -- no --> ERR_POL["Error: policy_blocked\n(org policy disables remote sessions)"]
    B -- yes --> C{User logged in\n(Claude.ai account)?}
    C -- no --> ERR_LOGIN["Error: not_logged_in\nPrompt: run /login"]
    C -- yes --> D{Inside a git repo?}
    D -- no --> ERR_GIT["Error: not_in_git_repo"]
    D -- yes --> E{GitHub remote\ndetected?}
    E -- no --> ERR_REM["Error: no_git_remote\nAdd origin remote"]
    E -- yes --> F{GitHub App\ninstalled for org?}
    F -- no --> ERR_APP["Error: github_app_not_installed\nSetup at claude.ai/code"]
    F -- yes --> G{Already launching\nor polling?}
    G -- already_launching --> WARN_LAUNCH["Warn: ultraplan already launching"]
    G -- already_polling --> SKIP["Skip / no-op"]
    G -- no --> H{Prompt contains\n'ultraplan' keyword\nor /ultraplan prefix?}
    H -- no valid prompt --> ERR_USAGE["Error: Usage hint\n/ultraplan <prompt>"]
    H -- valid prompt --> I[Generate local draft plan\nvia remoteAgentPlanning]
    I --> J{Remote session\ncreation result}
    J -- create_api_fail --> ERR_CREATE["Error: create_api_fail\ntengu_ultraplan_create_failed"]
    J -- teleport_null --> ERR_TP["Error: teleport_null\n+ --debug hint"]
    J -- precondition error --> ERR_PRE["Precondition block\n(repo, policy, etc.)"]
    J -- success --> K[Poll remote session\n(tengu_ultraplan_launched)]
    K --> L{Remote session state}
    L -- plan_ready --> M[Present draft plan\nfor local review + edit]
    M --> N{User approves?}
    N -- approved --> O[Execute plan remotely\ntengu_ultraplan_approved]
    O --> P[Results → GitHub PR]
    N -- rejected --> ABORT["Abort / wait for\nnext instructions"]
    L -- needs_input --> INPUT["Await user input\ntengu_ultraplan_awaiting_input"]
    L -- requires_action --> ACTION["Requires action\n(forward to user)"]
    L -- terminated/failed --> FAIL["tengu_ultraplan_failed\nError message to user"]
    L -- timeout_pending --> TO1["Timeout: still pending"]
    L -- timeout_no_plan --> TO2["Timeout: no plan produced"]
    L -- completed --> DONE["Session complete\ntengu_ultraplan_plan_ready"]
    L -- unexpected_error --> ERR_UNX["Unexpected error\ntengu_ultraplan_failed"]
```

Analysis basis: CC v2.1.159 bundle.js:+11941358, +11941486, +11938873, +11938891, +11939462, +11940017, +11940035, +11940328

---

## Behavioral Spec

### Top-level Handler (`V45`)

The primary entry point is the async handler `V45` (Arbor-resolved, `resolution_path: load_ident`).

```
async function ultraplanHandler(commandArgs, appContext):

    // 1. Check org policy gate
    settingsValue = getAppState("allow_remote_sessions")
    if settingsValue is falsy:
        return error("policy_blocked")

    // 2. Normalize the prompt text
    rawPrompt = normalizePromptText(commandArgs)       // calls promptNormalizer (zT8)

    // 3. Determine invocation source
    invocationSource = "slash"                         // literal at +11941504

    // 4. Check for duplicate launch guard
    if launchState == "already_polling":
        return (no-op / skip)
    if launchState == "already_launching":
        return warn("ultraplan: already launching. Please wait for the session to start.")

    // 5. Validate prompt keyword presence
    if not promptContainsUltraplanKeyword(rawPrompt):
        return usage("Usage: /ultraplan <prompt>, or include \"ultraplan\" anywhere in your prompt")

    // 6. Run eligibility pre-checks (remoteEligibilityCheck → I9)
    eligibilityResult = await remoteEligibilityCheck(appContext)
    if eligibilityResult.blocked:
        return error(eligibilityResult.reason)

    // 7. Launch the remote ultraplan session
    sessionResult = await launchUltraplanSession(rawPrompt, appContext)   // $k6
    if sessionResult.error:
        emit("tengu_ultraplan_create_failed")
        return error(sessionResult.reason)

    // 8. Set appState to track session
    setAppState(...)

    // 9. Begin polling loop
    await pollAndPresentPlan(sessionResult.sessionId, appContext)          // W_6 / E45
```

Analysis basis: CC v2.1.159 bundle.js:+11941358, +11941376, +11941411, +11941486, +11941693, +11941724, +11941810, +11941848, +11941882, +11941911

---

### Prompt Normalization (`zT8`)

```
function normalizePromptText(rawArgs):
    // Strip leading/trailing whitespace from command args
    stripped = rawArgs.slice(...)                  // H.slice at +9685886
    // Replace formatting artifacts using pattern "$1$2" substitution
    cleaned = stripped.replace("$1$2", ...)        // A.replace at +9685957
    // Truncate to max length of 5 characters? No — the literal 5 at +9686006
    // is used as a match group index, not a length cap
    return cleaned
```

Analysis basis: CC v2.1.159 bundle.js:+11941358, +9685886, +9685957, +9686006

Internal helper `OT8` calls `Cd_` which applies a global case-insensitive (`"gi"` flag at +9685305) regex `matchAll` scan to detect the string `"ultraplan"` (+9685657) in the prompt text. The match result drives the keyword-presence check.

---

### Remote Eligibility Check (`I9`)

```
async function remoteEligibilityCheck(appContext):

    // 1. Verify user login (Claude.ai account, not API key)
    loginStatus = checkLoginStatus(appContext)          // rR at +4108728
    if not loginStatus.isLoggedIn:
        return blocked("not_logged_in",
            "Please run /login and sign in with your Claude.ai account (not Console).")
                                                       // literal at +8940750

    // 2. Verify git repository present
    repoStatus = checkGitRepo(appContext)               // Ww6 at +4108837
    if not repoStatus.inRepo:
        return blocked("not_in_git_repo")

    // 3. Verify GitHub remote configured
    remoteUrl = getGitRemoteUrl()                      // qR → git config --get remote.origin.url
    if not remoteUrl:
        return blocked("no_git_remote",
            "Background tasks require a GitHub remote. Add one with `git remote add origin REPO_URL`.")

    // 4. Check plan type inclusion (firstParty / enterprise / team)
    planType = getPlanType(appContext)                 // rR at +4108190
    if planType == "firstParty" or "enterprise" or "team":
        pass  // allowed

    // 5. Verify GitHub App installed
    appInstalled = checkGithubAppInstalled(appContext) // jhH at +11923562
    if not appInstalled:
        return blocked("github_app_not_installed")

    // 6. Check allow_product_feedback setting
    feedbackAllowed = getSetting("allow_product_feedback") // literal at +4108746

    // 7. Check allow_remote_sessions policy (double-check)
    if policyBlocked:
        return blocked("policy_blocked",
            "Remote sessions are disabled by your organization's policy. Contact your organization admin to enable them.")

    return eligible()
```

Analysis basis: CC v2.1.159 bundle.js:+4108699, +4108715, +4108728, +4108772, +4108837, +4108895, +8940728, +8940829, +8940967, +8941084, +8941238

---

### Session Launch and Remote Teleport (`$k6` → `E45` → `Vl`)

```
async function launchUltraplanSession(prompt, appContext):

    // 1. Generate draft plan text locally using remoteAgentPlanning
    draftPlan = await generateDraftPlan(prompt)       // yXH → E41
    // Prefixed with "Here is a draft plan to refine:"  (literal at +11934603)
    planPayload = "Here is a draft plan to refine:\n" + draftPlan

    // 2. Set task-notification context
    notificationContext = "task-notification"          // literal at +11939638

    // 3. Initiate teleport session (teleportToRemote)
    teleportResult = await teleportToRemote({          // Vl at +11939726
        prompt: planPayload,
        source: resolveSourceBundle(),                 // ZB_ — git bundle upload
        environment: resolveEnvironment(),             // ea / weH
        title: generateTaskTitle(),                    // sTL — "claude/task" schema
        permissionMode: "set_permission_mode"
    })

    if teleportResult == null:
        emit("tengu_ultraplan_create_failed")
        return error("teleport_null", "See --debug for details.")

    if teleportResult.type == "precondition":
        return error("precondition", teleportResult.detail)

    // 4. Register session in appState
    sessionRecord = buildSessionRecord(teleportResult)
    registerPollHandle(sessionRecord)                 // Ng1 at +11941810

    // 5. Emit launch telemetry
    emit("tengu_ultraplan_launched")                  // at +11940328

    return sessionRecord
```

Analysis basis: CC v2.1.159 bundle.js:+11938621, +11938656, +11938731, +11938810, +11938913, +11939026, +11939080, +11939140, +11939247, +11939381, +11939462, +11939569, +11939638, +11939693, +11939726, +11940017, +11940035, +11940195, +11940318, +11940328

---

### Remote Session Polling Loop (`W45` / `Pg1`)

The polling loop monitors the remote session status, surfacing plan-ready state and terminal states to the user.

```
async function pollRemoteSession(sessionId, appContext):

    emit("tengu_ultraplan_timeout_seconds")           // at +11934262
    // Timeout ceiling: 5400 seconds (literal at +11934296)
    // Poll interval: 60000 ms / 1 minute increments (literal at +11926442)

    loop:
        status = await fetchSessionStatus(sessionId)  // Hk — task polling

        switch status.state:

            case "plan_ready":
                emit("tengu_ultraplan_plan_ready")    // at +11934974
                presentPlanForApproval(status.plan)   // P45 — builds plan display
                // Plan display prefixed: "Here is a draft plan to refine:"
                break

            case "needs_input":
            case "requires_action":
                emit("tengu_ultraplan_awaiting_input") // at +11934906
                forwardInputRequestToUser(status)
                break

            case "approved":
                emit("tengu_ultraplan_approved")      // at +11935382
                // "Results will land as a pull request when the remote session finishes."
                //  (literal at +11935868)
                notifyUser("Results will land as a pull request when the remote session finishes. There is nothing to do here.")
                break

            case "completed":
                // Normal completion — surface result
                break

            case "terminated":
            case "failed":
                emit("tengu_ultraplan_failed")        // at +11936255
                notifyAgent("Remote Ultraplan session failed. Wait for the user's next instructions.")
                //  (literal at +11936662)
                break

            case "timeout_pending":
            case "timeout_no_plan":
                handleTimeout(status)
                break

            case "unexpected_error":
                emit("tengu_ultraplan_failed")
                notifyAgent("Ultraplan hit an unexpected error during launch. Wait for the user's next instructions.")
                //  (literal at +11940895)
                break

        if isTerminalState(status.state):
            archiveOrphanedSession(sessionId)         // see literal at +11941043
            break

    // Connection loss handling:
    // "Lost connection to the remote session after repeated retries — the session may still be running"
    //  (literal at +11925620)
```

Analysis basis: CC v2.1.159 bundle.js:+11934262, +11934296, +11934596, +11934656, +11934686, +11934730, +11934740, +11934826, +11925122, +11925267, +11925486, +11925546, +11925620, +11925777, +11925880, +11925934, +11926006, +11926260, +11926312, +11926327, +11926442, +11926665, +11926683

---

### Teleport: Source Bundle Resolution (`ZB_`)

Before creating the remote session, the implementation determines what code source to upload.

```
function resolveSourceBundle(repoContext):

    emit("tengu_teleport_bundle_mode")                // at +8870375

    if explicitSourceUrlProvided:
        mode = "explicit_source_url"                  // literal at +8873783
    elif not inGitRepo:
        mode = "no_git_at_all"                        // literal at +8873805
        log("[teleportToRemote] No repository detected — session will have an empty sandbox.")
    else:
        mode = determineBundleMode()
        // Modes: "bundle", "explicit_env_bundle", "git_repository"
        //  (literals at +8870340, +8870472, +8870524)

    if mode involves git bundle:
        result = uploadGitBundle()                    // ZB_ — teleport_git_bundle_upload
        emit("tengu_ccr_bundle_upload")               // at +8855027
        // Handles: empty_repo, stash, head, fallback_head, squashed, fallback_squashed
        // Git refs used: refs/seed/stash (+8854835), refs/seed/root (+8854853)
        // Bundle filename: "ccr-seed.bundle" / "_source_seed.bundle"
        //  (literals at +8856022/+8856033, +8856325)

    emit("tengu_teleport_source_decision")            // at +8875507
    return sourceDescriptor
```

Analysis basis: CC v2.1.159 bundle.js:+8854705, +8854731, +8854734, +8854763, +8854795, +8854835, +8854853, +8855027, +8855219, +8856022, +8856325, +8870340, +8870375, +8870472, +8870524, +8873783, +8873805, +8875507

---

### Environment Resolution (`ea` / `weH`)

```
async function resolveEnvironment(appContext):

    // List available teleport environments
    envList = await listEnvironments()                // "teleport_environments_list" at +8822688
    // Requires Claude.ai account auth:
    // "Claude Code web sessions require authentication with a Claude.ai account..."
    //  (literal at +8822772)

    if envList is empty or null:
        // Auto-create default cloud environment
        newEnv = await createDefaultCloudEnvironment()  // weH — "teleport_default_environment_create"
        // Default env spec: anthropic_cloud, /home/user, python 3.11, node 20
        //  (literals at +8823783, +8823889, +8823951, +8823968, +8823982, +8823997)
        if creation fails:
            warn("Could not create a cloud environment. Set one up at https://claude.ai/code/onboarding?magic=env-setup")
            //  (literal at +8872066)
            return null

    // Select environment (prefer bridge type if available)
    selectedEnv = selectBestEnvironment(envList)      // bridge literal at +8873048

    if no environments available:
        return error("No environments available for session creation")
        //  (literal at +8873086)

    return selectedEnv
```

API headers used for session creation:
- `anthropic-version: 2023-06-01` (+3153135)
- `anthropic-beta: ccr-byoc-2025-07-29` (+8869971)
- `x-organization-uuid` (+8869993)

Analysis basis: CC v2.1.159 bundle.js:+8822685, +8822688, +8822772, +8823485, +8823488, +8823783, +8869214, +8869322, +8869463, +8869632, +8872066, +8873048, +8873086, +8869954, +8869971, +8869993

---

### GitHub App Preflight Check (`jhH`)

```
async function checkGithubAppInstalled(appContext):

    accessToken = getAccessToken()
    if not accessToken:
        log("checkGithubAppInstalled: No access token found, assuming app not installed")
        //  (literal at +8824782)
        return false

    orgUuid = getOrgUuid()
    if not orgUuid:
        log("checkGithubAppInstalled: No org UUID found, assuming app not installed")
        //  (literal at +8824895)
        return false

    // HTTP GET to GitHub App check endpoint
    response = await httpGet(buildGithubAppCheckUrl())
    // Handles HTTP 400 as a distinct failure
    // Logs "is" / "is not" installed  (literals at +8825293, +8825298)

    emit("tengu_ccr_session_link" or preflight status)
    // Result tags: "github_preflight_ok", "github_preflight_failed",
    //              "ghes_optimistic", "forced_bundle", "no_github_remote"
    //  (literals at +8874122, +8874144, +8874182, +8874212, +8874240)
    return installStatus
```

Analysis basis: CC v2.1.159 bundle.js:+8824749, +8824782, +8824895, +8825293, +8825298, +8825553, +8874122, +8874144, +8874182, +8874212, +8874240

---

### Task Title Generation (`sTL`)

```
function generateTaskTitle(prompt):

    // Truncate prompt to 75 characters for title  (literal at +8858022)
    truncated = prompt.substring(0, 75)
    // Replace {description} placeholder in title template
    titleTemplate = "claude/task"                    // literal at +8858028
    filledTitle = titleTemplate.replace("{description}", truncated)

    // Schema: json_schema with fields "title" and "branch"
    //  (literals at +8858148, +8858252, +8858260)
    // Emit: "teleport_generate_title"                (literal at +8858326)
    // Response type: "text"                          (literal at +8858462)

    return titleObject
```

Analysis basis: CC v2.1.159 bundle.js:+8858017, +8858022, +8858028, +8858052, +8858064, +8858148, +8858252, +8858260, +8858326, +8858462

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — ultraplan-specific | `tengu_ultraplan_create_failed` (+11938658), `tengu_ultraplan_prompt_identifier` (+11934429), `tengu_ultraplan_launched` (+11940328), `tengu_ultraplan_timeout_seconds` (+11934262), `tengu_ultraplan_awaiting_input` (+11934906), `tengu_ultraplan_plan_ready` (+11934974), `tengu_ultraplan_approved` (+11935382), `tengu_ultraplan_failed` (+11936255) |
| Telemetry — CCR / teleport | `tengu_ccr_bundle_seed_enabled` (+8939279), `tengu_ccr_bundle_upload` (+8855027), `tengu_teleport_bundle_mode` (+8870375), `tengu_ccr_session_link` (+8864782), `tengu_teleport_source_decision` (+8875507) |
| Telemetry — background daemon | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_low_mem_mb`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_sendclaim_failed`, `tengu_bg_spare_claim`, `tengu_bg_spare_spawn`, `tengu_bg_spare_claim_fail` |
| Telemetry — misc | `tengu_config_parse_error`, `tengu_feature_bad`, `tengu_feature_ok` |
| appState reads | `_.getAppState("allow_remote_sessions")` (+11941693), `_.getAppState(...)` (login, config) |
| appState writes | `_.setAppState(...)` (+11941911) — session record, polling state |
| Duplicate-launch guard | String flags `"already_polling"` (+11938873) and `"already_launching"` (+11938891) prevent concurrent invocations |
| Git side effects | Creates git stash, uploads bundle to remote; uses `refs/seed/stash` and `refs/seed/root`; deletes temp bundle file via `WeH.unlink` (+8856958) |
| File system | Reads config via `readFileSync`, creates/deletes temp bundle files (`ccr-seed.bundle`, `_source_seed.bundle`), accesses backup directory |
| Network | POSTs to Anthropic API with `anthropic-beta: ccr-byoc-2025-07-29`; GETs to list/create environments; polls remote session status |
| Timeout | Remote session polling timeout: 5400 seconds (+11934296); poll granularity: 60000 ms / minute (+11926442) |
| Session max runtime | Remote agent session limit: 1 800 000 ms (30 minutes) (+8947326); exceeding this emits `"remote session exceeded 30 minutes"` (+8949968) |
| Permission mode sent to remote | `"set_permission_mode"` control request (+8868842) |
| Hook registration | File-watcher hooks registered via `l17` (`J_8.watchFile` / `J_8.unwatchFile` at +3207386/+3207719) for config monitoring |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.159 | Initial analysis |

---

## Common Mistakes

1. **Using an API key instead of a Claude.ai account login.** The command explicitly rejects API-key-only sessions with the message referencing `/login`; the user must authenticate via `claude.ai` (Analysis basis: CC v2.1.159 bundle.js:+8822772, +8940750).
2. **Running outside a git repository.** The `not_in_git_repo` guard fires before any remote work is attempted; the working directory must be a git repo (Analysis basis: CC v2.1.159 bundle.js:+8940829).
3. **No GitHub remote configured.** Even if a git repo exists, absence of `remote.origin.url` returns `no_git_remote` and instructs the user to add one with `git remote add origin REPO_URL` (Analysis basis: CC v2.1.159 bundle.js:+8940989).
4. **GitHub App not installed for the organisation.** The command checks app installation and blocks with `github_app_not_installed`; setup must be completed at `claude.ai/code` first (Analysis basis: CC v2.1.159 bundle.js:+8941084, +8874144).
5. **Invoking the command twice in rapid succession.** The `"already_launching"` guard prints a warning and returns immediately; a second invocation before the first session starts is silently deduplicated or warned (Analysis basis: CC v2.1.159 bundle.js:+11937485, +11938873, +11938891).
6. **Expecting immediate output.** The remote session can run up to 5400 seconds (90 minutes) before timing out; the PR result is asynchronous and the local terminal does not block (Analysis basis: CC v2.1.159 bundle.js:+11934296, +11935868).
7. **Organisation policy blocking remote sessions.** If an admin has disabled remote sessions, the `policy_blocked` error is returned immediately and cannot be bypassed from the CLI (Analysis basis: CC v2.1.159 bundle.js:+8941261, +11941379).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `V45` | Primary async handler for `/ultraplan` (Arbor-resolved entry point) |
| `zT8` | Prompt text normalizer — slices and replaces raw command args |
| `OT8` | Intermediate prompt processing helper called by normalizer |
| `Cd_` | Keyword detection — runs `matchAll` with `gi` flag for `"ultraplan"` string |
| `I9` | Remote eligibility pre-check orchestrator |
| `A_9` | Sub-check helper within eligibility chain |
| `Ww6` | Git repository presence verifier |
| `rR` | Plan-type / login status resolver (firstParty, enterprise, team) |
| `Pw6` | Config file reader (readFileSync, utf-8) |
| `F4H` | Feature-flag / inclusion check helper |
| `L1` | Telemetry level resolver |
| `JVA` | Telemetry formatter |
| `CH` | String coercion / conversion utility |
| `pKH` | Secondary string/telemetry helper |
| `j5H` | App-state accessor used during eligibility |
| `$k6` | Session launch orchestrator — ties together plan generation + teleport |
| `d` | General async/deferred helper |
| `L` | Promise tracking (add / finally / delete) |
| `Ng1` | Session poll-handle registrar |
| `mI8` | Intermediate session bootstrap helper |
| `uI8` | Remote session record builder |
| `G6` | Background session state accessor (PU map, HY6 set) |
| `j45` | Secondary session record field builder |
| `E45` | Full session execution orchestrator — plan gen + poll + UI |
| `yXH` | Entry into remote agent planning sub-graph |
| `E41` | Remote agent planning engine (Promise.all, tool calls) |
| `P45` | Plan text assembler (push + join) |
| `X45` | Plan chunk formatter |
| `Vl` | `teleportToRemote` — creates the remote cloud session |
| `R6` | Environment/runtime resolver utility |
| `yO` | OAuth/auth token helper |
| `IB_` | Org-UUID / bearer-token injector |
| `SH` | HTTP response / error surface helper |
| `qx` | Header builder for Anthropic API calls |
| `kq` | Endpoint URL builder (local / staging / prod) |
| `VX` | HTTP client config builder (Content-Type, anthropic-version) |
| `ZB_` | Git bundle upload handler (`teleport_git_bundle_upload`) |
| `I6` | Node.js internal utility wrapper (`_N`) |
| `N` | Message/text formatter (trim, toUpperCase, includes) |
| `qR` | Git remote URL fetcher (`git config --get remote.origin.url`) |
| `QK1` | Control-request builder (set_permission_mode, randomUUID) |
| `RH` | JSON serialiser wrapper |
| `gK1` | Session link helper |
| `ea` | Environment list fetcher (`teleport_environments_list`) |
| `weH` | Default cloud environment creator (`teleport_default_environment_create`) |
| `EH` | String coercion utility (String constructor wrapper) |
| `sTL` | Task title generator (`teleport_generate_title`, schema: `claude/task`) |
| `my` | Background session state mutator (AY6, qY6, HY6) |
| `jhH` | GitHub App installation checker |
| `JN` | Default branch resolver (`symbolic-ref --short refs/remotes/origin/HEAD`) |
| `O9` | OAuth / session auth helper |
| `c` | MCP tool-name inclusion checker |
| `Je` | Git remote URL parser (https / http schemes) |
| `F_` | Error factory utility |
| `aj` | Cancellation detector helper |
| `kz` | Error classification utility |
| `jw` | Claude.ai base-URL resolver (local / staging / prod) |
| `G_` | Module bootstrap / environment initialiser |
| `RG_` | URL variant selector (nj6 / Vv7) |
| `T45` | Boolean flag evaluator during session launch |
| `IhH` | Remote agent lifecycle manager (BI, feH, Z2, I41) |
| `BI` | Random bytes / session ID generator |
| `feH` | File-descriptor opener for agent pipe |
| `Z2` | Timestamp snapshot utility (Date.now) |
| `SZL` | Status string formatter |
| `I41` | Remote session event-stream processor (hook_progress, hook_response, SessionStart) |
| `Hk` | Task polling coordinator (QSL, FSL, dSL, cSL, VAH) |
| `QSL` | Poll start handler (task_started event) |
| `FSL` | Poll update handler (task_updated event) |
| `Id_` | Poll state-machine driver |
| `dSL` | Poll completion handler (local_workflow) |
| `cSL` | Poll object-key iterator |
| `VAH` | Poll state classifier (user_typed, active, aborted) |
| `W45` | Session run loop (Hk + Pg1 + D45 + Z45) |
| `Pg1` | Long-poll fetch loop with retry / timeout logic |
| `D45` | Session state dispatcher |
| `Z45` | Session record updater |
| `pZ6` | Session cleanup (unlink temp files) |
| `K` | Column/padding formatter (padEnd) |
| `$m` | Remote session POST / update sender |
| `K9` | Signal/hook registrar (`zOA.register`) |
| `G45` | Orphaned session archiver |
| `h6` | Config loader / file-system state accessor |
| `g6` | Config directory path resolver |
| `fY_` | Config file path builder |
| `tzH` | Config read-and-parse implementation (readFileSync + JSON parse) |
| `U6` | JSON parse wrapper |
| `nb` | Config key prefix stripper (startsWith / slice) |
| `w8` | Config validation helper |
| `UFq` | Config directory scanner (readdirStringSync) |
| `DY_` | Backup path joiner |
| `$` | Set-membership helper (Xs1) |
| `w` | Background worker / subprocess manager (spawn, kill, SIGKILL) |
| `S` | Subprocess supervisor (write, SH, DF5) |
| `bH` | Failure-state recorder (`tengu_feature_bad`) |
| `hH` | Success-state recorder (`tengu_feature_ok`) |
| `Fy8` | macOS memory probe (freemem, 1024 MB threshold) |
| `Yw6` | Worker config file reader (readFile async) |
| `B` | MCP session roster filter (VH.filter, dH.has) |
| `ZfA` | IPC channel connector (cF.claim, Tx8.connect) |
| `yfA` | Worker lifecycle tracker (add/delete, lY.rm/unlink, rosterEntry) |
| `D` | Worker disposal handler (G6, dispose, Date.now) |
| `R` | Worker resource disposer |
| `l17` | Config file watcher (watchFile / unwatchFile) |
| `kr` | File-watch callback |
| `W_6` | Post-launch parallel promise coordinator (Promise.all + qR + my + N4 + jhH) |