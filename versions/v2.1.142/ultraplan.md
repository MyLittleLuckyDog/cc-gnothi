---
type: feature-spec
feature: "ultraplan"
cc_version: "2.1.142"
updated: "2026-06-01"
tags: ["ultraplan", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.142 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultraplan`

> Analysis basis: CC v2.1.142 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.142

---

## Overview

`/ultraplan` launches a remote Claude Code web session that drafts a structured plan for the user's prompt. The plan is editable and must be approved before the remote agent proceeds; once approved, results are delivered as a pull request. The command performs a multi-step eligibility check (login, git repo, GitHub remote, GitHub App installation, and organization policy) before initiating the remote session.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultraplan` |
| description | `… Claude Code on the web drafts a plan you can edit and approve. See …` |
| argumentHint | `<prompt>` |
| load_inline | `true` |
| load_ident | `vE7` |
| loc_byte | `11217153` |
| loc_byte_end | `11217396` |
| loc_line | `6755` |
| arbor_handler.name | `vE7` |
| arbor_handler.fqn | `claude-2.1.142::vE7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `load_ident` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.142 bundle.js:+11217153

The handler is inlined as `load:()=>Promise.resolve({call: vE7})`. The Arbor symbol graph resolved the handler via the `load_ident` path with exactly one hit.

---

## Input Branching

The command has five or more distinct guard branches before reaching the session-launch path, making a flowchart the appropriate representation.

```mermaid
flowchart TD
    A(["/ultraplan <prompt>"]) --> B{allow_remote_sessions\nsetting enabled?}
    B -- No --> B1["Error: policy_blocked\n'Remote sessions are disabled\nby your organization's policy.'"]
    B -- Yes --> C{User logged in\nwith Claude.ai account?}
    C -- No --> C1["Error: not_logged_in\n'Please run /login and sign in\nwith your Claude.ai account.'"]
    C -- Yes --> D{Inside a git repo?}
    D -- No --> D1["Error: not_in_git_repo"]
    D -- Yes --> E{GitHub remote\nconfigured?}
    E -- No --> E1["Error: no_git_remote\n'Background tasks require a GitHub remote.\nAdd one with git remote add ...'"]
    E -- Yes --> F{GitHub App\ninstalled?}
    F -- No --> F1["Error: github_app_not_installed\n'. Please setup GitHub on\nhttps://claude.ai/code'"]
    F -- Yes --> G{already_polling\nor already_launching?}
    G -- already_launching --> G1["Error: 'ultraplan: already launching.\nPlease wait for the session to start.'"]
    G -- No --> H{Prompt contains\n'ultraplan' keyword\nor /ultraplan prefix?}
    H -- Neither --> H1["Usage hint:\n'Usage: /ultraplan <prompt>,\nor include \"ultraplan\" anywhere\nin your prompt'"]
    H -- Valid --> I[Normalize prompt text\njj8 / Jj8 / KJq]
    I --> J[Check remote eligibility\nYz1 / bg_remote_eligibility_check]
    J --> K[Upload git bundle seed\nIT_ / teleport_git_bundle_upload]
    K --> L[Create/select cloud environment\ncn / qdH]
    L --> M[Create remote session\naqH / o8.post]
    M --> N{Session created\nsuccessfully? HTTP 201?}
    N -- No 401/403/429/500 --> N1["Error reported;\ntengu_ultraplan_create_failed"]
    N -- Yes --> O[Launch UlH polling loop\nVh1 / HJq]
    O --> P{Session status?}
    P -- plan_ready --> Q["Draft plan delivered locally\n'Here is a draft plan to refine:'\ntengu_ultraplan_plan_ready"]
    Q --> R{User approves plan?}
    R -- Yes --> S["Remote agent resumes\n'Results will land as a pull request'\ntengu_ultraplan_approved"]
    R -- Refine local --> T["Local plan refinement\n'Refine local plan'\nGE7 builds refined prompt"]
    P -- needs_input --> U["Prompt user for input\ntengu_ultraplan_awaiting_input"]
    P -- terminated/failed --> V["Error message\ntengu_ultraplan_failed"]
    P -- timeout_pending\nor timeout_no_plan --> W["Timeout reported\ntengu_ultraplan_timeout_seconds"]
    P -- approved/remote --> S
```

Analysis basis: CC v2.1.142 bundle.js:+11215307 (entry `vE7`), +11212821 (`already_polling`), +11212839 (`already_launching`), +11212885 (usage hint), +11215328 (`allow_remote_sessions`)

---

## Behavioral Spec

### 1. Entry Point and Settings Gate (`vE7`)

```
async function ultraplanHandler(context):
    appState = context.getAppState()                         // +11215631
    if appState.setting("allow_remote_sessions") == false:   // +11215328
        emit error("policy_blocked", POLICY_BLOCKED_MESSAGE) // +11215749
        return

    triggerSource = "slash"                                  // +11215453
    call checkRemoteEligibility(context)                     // +11215325 (Sq)
    call normalizePromptText(context.prompt)                 // +11215307 (jj8)
    call initCNH(context)                                    // +11215435 (CNH)
    call waitForCompletion(context)                          // +11215820 (WaH)
    context.setAppState(...)                                 // +11215849
```

Analysis basis: CC v2.1.142 bundle.js:+11215307

---

### 2. Prompt Normalization (`jj8` → `Jj8` → `KJq`)

```
function normalizePrompt(rawInput):
    // KJq: strip leading "ultraplan" token if present
    if rawInput.startsWith("ultraplan"):              // +11200519
        rawInput = rawInput.slice(...)               // +11201416 (jj8→H.slice)

    // Match all "ultraplan" occurrences (regex flags "gi") // +11200917
    matches = rawInput.matchAll(/ultraplan/gi)        // +11200925

    // Build cleaned prompt segments
    segments = []
    for match in matches:
        segments.push(...)                           // +11201197 (M.push)

    // Apply substitution pattern "$1$2"             // +11201513
    result = rawInput.replace(pattern, "$1$2")       // +11201487

    // Trim to max 5 leading tokens                  // +11201536
    return result.trimmed(5)
```

The string `"ultraplan"` is the canonical keyword searched for (literal at +11201269). The regex uses global+case-insensitive flags (`"gi"`, +11200917). The replacement substitution pattern `"$1$2"` (+11201513) splices the keyword out while preserving surrounding text. An upper bound of `5` tokens (+11201536) applies to some slicing operation; the string padding width of `40` (+14487564) is used by identifier `A` (case-fold utility).

Analysis basis: CC v2.1.142 bundle.js:+11201269, +11200917, +11201513

---

### 3. Remote Eligibility Check (`Sq` → `v9q` / `BR_` / `hp`)

```
function checkRemoteEligibility(context):
    // hp: check account tier
    tier = getTier()                                  // +9989889 (VA)
    if tier not in ["firstParty","enterprise","team"]:// +9989896, +9990182, +9990217
        fire telemetry("tengu_slate_kestrel")         // +9990096
        return ineligible

    // hp: check allow_product_feedback setting        // +9993458
    // V9q: read config file (utf-8)                  // +9992072
    // BR_: combine checks
    if not loggedIn:
        return error("not_logged_in",
            "Please run /login and sign in with your Claude.ai account (not Console).")
                                                      // +8005433

    if not inGitRepo:
        return error("not_in_git_repo")               // +8005512

    if not hasGitHubRemote:
        return error("no_git_remote",
            "Background tasks require a GitHub remote. Add one with `git remote add origin REPO_URL`.")
                                                      // +8005672

    if not githubAppInstalled:
        return error("github_app_not_installed",
            ". Please setup GitHub on https://claude.ai/code")
                                                      // +8000553

    if policyBlocked:
        return error("policy_blocked",
            "Remote sessions are disabled by your organization's policy. Contact your organization admin to enable them.")
                                                      // +8005944
```

GitHub App installation check (`qZH`) uses `o8.get` (+6599926) and `o8.isAxiosError` (+6600273). An HTTP 400 response (+6600327) is treated as "app not installed". Logs `"checkGithubAppInstalled: No access token found, assuming app not installed"` (+6599556) or `"checkGithubAppInstalled: No org UUID found, assuming app not installed"` (+6599669) as appropriate.

Analysis basis: CC v2.1.142 bundle.js:+9993411, +8005433, +8005512, +8005650, +8005767, +8005921

---

### 4. Duplicate Session Guard (`CNH`)

```
function launchGuard(state):
    if state == "already_polling":                    // +11212821
        // silent no-op or internal dedup
        return

    if state == "already_launching":                 // +11212839
        emit message("ultraplan: already launching. Please wait for the session to start.")
                                                      // +11211433
        return

    // Check usage string validity
    if not promptContainsUltraplanKeyword:
        emit usage("Usage: /ultraplan <prompt>, or include \"ultraplan\" anywhere in your prompt")
                                                      // +11212885
        return

    // Proceed to IE7 (full launch pipeline)
    call fullLaunchPipeline(context)                  // +11213088 (IE7)
```

Analysis basis: CC v2.1.142 bundle.js:+11212821, +11212839, +11211433, +11212885

---

### 5. Full Launch Pipeline (`IE7`)

```
async function fullLaunchPipeline(context):
    // 5a. bg_remote_eligibility_check (Yz1 / CVH)
    eligibilityResult = await checkBgRemoteEligibility()  // +11213330 (CVH→Yz1)
    // fires "bg_remote_eligibility_check" telemetry      // +6601649

    if eligibilityResult.error == "precondition":         // +11213410
        emit preconditionError(eligibilityResult.message)
        return

    // 5b. Queue task-notification event (Y5 / y3H / $TH) // +11213517
    enqueueTaskNotification(type="task-notification",     // +11213586
                            mode="later")                  // +4603439

    // 5c. Upload git bundle seed (IT_)                   // +7980664
    bundleResult = await uploadGitBundleSeed()
    // fires "tengu_ccr_bundle_upload"                    // +7980957
    // fires "tengu_teleport_bundle_mode"                 // +7996193
    // fires "tengu_teleport_source_decision"             // +8001211

    // 5d. Generate plan title / branch name (nB4)        // +7999434
    titleInfo = await generateTitle(
        model="claude/task",                              // +7983836
        maxTokens=75,                                     // +7983830
        schema={title: string, branch: string}            // +7984068
    )
    // fires "tengu_generate_title"                       // +7984134

    // 5e. Create/find cloud environment (cn / qdH)
    environment = await getOrCreateEnvironment()
    // Default env name "Default"                         // +6598237
    // fires "teleport_environments_list"                 // +6597462
    // fires "teleport_default_environment_create"        // +6598262
    // Default cloud env runtime: python 3.11, node 20   // +6598725/+6598742/+6598756/+6598771

    // 5f. Create remote session (aqH → o8.post)
    session = await createRemoteSession(
        headers={
            "anthropic-beta": "ccr-byoc-2025-07-29",     // +7995783
            "x-organization-uuid": orgUUID,               // +7995805
            "anthropic-version": "2023-06-01",            // +6593942
            "Content-Type": "application/json"            // +6593888
        }
    )
    // HTTP 201 = success                                 // +7997120
    // HTTP 401/403/429/500 = auth/rate/server error      // +7997181/+7997185/+7997189/+7997082
    // fires "tengu_ccr_session_link"                     // +7990591

    // 5g. Mark state "Ultraplan" + fire launched event
    setAppState({label: "Ultraplan"})                     // +11214433
    fire telemetry("tengu_ultraplan_launched")            // +11214277
    // trigger source is "cli" for local init             // +11214190

    // 5h. Start polling loop (UlH → Vh1 → HJq)
    await pollRemoteSession(session.id)                   // +11214375
```

The remote session creation uses a 10 000 ms timeout for HTTP calls (`o8.post` timeout, +8003012). The beta header `"ccr-byoc-2025-07-29"` (+7995783) gates BYOC-capable session creation. HTTP 409 (+8003213) from session-creation is handled with a 1 500 ms retry delay (+11214618).

Analysis basis: CC v2.1.142 bundle.js:+11213088, +11213330, +11213517, +11213641, +11213674, +11214277, +11214375

---

### 6. Remote Session Polling (`UlH` → `Vh1` → `HJq`)

```
async function pollRemoteSession(sessionId):
    startTime = Date.now()                              // +8010340
    maxDuration = 1 800 000 ms (30 minutes)             // +8011698
    pollInterval = 1 000 ms                             // +8011691
    timeout_seconds_threshold = 5400 s                 // +11208243
    minuteTimeout = 60 000 ms                          // +11199221

    session = openRemoteSession(
        randomBytes(8),                                 // +12159326 / +12159342
        type="remote_agent"                             // +8010103
    )
    session.state = "pending" → "running"               // +12159449, +8010211

    loop:
        status = await fetchSessionStatus()             // +8012332 (HF4.get)
        fire telemetry("tengu_ultraplan_timeout_seconds", elapsed) // +11208209

        switch status:
            case "plan_ready":                          // +11199091
                deliver plan locally with prefix
                "Here is a draft plan to refine:"       // +11208550
                fire "tengu_ultraplan_plan_ready"       // +11208921
                awaitUserApproval()

            case "needs_input":                         // +11199106
                fire "tengu_ultraplan_awaiting_input"   // +11208853
                awaitUserInput()

            case "approved" | "remote":                 // +11198713, +11198785
                emit "Results will land as a pull request when the remote session finishes. There is nothing to do here."
                                                        // +11209815
                fire "tengu_ultraplan_approved"         // +11209329

            case "terminated" | "failed":               // +11198900
                emit "Remote Ultraplan session failed. Wait for the user's next instructions."
                                                        // +11210609
                fire "tengu_ultraplan_failed"           // +11210202

            case "requires_action":                     // +11199039
                // deliver action request to local UI

            case "timeout_pending" | "timeout_no_plan": // +11199444, +11199462
                fire "tengu_ultraplan_timeout_seconds"
                emit timeout error

            case "archived" | "completed":              // +8012142, +8012217
                break loop

        if elapsed > maxDuration:
            emit "remote session exceeded 30 minutes"   // +8014261
            break

    // Cleanup: unlink temp files                       // +8012739 (plH.unlink)
```

Polling tracks hook progress events (`"hook_progress"`, `"hook_response"`, `"hook_started"`) as intermediate session events (+8012832, +8012861, +8013352). Session start is `"SessionStart"` (+8013442). The `b6` (JSON.parse) utility (+181522) parses streamed server-sent events. Network loss retries with error `"network_or_unknown"` (+11198325) and emits `"Lost connection to the remote session after repeated retries — the session may still be running"` (+11198399).

Analysis basis: CC v2.1.142 bundle.js:+8010340, +8011698, +8011691, +11208209, +11199091, +11199106, +11198713, +11209815, +11210609

---

### 7. Plan Refinement and Approval Path (`GE7` / `TE7` / `JQ`)

```
function buildRefinedPlanPrompt(draftPlan):
    // GE7: assemble "Here is a draft plan to refine:" prefix + plan body
    segments = []
    segments.push("Here is a draft plan to refine:")    // +11208550
    segments.push(planBody)                             // +11208543 (q.push)
    segments.push(WE7(jE7(...)))                        // +11208603 (WE7→jE7)
    return segments.join(delimiter)                     // +11208633

function approveAndDispatch(plan):
    // TE7: record start time, compute token usage
    startTime = Date.now()                              // +11208687
    kbpsRate = _k(metrics)                             // +11208677
    fire "tengu_ultraplan_prompt_identifier"            // +11208376

    // HJq: poll for approved status
    // JE7: dispatch via G6 (background session manager)
    // JQ: POST result to remote endpoint              // +11210720
    result = await postPlanApproval(
        sessionId,
        planContent,
        timeout=10000                                  // +8003012
    )
    if result.status == 409:                           // +8003213
        retry after 1500 ms                            // +11214618

    // Report PR outcome
    emit "Results will land as a pull request..."
```

The literal `"Refine local plan"` (+11213730) labels the local refinement action exposed to the user. The `"plan"` mode literal (+11213765) is the sub-mode tag for the refinement action. `"create_api_fail"` (+11213966) and `"teleport_null"` (+11213984) label specific failure reasons in the approval path, followed by `". See --debug for details."` (+11214066).

Analysis basis: CC v2.1.142 bundle.js:+11208550, +11208376, +11213730, +11213966

---

### 8. Git Bundle Seed Upload (`IT_`)

```
async function uploadGitBundleSeed(workDir):
    fire "tengu_ccr_bundle_upload"                     // +7980957

    if not isGitRepo(workDir):
        return error("not_in_git_repo",
                     "Not in a git repository")         // +7980725

    // Check for any refs
    if noRefs:
        return error("empty_repo",
                     "Repository has no commits yet")   // +7981071

    // Strategy selection: head / fallback_head / squashed / fallback_squashed
    // head: normal HEAD bundle
    // fallback_head: git stash create then bundle     // +7981157/+7981149
    // squashed: single-commit squash
    // fallback_squashed: squash+stash
    // Uses refs: "refs/seed/stash"                    // +7980765
    //            "refs/seed/root"                     // +7980783

    bundle = await createBundle(strategy, "ccr-seed.bundle") // +7981803/+7981814
    // temp file: "_source_seed.bundle"                // +7982106

    uploadResult = await uploadBundle(bundle)
    // HTTP 200 = success                             // +7981328
    if uploadResult.status == "failed":               // +7982208
        record "upload_failed"                        // +7982251

    cleanup: unlink temp bundle file                  // +7982739

    fire "tengu_teleport_bundle_mode" with mode in:
        ["bundle","explicit_env_bundle",
         "git_repository","too_large",
         "explicit_source_url","no_git_at_all"]       // +7996157/+7996293/+7996345/+7996119/+7999556/+7999578
```

Analysis basis: CC v2.1.142 bundle.js:+7980664, +7980725, +7981071, +7982251, +7996157

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_ultraplan_launched` | Fired after session successfully created (+11214277) |
| Telemetry: `tengu_ultraplan_create_failed` | Fired on session creation failure (+11212606) |
| Telemetry: `tengu_ultraplan_prompt_identifier` | Fired at prompt dispatch time (+11208376) |
| Telemetry: `tengu_ultraplan_plan_ready` | Fired when remote returns a reviewable plan (+11208921) |
| Telemetry: `tengu_ultraplan_awaiting_input` | Fired when remote session requires user input (+11208853) |
| Telemetry: `tengu_ultraplan_approved` | Fired when user approves the plan (+11209329) |
| Telemetry: `tengu_ultraplan_failed` | Fired on remote session failure/termination (+11210202) |
| Telemetry: `tengu_ultraplan_timeout_seconds` | Elapsed-time metric emitted each poll cycle (+11208209) |
| Telemetry: `tengu_slate_kestrel` | Fired during account tier eligibility check (+9990096) |
| Telemetry: `tengu_ccr_bundle_upload` | Fired during git bundle seed upload (+7980957) |
| Telemetry: `tengu_teleport_bundle_mode` | Bundle strategy decision (+7996193) |
| Telemetry: `tengu_teleport_source_decision` | Source selection decision (+8001211) |
| Telemetry: `tengu_ccr_session_link` | Fired when session link is obtained (+7990591) |
| Telemetry: `tengu_ccr_bundle_seed_enabled` | Bundle seed feature flag telemetry (+6602044) |
| Telemetry: `tengu_config_parse_error` | Fired if config read fails during eligibility (+3155139) |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Background worker SIGKILL escalation (+14462646) |
| Telemetry: `tengu_daemon_yield` | Daemon yields to foreground (+14480594) |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` | Feature flag check results (+954550, +954608) |
| Telemetry: `tengu_bg_low_mem_mb` / `tengu_bg_dispatch_low_mem` | Low memory guards (+11935230, +14463225) |
| Telemetry: `tengu_bg_spare_enable` / `tengu_bg_spare_claim` / `tengu_bg_spare_spawn` / `tengu_bg_spare_claim_fail` | Background spare worker lifecycle (+14463840, +14463961, +14462423, +14464224) |
| Telemetry: `tengu_bg_sendclaim_failed` | Background session claim failure (+14444612) |
| appState read | `getAppState()` called at entry (+11215631) |
| appState write | `setAppState(...)` called after session state update (+11215849) |
| appState `allow_remote_sessions` | Checked as boolean gate before any action (+11215328) |
| appState `system` field | Read during context construction (+11215400) |
| appState `skip` field | Read at end of flow (+11215967) |
| Hook registration | `task-notification` event queued via `Y5` / `$TH` (+11213517, +11213586) |
| Remote HTTP | `o8.post` used for session creation and plan approval (+7997026, +8003117) |
| Remote HTTP | `o8.get` used for environment listing and GitHub App check (+6597897, +6599926) |
| File system | Temp bundle file `_source_seed.bundle` created and unlinked (+7982106, +7982739) |
| File system | `plH.unlink` for poll-phase cleanup (+8012739 via `Vh1`) |
| File system | Config read via `readFileSync` utf-8 (+9992072) |
| Crypto | `ykq.randomBytes(8)` for session nonce (+12159326) |
| Crypto | `NT_.randomUUID()` for task ID (+7994617) |
| Background worker | Spawned via `HU.spawn` / `HU.claim` for git bundle upload (+14464283, +14444456) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.142 | Initial analysis; full remote plan-draft workflow with BYOC beta header `ccr-byoc-2025-07-29`, 30-minute session timeout, git bundle seed upload |

---

## Common Mistakes

1. **Running `/ultraplan` without a Claude.ai account login.** The command requires a first-party/enterprise/team tier session authenticated via `/login` with Claude.ai (not an API key). API-key-only users receive the error `"Claude Code web sessions require authentication with a Claude.ai account"` (+6597546).

2. **Running in a directory without a git repository or without a GitHub remote.** Both conditions are hard-blocked at the eligibility stage. You must have `git remote add origin <REPO_URL>` configured before invoking `/ultraplan`.

3. **Running `/ultraplan` without the GitHub App installed.** The command checks GitHub App installation status via the Anthropic API and blocks if not found. Set up at `https://claude.ai/code`.

4. **Repeating the command while a session is already launching.** If `already_launching` state is active, a second invocation shows the "already launching" message and takes no further action. Wait for the initial session to reach `running` or terminal state.

5. **Expecting immediate results.** The command launches an asynchronous remote session. Results arrive as a pull request after the remote agent completes; the local CLI merely polls for status. Closing the terminal does not abort the remote session.

6. **Providing a prompt that does not include the word "ultraplan" (via the slash command itself) and is not prefixed with `/ultraplan`.** The normalization logic requires the keyword to be present or the command to be invoked directly; otherwise the usage hint is displayed.

7. **Organization policy blocking remote sessions.** If your organization has disabled remote sessions, the `policy_blocked` error is returned immediately. Contact your organization admin to enable the `allow_remote_sessions` setting.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `vE7` | Main async handler for `/ultraplan` (entry point, `load_ident`) |
| `jj8` | Prompt text normalization — outer dispatcher |
| `Jj8` | Prompt normalization — intermediate layer |
| `KJq` | Prompt normalization — core regex/replace logic |
| `Sq` | Remote eligibility check orchestrator |
| `v9q` | Eligibility sub-check coordinator |
| `BR_` | Eligibility sub-check (combines `hp` + `V9q`) |
| `hp` | Account tier and settings eligibility check |
| `V9q` | Config file reader for eligibility |
| `$q` | Telemetry mode resolver |
| `NMA` | Network/telemetry allowlist check |
| `bH` | String conversion utility |
| `A0H` | Auth token / header builder |
| `VYH` | Shared context state object |
| `CNH` | Duplicate session guard and launch dispatcher |
| `DJq` | State flag accessor |
| `Wj8` | Pre-launch context setup |
| `Xj8` | Pre-launch context setup, inner |
| `G6` | Background session manager / dispatcher |
| `PE7` | Pre-launch helper |
| `IE7` | Full launch pipeline orchestrator |
| `CVH` | Background eligibility check wrapper |
| `Yz1` | `bg_remote_eligibility_check` implementation |
| `Y5` | Task notification enqueue |
| `y3H` | Task event emitter (Object.freeze + sd9.emit) |
| `$TH` | Queue-operation handler (`queue-operation`) |
| `GE7` | Draft plan prompt assembler |
| `WE7` | Plan prompt segment builder |
| `aqH` | Remote session creation (full teleport flow) |
| `h6` | Shared helper — context/state accessor |
| `DM` | Dependency module accessor |
| `ST_` | Access-token retrieval |
| `NH` | Error logging and push utility |
| `ON` | Organization UUID fetcher |
| `q9` | API environment/URL resolver (`local`/`staging`/`prod`) |
| `Oz` | HTTP client factory builder |
| `IT_` | Git bundle seed upload orchestrator |
| `V6` | Shared value accessor |
| `v` | Log-level / debug utility |
| `Ey` | Git remote URL resolver (`remote.origin.url`) |
| `Th1` | Remote task descriptor builder (randomUUID) |
| `RH` | JSON serializer wrapper |
| `kT_` | Session link helper |
| `cn` | Cloud environment list fetcher (`teleport_environments_list`) |
| `qdH` | Default cloud environment creator (`teleport_default_environment_create`) |
| `GH` | String coercion utility |
| `nB4` | Title/branch name generator (`teleport_generate_title`) |
| `sR` | Background session status reporter |
| `qZH` | GitHub App installation check |
| `hV` | Default branch resolver (`symbolic-ref`, `main`/`master`) |
| `h1` | Shared helper (Ga/n1/QJ composition) |
| `k_` | Error constructor utility |
| `Bd` | Cancel/abort detector |
| `ZY` | Shared accessor utility |
| `dY` | Remote base-URL selector (`localhost:4000`/`staging`/`prod`) |
| `s_` | Module initializer / export binder |
| `BM_` | Base URL builder |
| `ZE7` | Launch state transition helper |
| `UlH` | Remote session polling entry (`remote_agent`) |
| `Uh` | Random nonce generator (`randomBytes`) |
| `Q58` | Remote session opener (`vr.open`) |
| `LW` | Session timing tracker (`Date.now`) |
| `_F4` | Session metadata formatter |
| `Vh1` | Polling loop with event ingestion |
| `_k` | Metrics/rate tracker for prompt identifier telemetry |
| `$f4` | Metrics sub-component (`retain` mode) |
| `ff4` | Metrics sub-component (accumulator) |
| `lY_` | Metrics flush / decay |
| `Of4` | Metrics snapshot (Date.now based) |
| `zf4` | Metrics aggregator (Object.keys based) |
| `TE7` | Plan approval and dispatch orchestrator |
| `HJq` | Poll-for-approval loop with ingest |
| `JE7` | Approval dispatcher via G6 |
| `VE7` | Vote/approval sub-helper |
| `KJ6` | Temp file cleanup (gL.unlink) |
| `K` | Table padding formatter (padEnd) |
| `JQ` | Plan result POST to remote endpoint |
| `C9` | React-style state hook (`fI8.add/delete`) |
| `fKK` | Undefined-check guard |
| `EE7` | Post-launch cleanup helper |
| `y6` | Filesystem/config watcher orchestrator |
| `x6` | Config path resolver |
| `dA_` | Config directory accessor |
| `cMH` | Config file reader with backup/migration |
| `b6` | JSON.parse wrapper |
| `DR` | Config key prefix stripper |
| `O8` | Config schema validator |
| `bE9` | Config file locator (readdirStringSync) |
| `aA_` | Backup path builder (Qz.join) |
| `$` | Shared array/set utility |
| `w` | Background worker manager (spawn/kill/freemem) |
| `y` | Child process write wrapper |
| `uH` | Feature-ok telemetry emitter |
| `SH` | Feature-bad telemetry emitter |
| `LG6` | Low-memory background guard |
| `S` | Background session settlement helper |
| `xr_` | Background session connection handler (BT8.connect) |
| `Fr_` | Background worker lifecycle (done/killed/stopped/crashed) |
| `D` | Background worker disposal (G6 + dispose) |
| `u` | Background I/O writer (clearTimeout + $.write) |
| `XhL` | File watcher setup (vi6.watchFile/unwatchFile) |
| `wl` | Watch callback handler |
| `WaH` | Completion waiter (Promise.all over Ey/sR/SL/h6/bH/qZH) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.