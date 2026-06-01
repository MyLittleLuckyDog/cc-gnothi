---
type: feature-spec
feature: "ultrareview"
cc_version: "2.1.150"
updated: "2026-06-01"
tags: ["ultrareview", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: "2.1.149"
analysis_basis: "CC v2.1.149 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultrareview`

> Analysis basis: CC v2.1.149 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.149

---

## Overview

`/ultrareview` is a cloud-powered bug-finding command that runs Claude Code on Anthropic's web infrastructure (not locally). It packages your current git branch into a remote session, dispatches an asynchronous review agent, and streams findings back to the local CLI. The estimated run-time is ~10–20 minutes and costs approximately $10–$20 USD per invocation.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultrareview` |
| description | `"… · Est. cost … USD · Finds and verifies bugs in your branch. Runs in Claude Code on the web. See …"` |
| module_id | `dC1` |
| load_inline | `true` |
| loc_byte | `11852790` |
| loc_byte_end | `11853049` |
| loc_line | `9558` |
| arbor_handler.name | `dsL` |
| arbor_handler.fqn | `claude-2.1.149::dsL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.149 bundle.js:+11852790

---

## Input Branching

The command has more than three distinct branches (policy gate, repo-size gate, PR-number vs. local-bundle path, preflight outcome, user confirmation, session launch, and session-result routing), so a Mermaid flowchart is mandatory.

```mermaid
flowchart TD
    A(["/ultrareview [PR#]"]) --> B{allow_remote_sessions\npolicy set?}
    B -- "disabled by org" --> ERR1["Error: Remote sessions are\ndisabled by org policy"]
    B -- "allowed" --> C{Inside git repo?}
    C -- "no" --> ERR2["Error: not_in_git_repo"]
    C -- "yes" --> D{GitHub remote\npresent?}
    D -- "no" --> ERR3["Error: no_git_remote /\nBackground tasks require\na GitHub remote"]
    D -- "yes" --> E{Argument supplied?}
    E -- "PR number given" --> F[Use PR as review target]
    E -- "no argument" --> G{Repo size\n≤ 5 000 000 bytes?}
    G -- "too large" --> ERR4["Error: Repo is too large.\nPush a PR and use\n/ultrareview <PR#> instead"]
    G -- "within limit" --> H[Bundle local branch\n(git stash + git bundle)]
    F --> I[Preflight check\nPOST /v1/ultrareview/preflight]
    H --> I
    I --> J{Preflight result}
    J -- "essential-traffic-only" --> ERR5["Unavailable in\nessential-traffic-only mode"]
    J -- "zdr / data-residency" --> ERR6["Unavailable on\nthird-party providers"]
    J -- "no-auth" --> ERR7["Requires Claude.ai account\nRun /login"]
    J -- "blocked (server)" --> ERR8["Ultrareview unavailable\nfor your org"]
    J -- "request_failed" --> ERR9["request_failed"]
    J -- "needs-confirm" --> K{Cost confirmation\ndialog shown}
    K -- "user cancels" --> CANCEL["Ultrareview cancelled."]
    K -- "user confirms" --> L
    J -- "proceed" --> L[Launch remote session\n(teleportToRemote)]
    L --> M{Session launch OK?}
    M -- "failed" --> ERR10["Ultrareview failed to\nlaunch remote session"]
    M -- "launched" --> N[Poll session state\n(ZkH loop)]
    N --> O{Session terminal state}
    O -- "completed" --> P[Stream result messages\nto local chat]
    O -- "error / exceeded 30 min" --> ERR11["remote session returned\nan error / exceeded limit"]
    O -- "no review output" --> ERR12["no review output —\norchestrator may have\nexited early"]
```

Analysis basis: CC v2.1.149 bundle.js:+11850480 (handler entry `dsL`), +11850483 (`allow_remote_sessions` gate), +11814770 (repo-size error literal), +11812376 (preflight endpoint)

---

## Behavioral Spec

### 1. Policy and Authentication Gate

```
async function policyGate(appState):
    if not appState.settings["allow_remote_sessions"]:
        emit error "Remote sessions are disabled by your organization's policy."
        return BLOCKED

    if not hasOAuthToken(appState):
        emit error "Please run /login and sign in with your Claude.ai account."
        return BLOCKED

    return PASS
```

The check for `allow_remote_sessions` happens as the very first step of the handler.
Analysis basis: CC v2.1.149 bundle.js:+11850483, +11850517

---

### 2. Git Repository and Remote Validation

```
async function validateGitContext():
    // Confirm we are inside a work-tree
    runGit(["rev-parse", "--is-inside-work-tree"])
    if fails: return { error: "not_in_git_repo" }

    // Obtain remote URL from origin
    remoteUrl = runGit(["config", "--get", "remote.origin.url"])
    if not remoteUrl: return { error: "no_git_remote",
                               message: "Background tasks require a GitHub remote. Add one with `git remote add origin REPO_URL`." }

    // Sanitise credential tokens embedded in URL (replace ://TOKEN@ pattern)
    sanitisedUrl = remoteUrl.replace("://***@", ...)

    // Confirm remote is a github.com URL
    if "github.com" not in remoteUrl:
        return { error: "no_github_remote" }

    return { ok: true, remoteUrl: sanitisedUrl }
```

Analysis basis: CC v2.1.149 bundle.js:+8631815 (`rev-parse`), +1060356 (`remote.origin.url`), +1063307 (credential scrub), +11814378 (`github.com` check)

---

### 3. Target Resolution: PR Number vs. Local Bundle

```
function resolveTarget(argument):
    if argument is a positive integer:
        return { kind: "pr", prNumber: argument }

    // No argument — measure local repo footprint
    countResult = runGit(["count-objects", "-v"])
    sizeKB = parseSize(countResult)
    sizeBytes = sizeKB * 1024

    if sizeBytes > 5_000_000:
        emit error "Repo is too large to bundle. Push a PR and use `/ultrareview <PR#>` instead."
        telemetry("tengu_ccr_bundle_max_bytes", { size: sizeBytes, limit: 5000000 })
        return { error: "too_large" }

    return { kind: "bundle" }
```

Analysis basis: CC v2.1.149 bundle.js:+8664093 (`count-objects`), +8664534 (5 000 000 byte limit), +11814770 (error literal), +11814641 (`"pr"` literal)

---

### 4. Preflight Check

```
async function preflightCheck(remoteUrl, target, teleportOrg):
    response = httpPost("/v1/ultrareview/preflight", {
        remoteUrl,
        target,
        teleportOrg,          // "teleport-org" header
    }, timeout: 5000)

    status = response.status

    if status == "essential-traffic-only":
        return { blocked: "Ultrareview runs in Claude Code on the web and is unavailable when essential-traffic-only mode is active." }

    if status == "zdr" or status == "data-residency":
        return { blocked: "Ultrareview runs in Claude Code on the web and is unavailable on third-party providers." }

    if status == "no-auth":
        return { blocked: "Ultrareview requires a Claude.ai account. Run /login to authenticate." }

    if status == "blocked" (server decision):
        return { blocked: "Ultrareview is unavailable for your organization." }

    if status == "needs-confirm":
        return { needsConfirm: true, costRange: "$10-$20" }

    if status == "proceed":
        return { proceed: true }

    // Error cases
    telemetry("tengu_review_remote_precondition_failed", { reason: status })
    return { error: status }
```

Analysis basis: CC v2.1.149 bundle.js:+11812376 (`/v1/ultrareview/preflight`), +11812433 (timeout 5000 ms), +11812506, +11812653, +11812786, +11816450, +11816232 (`"proceed"`), +11816612 (`"needs-confirm"`)

---

### 5. Cost-Confirmation Dialog

When preflight returns `needs-confirm`, the handler renders a confirmation UI element showing the estimated cost range `"$10-$20"` and estimated duration `"~10–20 min"`. User must explicitly confirm before the session is launched.

```
async function costConfirmation():
    displayDialog({
        costRange: "$10-$20",
        duration:  "~10–20 min",
    })
    telemetry("tengu_review_overage_dialog_shown")
    result = await waitForUserResponse()

    if result == "confirm":
        return CONFIRMED
    else:
        emit "Ultrareview cancelled."
        return CANCELLED
```

Analysis basis: CC v2.1.149 bundle.js:+11811840 (`"$10-$20"`), +11811932 (`"~10–20 min"`), +11851424 (cancellation literal), +11816545 (`"confirm"`), telemetry event `tengu_review_overage_dialog_shown` at +11851119

---

### 6. Default Branch and Current Branch Detection

```
function detectDefaultBranch():
    // Try symbolic-ref for origin/HEAD
    result = runGit(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"])
    if ok: return result.strip()

    // Fall back to checking for well-known names
    for name in ["main", "master"]:
        if runGit(["show-ref", name]) succeeds:
            return name

    return "main"   // last resort

function detectCurrentBranch():
    result = runGit(["branch", "--abbrev-ref", "HEAD"])
    return result.strip()
```

Analysis basis: CC v2.1.149 bundle.js:+1069089 (`symbolic-ref`), +1069114 (`refs/remotes/origin/HEAD`), +1069227 (`"main"`), +1069234 (`"master"`), +1068917 (`--abbrev-ref`), +1068932 (`HEAD`)

---

### 7. Merge-Base and Diff Statistics

```
function computeMergeBaseDiff(currentBranch, defaultBranch):
    mergeBase = runGit(["merge-base", currentBranch, defaultBranch])
    diffStat  = runGit(["diff", "--shortstat", mergeBase])
    return diffStat
```

Analysis basis: CC v2.1.149 bundle.js:+11815301 (`"merge-base"`), +11815816 (`"diff"`), +11815823 (`"--shortstat"`)

---

### 8. Git Bundle Upload (local-bundle path)

```
async function uploadGitBundle(remoteUrl, accessToken, orgUUID):
    // 1. Stash any uncommitted changes
    stashRef = runGit(["stash", "create"])

    // 2. Create bundle file  (seed refs: refs/seed/stash, refs/seed/root)
    bundlePath = createTempFile("ccr-seed", ".bundle")
    runGit(["bundle", "create", bundlePath, ...refs])

    // 3. Upload via signed URL
    telemetry("tengu_ccr_bundle_upload", { result })
    uploadResult = uploadBundle(bundlePath, {
        headers: {
            "anthropic-beta":       "ccr-byoc-2025-07-29",
            "x-organization-uuid":  orgUUID,
        }
    })

    // 4. Clean up temp refs
    runGit(["update-ref", "-d", "refs/seed/stash"])
    runGit(["update-ref", "-d", "refs/seed/root"])
    unlink(bundlePath)

    return { sourceRef: uploadResult.head }
```

Analysis basis: CC v2.1.149 bundle.js:+8667092 (telemetry label `teleport_git_bundle_upload`), +8668380 (`"ccr-seed"`), +8668391 (`".bundle"`), +8667193, +8667211 (seed refs), +8682330 (`"ccr-byoc-2025-07-29"`), +8682352 (`x-organization-uuid`), telemetry `tengu_ccr_bundle_upload` at +8667385

---

### 9. Remote Session Launch (teleportToRemote)

```
async function teleportToRemote(params):
    // Obtain / auto-create a cloud environment
    envList = await listEnvironments()          // GET teleport_environments_list
    if envList is empty:
        env = await createDefaultEnvironment()  // POST teleport_default_environment_create
        telemetry("env_create")

    // Select environment (prefer "bridge", else first available)
    env = selectEnvironment(envList)

    // POST to create the remote session
    response = httpPost(sessionEndpoint, {
        task:        "ultrareview",
        bundleMode:  determineBundleMode(),     // "bundle" | "git_repository" | "explicit_env_bundle" | …
        sourceRef:   params.sourceRef,
        permissionMode: "set",
        headers: {
            "anthropic-beta":       "ccr-byoc-2025-07-29",
            "x-organization-uuid":  orgUUID,
        }
    })

    if response.status in [401, 403]:
        return { error: "github_repo_access_denied" }
    if response.status == 429:
        return { error: "rate_limited" }
    if response.status not in [200, 201]:
        return { error: "request_failed" }

    sessionId = response.data.id
    if not sessionId:
        throw Error("Server returned a malformed session response (no session id)")

    telemetry("tengu_teleport_bundle_mode", { mode: bundleMode })
    telemetry("tengu_teleport_source_decision")
    return { sessionId }
```

Analysis basis: CC v2.1.149 bundle.js:+8629868 (`teleport_environments_list`), +8630668 (`teleport_default_environment_create`), +8683664 (HTTP 201), +8683732 (401), +8683736 (403), +8683740 (429), +8684086 (no-session-id error), +8682740 (`tengu_teleport_bundle_mode`)

---

### 10. Session Polling Loop

```
async function pollSession(sessionId):
    POLL_INTERVAL_MS  = 1000
    MAX_DURATION_MS   = 1_800_000   // 30 minutes

    startTime = Date.now()

    while true:
        if Date.now() - startTime > MAX_DURATION_MS:
            return { error: "remote session exceeded 30 minutes" }

        session = await getSession(sessionId)

        switch session.status:
            case "pending":
            case "starting":
            case "running":
                await sleep(POLL_INTERVAL_MS)
                continue

            case "completed":
                resultText = extractResultText(session)
                if not resultText:
                    return { error: "no review output — orchestrator may have exited early" }
                return { ok: true, text: resultText }

            case "archived":
            case "error":
                return { error: "remote session returned an error" }
```

Analysis basis: CC v2.1.149 bundle.js:+8752458 (1000 ms), +8752465 (1 800 000 ms), +8752909 (`"archived"`), +8752984 (`"completed"`), +8755043, +8755084, +8755121 (terminal error literals)

---

### 11. Result Delivery

```
async function deliverResult(resultText):
    // Append result messages to the local conversation as assistant turn
    appendAssistantMessages(resultText)

    // Post-delivery instruction to the local model:
    // "The output above is already visible to the user. Briefly acknowledge
    //  it without repeating the target, URL, or billing note. Findings will
    //  arrive via task-notification."
    sendSystemInstruction(POST_DELIVERY_PROMPT)
```

Analysis basis: CC v2.1.149 bundle.js:+8752736 (`"assistant"` message role), +11850143 (post-delivery instruction literal, first 30 chars: `"The output above is already vi"`)

---

### 12. Background Eligibility Pre-check (IH1)

Before launching, the handler invokes a background eligibility check (`bg_remote_eligibility_check`) that independently verifies:

```
function backgroundEligibilityCheck():
    checks = []
    checks.add(verifyPolicyAllowed())         // "policy_blocked"
    checks.add(verifyLoggedIn())              // "not_logged_in"
    checks.add(verifyNotBYOC())               // "byoc"
    checks.add(verifyInsideGitRepo())         // "not_in_git_repo"
    checks.add(verifyGitRemote())             // "no_git_remote"
    checks.add(verifyGithubAppInstalled())    // "github_app_not_installed"

    results = await Promise.all(checks)
    telemetry("tengu_ccr_bundle_seed_enabled", { results })
    return results
```

Analysis basis: CC v2.1.149 bundle.js:+8744328 (`"policy_blocked"`), +8744350 (`"bg_remote_eligibility_check"`), +8744467, +8744653, +8744809, +8744902, +8744998, telemetry `tengu_ccr_bundle_seed_enabled` at +8744745

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_review_remote_precondition_failed` | Fired when preflight rejects the request (any blocking status). |
| Telemetry: `tengu_review_bughunter_config` | Fired when the bughunter config is read (`ZH6` path). |
| Telemetry: `tengu_review_overage_blocked` | Fired when an overage/cost block is hit before confirmation. |
| Telemetry: `tengu_review_overage_dialog_shown` | Fired when the cost-confirmation dialog is displayed. |
| Telemetry: `tengu_review_remote_teleport_failed` | Fired if the remote session launch throws. |
| Telemetry: `tengu_review_remote_launched` | Fired on successful session launch. |
| Telemetry: `tengu_ccr_bundle_upload` | Fired after each git-bundle upload attempt, with result status. |
| Telemetry: `tengu_teleport_bundle_mode` | Records which bundle mode was selected for the session. |
| Telemetry: `tengu_teleport_source_decision` | Records how the repository source was resolved. |
| Telemetry: `tengu_ccr_bundle_max_bytes` | Fired when the repository is too large to bundle locally. |
| Telemetry: `tengu_ccr_bundle_seed_enabled` | Background eligibility check results. |
| Telemetry: `tengu_ccr_session_link` | Records the cloud session URL emitted to the user. |
| Telemetry: `tengu_feature_ok / tengu_feature_bad / tengu_feature_sad` | Generic feature-health signals emitted by the feature-flag subsystem. |
| Telemetry: `tengu_bg_spare_enable / tengu_bg_spare_spawn` | Spare background-worker lifecycle events. |
| Telemetry: `tengu_daemon_control / tengu_daemon_config_reload` | Daemon lifecycle signals (supervisor layer). |
| appState changes | Sets `remoteControlAtStartup` in user settings; stores session reference via `$uH.set`. |
| HTTP side-effect | `POST /v1/ultrareview/preflight` and `POST <session endpoint>` with `anthropic-beta: ccr-byoc-2025-07-29`. |
| File system | Creates and subsequently deletes a temporary `*.bundle` file; reads `daemon.status.json`. |
| Git mutations | Temporarily creates `refs/seed/stash` and `refs/seed/root`; both are deleted after upload. |
| Daemon interaction | May stop the local daemon (`daemon_stop` / `daemon_stop_failed`) if needed to hand over control. |
| Sound | Not observed in traversal. |

---

## Version History

| Version | Change |
|---|---|
| v2.1.149 | Initial analysis |

---

## Common Mistakes

1. **Running without a GitHub remote.** `git remote add origin <REPO_URL>` must be configured before the command is invoked; the command explicitly checks for a `github.com` URL and aborts otherwise.
2. **Using an API key instead of OAuth.** The command requires a Claude.ai account session (`/login`). `ANTHROPIC_API_KEY`-only setups produce "Claude Code web sessions require authentication with a Claude.ai account" errors.
3. **Not supplying a PR number for large repositories.** Repositories exceeding 5 000 000 bytes of packed objects cannot be bundled locally; users must push a PR first and invoke `/ultrareview <PR#>`.
4. **Running in essential-traffic-only or data-residency (ZDR) mode.** The preflight endpoint will reject the request; the feature is unavailable in those network policies.
5. **Dismissing the cost dialog.** If the preflight returns `needs-confirm`, dismissing rather than confirming the ~$10–$20 dialog terminates the flow with "Ultrareview cancelled." — nothing is launched.
6. **Expecting instant results.** The remote agent takes approximately 10–20 minutes; the CLI polls at 1-second intervals up to the 30-minute hard limit.
7. **Missing GitHub App installation.** The background eligibility pre-check verifies `github_app_not_installed`; if the Claude GitHub App is not installed on the repository, the session creation will fail.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `dsL` | Main handler (`AsyncFunction`) for `/ultrareview` — Arbor-resolved entry point |
| `k1` | Checks `allow_remote_sessions` / `allow_product_feedback` policy; reads config flags |
| `p8q` | Policy-check helper invoked by `k1` |
| `_q8` | Inner config-resolution step |
| `cb` | Reads firstParty/enterprise/team tier from app state |
| `bJ_` | Reads file with `readFileSync` (UTF-8); delegates to `e98`, `Nq`, `IJ_` |
| `G1` | String-based flag formatter (calls `Z2A`) |
| `Z2A` | Normalises flag value via `mH` |
| `mH` | Core string-coercion helper (`String()`) |
| `X1H` | Additional string helper wrapping `mH` |
| `H` | Random-delay utility (`Math.random` + `setTimeout`); also used as general async helper |
| `br_` | Main review-orchestration function: resolves git context, dispatches preflight, launches session |
| `qj8` | Git-work-tree check (`rev-parse --is-inside-work-tree`) |
| `x6` | AsyncLocalStorage context accessor |
| `Mm6` | Store getter (`Lm6.getStore`) |
| `j_` | Debug/trace utility (`Dv`) |
| `G_` | Git command runner (core executor — `lWH` + `D`) |
| `lWH` | Low-level git spawn/stream handler |
| `D` | Process/memory monitor that wraps git child processes |
| `zaK` | Converts git output to string |
| `Dz` | Error-type classifier |
| `N` | Output normaliser / log formatter |
| `K8` | Git error handler |
| `RH` | Git result aggregator with error logging |
| `A` | Input/output stream helper (trim, toLowerCase) |
| `M` | Stream lifecycle manager (close, finally) |
| `c` | Core state/context accessor |
| `Uh` | Remote-URL resolver (`$uH` cache; calls `bC`, `G_`, `S9H`) |
| `bC` | Sub-resolver inside `Uh` (`ld8`) |
| `ld8` | Looks up `remoteUrl` in `h9H` store |
| `K` | Map-and-pad helper |
| `L` | Promise tracker (`q.add` / `q.delete`) |
| `OuH` | Credential scrubber (replaces `://***@` pattern) |
| `S9H` | URL-scheme parser (`https`/`http` detection; calls `tGA`, `Cq`) |
| `tGA` | Split/includes URL component helper |
| `Cq` | String slice utility (`indexOf` + `slice`) |
| `neq` | Repo-size checker (`count-objects -v`; emits `tengu_ccr_bundle_max_bytes`) |
| `leq` | Parses `count-objects` output as `Number`; calls `G_` |
| `ceq` | Validates size against 5 000 000 byte limit; calls `V6` |
| `V6` | Session registry accessor (`YOH`, `lg`, `e36`) |
| `E8` | Git environment-state helper (`G_` + `x6`) |
| `z` | Daemon stop orchestrator (`bH`, `uH`, `Rk`, `pu`) |
| `bH` | Feature-ok telemetry path |
| `uH` | Feature-bad telemetry path |
| `Rk` | Daemon-control event emitter (`aTH`, `UM_`) |
| `Gb` | OS detection helper |
| `aTH` | Wrapper for `Wb` (build daemon event payload) |
| `UM_` | Daemon-control dispatcher (`mM_.randomUUID`, `H.emit`) |
| `pu` | Shutdown sequencer (`Promise.race`/`all`, `process.exit`) |
| `cg` | Calls `T1H.shutdown` |
| `og` | Clears timeout and calls `jf_` |
| `r8` | Timed-abort helper (`setTimeout`, `clearTimeout`, `Error("aborted")`) |
| `kv` | Default-branch detector (`symbolic-ref --short refs/remotes/origin/HEAD`) |
| `nd8` | Looks up `defaultBranch` in `h9H` store |
| `VD` | Current-branch detector (`branch --abbrev-ref HEAD`) |
| `dd8` | Looks up `branch` in `h9H` store |
| `$` | HTTP client wrapper; reads `daemon.status.json`; calls `_Q1` |
| `_Q1` | HTTP request dispatcher (`Date.now`, `A1`, `$v6`, `CH`) |
| `Pn` | Request pre-processor (`vqH`) |
| `A1` | AsyncLocalStorage request store getter |
| `$v6` | Path joiner (`HQ1.join`, `i8`) |
| `CH` | JSON serialiser (`JSON.stringify`) |
| `xr_` | Preflight result handler; routes on `status` field (`VC1`, `thH`) |
| `VC1` | Preflight response parser (`ZC1`, `g6`, `_1.get`, `Rr_`, `N`, `_8`, `bH`) |
| `g6` | JSON parser (`JSON.parse`) |
| `Rr_` | Preflight field extractor |
| `_8` | Context accessor variant |
| `thH` | Builds `needs-confirm` / `blocked` response objects; calls `ZH6` |
| `ZH6` | Bughunter-config loader; emits `tengu_review_bughunter_config` |
| `aaH` | Overage / billing check (`mH`, `iT`, `LOH`) |
| `iT` | Billing-tier helper |
| `LOH` | Subscription-type router (`R5`, `EA`) |
| `R5` | Subscription record fetcher (`dD`, `m6`) |
| `dD` | Subscription data decoder (`K4`, `ev`, `yO`, `TA`, `hJ`, `e$`, `O1H`) |
| `m6` | Session/conversation record builder (`Q6`, `GG`, `Af_`, `JOH`, `Et4`) |
| `EA` | Subscription eligibility evaluator (`dD`, `oC`, `eA`) |
| `oC` | Array/include-check predicate |
| `rC` | User-role checker (`EA`, `O1`, `m6`) |
| `O1` | Role-validation helper (`MH_`, `LH_`, `dD`, `eA`) |
| `MH_` | Role matcher |
| `LH_` | Role fallback |
| `fa` | Confirmation dialog renderer; calls `ZH6` |
| `QsL` | JSX render function for the command UI (`ur_`, `A`, `gsL`) |
| `ur_` | Review launch orchestrator: eligibility, session create, polling, result delivery |
| `mjH` | Initialises eligibility check flow; calls `IH1` |
| `IH1` | Full background-eligibility checker (policy, login, BYOC, git, remote, GitHub App) |
| `G` | Key-press / input-event handler (`FW`, `Y`) |
| `b` | DOM/terminal event object |
| `FW` | User-settings accessor (`_A`) |
| `Y` | Supervisor config updater (`Z.stop/start/updateConfig`, `V.start`) |
| `m7H` | Message formatter for review output |
| `EC1` | Cost-summary JSX component; calls `ZH6` |
| `ed` | `teleportToRemote` — cloud session creation and git-bundle upload logic |
| `t$` | Token/auth helper (`wL_`) |
| `Xb_` | Permission-mode builder (`eA`, `mH`, `wn`) |
| `aC` | Error categoriser (`m6`, `eA`, `XZ`, `Yt`) |
| `h9` | OAuth endpoint validator (`jPA`, `InK`, `Fu6.includes`) |
| `oJ` | HTTP headers builder (`L2`) |
| `Yb_` | Git bundle upload handler (stash, pack, upload, cleanup) |
| `S6` | Debug logger (`Dv`) |
| `req` | Session event emitter (`control_request`, `set_permission_mode`, `randomUUID`) |
| `ieq` | Session-link telemetry emitter (`tengu_ccr_session_link`) |
| `Do` | Environment list fetcher (`teleport_environments_list`) |
| `GaH` | Default environment creator (`teleport_default_environment_create`) |
| `EH` | String coercion for error codes |
| `UYL` | Task/title generator for remote agent (`teleport_generate_title`) |
| `Tb` | Session record constructor |
| `YkH` | GitHub App installation checker (`checkGithubAppInstalled`) |
| `Fq` | Fetch wrapper (`Wt`, `nq`, `QJ`) |
| `c_` | Error string extractor |
| `Ih` | Cancel-detection helper |
| `HY` | HTTP-error formatter |
| `ZkH` | Session poller: creates token, polls status, routes terminal states |
| `lN` | Random-token generator (`Vr1.randomBytes`) |
| `YaH` | URL opener (`Wa.open`) |
| `lP` | Pending-status polling helper |
| `PDL` | Status-line formatter (`Sb_`, `N`, `String`) |
| `SH1` | Message-stream processor: maps session events to local messages |
| `pjH` | Terminal-display helper (`nD`) |
| `nD` | Display driver (`d_`, `q`, `TX_`) |
| `gsL` | Maps over history array for UI rendering |
| `Cr_` | Cancellation handler (emits `"Ultrareview cancelled."`) |