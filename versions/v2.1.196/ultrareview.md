---
type: feature-spec
feature: "ultrareview"
cc_version: "2.1.196"
updated: "2026-06-30"
tags: ["ultrareview", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.196 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultrareview`

> Analysis basis: CC v2.1.196 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.196

---

## Overview

`/ultrareview` launches a cloud-hosted AI agent session that performs deep bug-finding and verification across the current Git branch. The command runs entirely in Claude Code on the web (not locally), uploads repository context via a Git bundle or GitHub integration, streams results back to the local CLI, and optionally applies fixes to the working tree when `--fix` is passed. The estimated cost is in the $10–$20 USD range and the review typically takes approximately 10–20 minutes.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultrareview` |
| description | `"Start a cloud agent that finds and verifies bugs in your branch ( … , … USD) · Runs in Claude Code on the web. See …"` |
| module_id | `s7l` |
| load_inline | `true` |
| loc_byte | `12658883` |
| loc_byte_end | `12659153` |
| loc_line | `8595` |
| arbor_handler.name | `Fqf` |
| arbor_handler.fqn | `claude-2.1.196::Fqf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.196 bundle.js:+12658883

---

## Input Branching

The command follows more than three distinct execution paths depending on authentication state, repository configuration, remote eligibility, preflight API results, and diff size. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/ultrareview invoked"] --> B{allow_remote_sessions\nenabled?}
    B -- No --> ERR1["Error: Cloud sessions\ndisabled by org policy\n(bundle.js:+12656363)"]
    B -- Yes --> C{OAuth token\npresent?}
    C -- No --> ERR2["Error: Ultrareview requires\na Claude.ai account.\nRun /login\n(bundle.js:+12656454)"]
    C -- Yes --> D{essential-traffic-only\nmode active?}
    D -- Yes --> ERR3["Error: Unavailable in\nessential-traffic-only mode\n(bundle.js:+12616159)"]
    D -- No --> E{Third-party\nprovider?}
    E -- Yes --> ERR4["Error: Unavailable on\nthird-party providers\n(bundle.js:+12616342)"]
    E -- No --> F{Data-residency\nmode?}
    F -- Yes --> ERR5["Error: Unavailable in\ndata-residency mode\n(bundle.js:+12616314)"]
    F -- No --> G["Call /v1/ultrareview/preflight\nAPI (bundle.js:+12616065)"]
    G --> H{Preflight result?}
    H -- blocked --> ERR6["Error from server:\n'Ultrareview unavailable\nfor your organization'\n(bundle.js:+12622182)"]
    H -- schema_mismatch --> ERR7["schema_mismatch error\n(bundle.js:+12616714)"]
    H -- request_failed --> ERR8["request_failed error\n(bundle.js:+12616875)"]
    H -- needs-confirm --> CONFIRM["Show cost/time estimate\n~$10–$20, ~10–20 min\nAwait user confirmation\n(bundle.js:+12622344)"]
    H -- proceed --> REPO["Repository checks"]
    CONFIRM -- confirmed --> REPO
    CONFIRM -- cancelled --> CANCEL["Ultrareview cancelled\n(bundle.js:+12657241)"]
    REPO --> I{Inside git repo?}
    I -- No --> ERR9["not_git_repo\n(bundle.js:+12618081)"]
    I -- Yes --> J{GitHub remote\ndetected?}
    J -- No --> ERR10["no_github_remote\n(bundle.js:+12618414)"]
    J -- Yes --> K{Monorepo\ndetected?}
    K -- Yes --> ERR11["monorepo_blocked\n(bundle.js:+12618909)"]
    K -- No --> L["Gather PR diff stats\nvia 'gh pr view'\n(bundle.js:+12619159)"]
    L --> M{PR diff\ntoo large?}
    M -- Yes --> ERR12["pr_diff_too_large\n(bundle.js:+12619488)"]
    M -- No --> N["Check repo size\n'git count-objects -v'\n(bundle.js:+8877269)"]
    N --> O{Repo object size\n> 5,000,000?\n(bundle.js:+8877802)}
    O -- Yes --> ERR13["repo_too_large_to_bundle\n(bundle.js:+12619915)"]
    O -- No --> P["Validate base ref\n(bundle.js:+12620148)"]
    P --> Q{Base ref\nfound?}
    Q -- No --> ERR14["base_ref_not_found\n(bundle.js:+12620312)"]
    Q -- Yes --> R["Compute merge base\n(bundle.js:+12620564)"]
    R --> S{Merge base\nfound?}
    S -- No --> ERR15["no_merge_base\n(bundle.js:+12620780)"]
    S -- Yes --> T["Run 'git diff --shortstat'\n(bundle.js:+12621097)"]
    T --> U{Diff empty?}
    U -- Yes --> ERR16["empty_diff\n(bundle.js:+12621263)"]
    U -- No --> V{Local diff\ntoo large?}
    V -- Yes --> ERR17["local_diff_too_large\n(bundle.js:+12621583)"]
    V -- No --> W["Launch cloud session\n(teleportToRemote)\n(bundle.js:+12656577)"]
    W --> X{Session\nlaunched OK?}
    X -- No --> ERR18["Ultrareview failed to\nlaunch cloud session\n(bundle.js:+12656209)"]
    X -- Yes --> Y["Poll session status\nStream results to CLI\n(bundle.js:+12619833)"]
    Y --> Z{--fix flag\npassed?}
    Z -- Yes --> FIX["Apply findings to\nlocal working tree\n(bundle.js:+12656097)"]
    Z -- No --> DONE["Display review results\n(bundle.js:+12657219)"]
    FIX --> DONE
```

---

## Behavioral Spec

### Handler Entry Point

The primary handler is `Fqf` (AsyncFunction, resolved via `module_id → s7l`).

Analysis basis: CC v2.1.196 bundle.js:+12656360

```
async function ultrareviewHandler(commandArgs, appState):

    # 1. Feature gate: check allow_remote_sessions setting
    if not appState.config.allow_remote_sessions:
        displayError("Cloud sessions", reason="disabled")
        emit telemetry: tengu_review_remote_precondition_failed
        return

    # 2. Auth check: require OAuth token (Claude.ai account)
    authMode = resolveAuthMode(appState)
    if authMode == "no-auth":
        displayError("Ultrareview requires a Claude.ai account. Run /login to authenticate.")
        return

    # 3. Provider checks
    if isEssentialTrafficOnlyMode():
        displayError("Unavailable in essential-traffic-only mode")
        return
    if isThirdPartyProvider():
        displayError("Unavailable on third-party providers")
        return
    if isDataResidencyMode():
        displayError("Unavailable in data-residency mode")
        return

    # 4. Preflight API call
    preflightResult = await callPreflightAPI("/v1/ultrareview/preflight", authHeaders)
    handle preflightResult:
        case "blocked":     showOrgBlockedError(); return
        case "schema_mismatch": showSchemaError(); return
        case "request_failed":  showRequestError(); return
        case "needs-confirm":
            confirmed = await showCostConfirmDialog(estimate="$10-$20", duration="~10–20 min")
            if not confirmed: return  # "Ultrareview cancelled."
        case "proceed": continue

    # 5. Parse --fix flag from args
    fixMode = parseArgs(commandArgs).has("--fix")

    # 6. Repository precondition checks (see sub-sections below)
    repoCheck = await runRepositoryChecks(appState)
    if repoCheck.error: emit telemetry(repoCheck.errorCode); return

    # 7. Launch cloud session
    sessionResult = await teleportToRemote(repoCheck.context, fixMode)
    if sessionResult.error:
        displayError("Ultrareview failed to launch the cloud session.")
        emit telemetry: tengu_review_remote_teleport_failed
        return

    emit telemetry: tengu_review_remote_launched

    # 8. Poll and stream results
    await pollAndStreamResults(sessionResult.sessionId)

    # 9. If --fix: apply patches locally
    if fixMode:
        applyFindingsToWorkingTree(sessionResult.findings)

    displayFinalResults()
```

Analysis basis: CC v2.1.196 bundle.js:+12656360

---

### Sub-feature: Repository Precondition Checks (`nar` / `repositoryPreconditions`)

```
async function repositoryPreconditions(appState):

    # Check git repository presence
    isGit = await runGit(["rev-parse", "--is-inside-work-tree"])
    if not isGit:
        return error("not_git_repo")

    # Get remote URL
    remoteUrl = await getGitRemoteUrl()  # git config --get remote.origin.url
    if not remoteUrl:
        return error("no_github_remote")

    # Validate remote is github.com (not www., strips leading protocol)
    normalizedUrl = normalizeGitUrl(remoteUrl)
    if not normalizedUrl.includes("github.com"):
        return error("no_github_remote")

    # Block Anthropic monorepos
    owner = extractOwnerFromUrl(normalizedUrl)
    if owner in ["anthropics", "anthropic"]:
        return error("monorepo_blocked")

    # Gather PR diff stats via GitHub CLI
    prStats = await runGhCli(["pr", "view", "--repo", repoName,
                               "--json", "additions,deletions,changedFiles"])
    # Timeout: 5000 ms (bundle.js:+12619278)
    if prStats.additions + prStats.deletions > PR_DIFF_LIMIT:
        return error("pr_diff_too_large")

    # Check repository object count
    objectCount = await runGit(["count-objects", "-v"])
    if objectCount.size > 5000000:  # 5,000,000 objects (bundle.js:+8877802)
        return error("repo_too_large_to_bundle")

    # Validate base ref exists
    baseRef = resolveBaseRef(appState)
    refValid = await runGit(["--verify", "--quiet", baseRef])
    if not refValid:
        return error("base_ref_not_found")

    # Resolve default branch and current branch
    defaultBranch = await resolveDefaultBranch()  # symbolic-ref refs/remotes/origin/HEAD
    currentBranch = await runGit(["branch", "--abbrev-ref", "HEAD"])

    # Find merge base
    mergeBase = await runGit(["merge-base", currentBranch, defaultBranch])
    if not mergeBase:
        return error("no_merge_base")

    # Check diff is non-empty
    shortStat = await runGit(["diff", "--shortstat", mergeBase])
    if shortStat is empty:
        return error("empty_diff")

    # Check local diff is within size limits
    diffSize = parseDiffSize(shortStat)
    if diffSize > LOCAL_DIFF_LIMIT:
        return error("local_diff_too_large")

    return success({ mergeBase, currentBranch, defaultBranch, remoteUrl })
```

Analysis basis: CC v2.1.196 bundle.js:+12618013 (git repo check), +12618081 (not_git_repo), +12618341 (remote URL), +12618414 (no_github_remote), +12618798 (monorepo check), +12619159 (PR stats), +12619488 (pr_diff_too_large), +12619915 (repo_too_large), +12620148 (base ref verify), +12620564 (merge-base), +12621097 (shortstat), +12621263 (empty_diff), +12621583 (local_diff_too_large)

---

### Sub-feature: Preflight API Call (`Bzl` / `preflightApiCall`)

```
async function preflightApiCall(authToken, orgUuid):

    response = await httpPost("/v1/ultrareview/preflight", {
        headers: {
            "teleport-org": orgUuid,
            Authorization: bearerToken(authToken)
        }
    })
    # Telemetry: api_ultrareview_preflight (bundle.js:+12616686)

    if response.status == "blocked":
        return { result: "blocked" }

    if not schemaValid(response):
        return { result: "schema_mismatch" }  # bundle.js:+12616714

    if requestFailed(response):
        return { result: "request_failed" }   # bundle.js:+12616875

    if response.result == "proceed":
        return { result: "proceed" }

    if response.result == "needs-confirm":
        # Server returns cost/time info; shown to user as confirmation dialog
        return { result: "needs-confirm", costEstimate: response.cost }

    if response.result == "server":
        return { result: "blocked", message: "Ultrareview is unavailable for your organization." }
```

Analysis basis: CC v2.1.196 bundle.js:+12616065, +12616686, +12616714, +12616875, +12621964, +12622145, +12622182, +12622277, +12622344

---

### Sub-feature: Cloud Session Launch (`rar` / `teleportSession`)

```
async function teleportSession(repoContext, fixMode):

    # Phase: env-select (bundle.js:+8901484)
    environment = await selectOrCreateRemoteEnvironment()
    if not environment:
        return error("no_environments")

    # Phase: branch-detect (bundle.js:+8903289)
    branchInfo = await detectBranchForSession(repoContext)

    # Phase: bundle-upload (bundle.js:+8904948)
    bundleMode = determineBundleMode(repoContext)
    # Possible modes: "github", "forced_bundle", "explicit_env_bundle"
    # (bundle.js:+8904366, +8903989, +8899412)

    if bundleMode == "github":
        # GitHub App integration path: verify app installed
        githubAppOk = await checkGithubAppInstalled()
        if not githubAppOk:
            # Fall back to bundle upload
            bundleMode = "forced_bundle"

    if bundleMode involves bundle upload:
        # Stash uncommitted changes and create git bundle
        # (teleport_git_bundle_upload telemetry: bundle.js:+8880387)
        bundleResult = await createAndUploadGitBundle(repoContext)
        # Bundle named: ccr-seed + .bundle (bundle.js:+8881683, +8881694)
        # Seed refs: refs/seed/stash, refs/seed/root (bundle.js:+8880488, +8880506)
        if bundleResult.failed:
            return error("upload_failed")

    # Phase: POST-sent (bundle.js:+8907013)
    sessionPayload = {
        sourceType: bundleMode,
        branchInfo: branchInfo,
        environmentId: environment.id,
        taskType: "ultrareview",
        fixMode: fixMode
    }

    response = await httpPost("/v1/sessions OR /v1/code/sessions", sessionPayload,
                               headers={"x-organization-uuid": orgUuid,
                                        "anthropic-beta": "v1alpha2"})
    # Status 201 = success (bundle.js:+8900402)
    # Status 401/403 = auth errors (bundle.js:+8900474, +8900478)

    if response.status != 201:
        handleSessionCreateError(response)
        return error("create_request_failed")

    if not response.sessionId:
        return error("malformed_response")  # bundle.js:+8901266

    emit telemetry: tengu_ccr_session_link
    return { sessionId: response.sessionId }
```

Analysis basis: CC v2.1.196 bundle.js:+12621940, +12622404, +8880387, +8881683, +8897404, +8897415, +8897435, +8900307, +8900402, +8901266

---

### Sub-feature: Session Polling (`oar` / `pollRemoteSession`)

```
async function pollRemoteSession(sessionId, fixMode):

    # Poll interval: 1000 ms (bundle.js:+8920705)
    # Maximum wait: 1,800,000 ms = 30 min (bundle.js:+8920712)

    while elapsed < 1800000:
        await sleep(1000)
        status = await fetchSessionStatus(sessionId)

        switch status.state:
            case "starting":    displayProgress("Starting…")
            case "running":     displayProgress("Running…")
            case "idle":        displayProgress("Idle…")
            case "hook_started":    relayHookStarted(status)
            case "hook_progress":   relayHookProgress(status)
            case "hook_response":   relayHookResponse(status)
            case "result":          processResult(status); break
            case "completed":       processCompleted(status); break
            case "archived":        break
            case "orchestrator_error":  return error("orchestrator_error")
            case "session_error":       return error("session_error")

    if timed out:
        return error("poll_timeout")  # bundle.js:+8923391

    if no review output received:
        return error("no_review_output")  # bundle.js:+8923406

    # Cost display using locale-formatted numbers (bundle.js:+12619644)
    displayCostSummary(result.cost)
    return result
```

Analysis basis: CC v2.1.196 bundle.js:+12619833, +8920705, +8920712, +8921156, +8921231, +8921365, +8921719, +8921902, +8921931, +8922338, +8922422, +8922512, +8922739, +8923323, +8923369, +8923391, +8923406

---

### Sub-feature: Auth Mode Resolution (`P$t` / `resolveAuthMode`)

The auth resolution checks, in order (Analysis basis: CC v2.1.196 bundle.js:+3394060):

1. `firstParty` — standard Anthropic API (bundle.js:+3394104)
2. `third_party_provider` — third-party API base URL (bundle.js:+3394123)
3. `custom_base_url` — custom base URL configured (bundle.js:+3394182)
4. `no_auth` — no credentials at all (bundle.js:+3394328)
5. `oauth_no_inference_scope` — OAuth token without inference scope (bundle.js:+3394371)
6. `enterprise` — enterprise account (bundle.js:+3394457)
7. `team` — team account (bundle.js:+3394492)
8. `prosumer_oauth` — prosumer OAuth account (bundle.js:+3394505)

Ultrareview requires a non-`no_auth` auth mode with an OAuth token; API key alone is insufficient (see error string at bundle.js:+7406576).

---

### Sub-feature: Git URL Normalization and GitHub Detection

```
function normalizeAndCheckGithubUrl(rawUrl):
    # Strip protocol credentials: replaces "://***@" pattern (bundle.js:+1165110)
    cleaned = rawUrl.replace(credentialPattern, "://")

    # Normalize path separators for Windows (bundle.js:+1101929)
    normalized = path.normalize(cleaned).replaceAll("\\", "/")

    # Strip www. prefix if present (bundle.js:+1160463)
    if normalized.startsWith("www."):
        normalized = normalized.slice(4)

    # Must contain "github.com" (bundle.js:+1160495)
    return normalized.includes("github.com")
```

Analysis basis: CC v2.1.196 bundle.js:+1160162, +1160463, +1160495, +1165086, +1165110

---

### Sub-feature: Default Branch Resolution (`qM` / `hy` / `resolveDefaultBranch`)

```
async function resolveDefaultBranch():
    # Try symbolic-ref for origin/HEAD (bundle.js:+1173325, +1173350)
    result = await runGit(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"])
    if result.ok:
        return result.stdout.trim()

    # Fall back to show-ref (bundle.js:+1173532)
    refList = await runGit(["show-ref"])
    for ref in refList:
        if ref.includes("main"):   return "main"    # bundle.js:+1173463
        if ref.includes("master"): return "master"  # bundle.js:+1173470

    return "main"  # ultimate default
```

Analysis basis: CC v2.1.196 bundle.js:+1173283, +1173099, +1173325, +1173463, +1173470, +1173532

---

### Sub-feature: --fix Mode

When the `--fix` flag is detected in command arguments (bundle.js:+12617889, +12617896), the handler appends an instruction to the cloud task directing the remote agent to apply the discovered bug fixes to the local working tree upon completion (literal fragment near bundle.js:+12656097: `"…--fix: when the findings arrive, apply them to the local working tree"`). The fix flag is surfaced as a recognized sub-command distinct from `comment` (bundle.js:+12617902) and `/code-review ultra` (bundle.js:+12617981).

Analysis basis: CC v2.1.196 bundle.js:+12617889, +12656097

---

### Sub-feature: Overage / Spend Blocking (`V` / `spendLimitCheck`)

```
function checkSpendLimit(appState):
    limitStatus = appState.spendLimit

    switch limitStatus:
        case "spend.blocked":
            emit telemetry: tengu_review_overage_blocked  # bundle.js:+12656615
            showOverageBlockedDialog()
            return blocked

        case "store_error":
            displayError("spend limit unavailable")  # bundle.js:+17811010
            return blocked

        case "spend limit reached":
            showSpendLimitReachedMessage()  # bundle.js:+17811036
            return blocked

        case "billing_error":
            # HTTP 429 with x-should-retry header (bundle.js:+17811194, +17811207)
            showBillingError()
            return blocked

    return allowed
```

When the overage dialog is shown: `tengu_review_overage_dialog_shown` (bundle.js:+12656952).

Analysis basis: CC v2.1.196 bundle.js:+12656613, +12656615, +12656952, +17810935, +17811036

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_review_remote_precondition_failed` | Fired on any pre-execution gate failure (auth, policy, etc.) (bundle.js:+12618028) |
| Telemetry: `tengu_review_bughunter_config` | Fired when configuring the bug-hunter cloud task (bundle.js:+9232815) |
| Telemetry: `tengu_review_remote_launched` | Fired on successful cloud session launch (bundle.js:+12625735) |
| Telemetry: `tengu_review_remote_teleport_failed` | Fired when session launch fails (bundle.js:+12625059) |
| Telemetry: `tengu_review_overage_blocked` | Fired when spend limit blocks execution (bundle.js:+12656615) |
| Telemetry: `tengu_review_overage_dialog_shown` | Fired when overage confirmation dialog is shown (bundle.js:+12656952) |
| Telemetry: `tengu_ccr_bundle_upload` | Fired during Git bundle upload to cloud (bundle.js:+8880680) |
| Telemetry: `tengu_ccr_bundle_max_bytes` | Fired to record max bundle size (bundle.js:+8877184) |
| Telemetry: `tengu_ccr_bundle_seed_enabled` | Fired when seed bundle mode is active (bundle.js:+7411380) |
| Telemetry: `tengu_teleport_bundle_mode` | Records the chosen bundle/source strategy (bundle.js:+8899305) |
| Telemetry: `tengu_teleport_source_decision` | Records final source-type decision (bundle.js:+8905858) |
| Telemetry: `tengu_ccr_session_link` | Records cloud session link details (bundle.js:+8890694) |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` | Feature health signals (bundle.js:+1028610, +1028677, +1028758) |
| Telemetry: `tengu_daemon_control` | Daemon lifecycle event (bundle.js:+18033163) |
| Telemetry: `tengu_daemon_yield` | Daemon yields to foreground session (bundle.js:+18015313) |
| Telemetry: `tengu_daemon_config_reload` | Config reload event (bundle.js:+18010884) |
| Telemetry: `tengu_bg_retire_pinned_low_mem` | Background worker retired due to low memory (bundle.js:+17998722) |
| Telemetry: `tengu_bg_prewarm_per_sweep` | Background prewarm sweep (bundle.js:+17998847) |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | SIGKILL escalation for background worker (bundle.js:+17993512) |
| Telemetry: `tengu_bg_dispatch_low_mem` | Low-memory dispatch event (bundle.js:+17994102) |
| Telemetry: `tengu_bg_spare_enable` / `tengu_bg_spare_claim` / `tengu_bg_spare_claim_fail` | Spare worker pool management (bundle.js:+17994792, +17994920, +17995186) |
| Git side effects | Creates and uploads a Git bundle; creates temporary refs `refs/seed/stash`, `refs/seed/root` (bundle.js:+8880488, +8880506); cleans up after upload |
| File system | Writes and unlinks a seed bundle file (`_source_seed.bundle`) in a temp directory (bundle.js:+8881990, +16995157, +16995462) |
| Network | POSTs to `/v1/ultrareview/preflight` and `/v1/sessions` or `/v1/code/sessions` on the Claude.ai backend |
| appState changes | Registers a remote agent session entry; may update session status in UI during polling |
| Background daemon | The command interacts with the Claude Code background daemon for session lifecycle management; yields if foreground takes priority |
| Working tree | If `--fix` is passed, patches are applied to the local working tree after session completes |

---

## Version History

| Version | Change |
|---|---|
| v2.1.196 | Initial analysis |

---

## Common Mistakes

1. **Running without a Claude.ai OAuth login.** API key authentication alone is not sufficient; the command explicitly requires an OAuth token tied to a Claude.ai account. Run `/login` first.

2. **Running outside a Git repository.** The command requires a valid Git working tree. Non-git directories produce `not_git_repo` immediately.

3. **Using a non-GitHub remote.** The command only supports `github.com` remotes. GitLab, Bitbucket, or self-hosted GHES that doesn't resolve as `github.com` will produce `no_github_remote`.

4. **Running in an Anthropic monorepo.** Repositories owned by `anthropics` or `anthropic` are explicitly blocked (`monorepo_blocked`).

5. **Running from a branch with an empty diff vs. the default branch.** If the current branch has no commits or changes relative to `main`/`master`, the command aborts with `empty_diff`.

6. **Expecting local execution.** The review agent runs entirely on Claude Code on the web, not locally. Results are streamed back; this is not a local AI analysis.

7. **Assuming instant results.** The typical turnaround is ~10–20 minutes. The CLI polls the session for up to 30 minutes (1,800,000 ms) before timing out with `poll_timeout`.

8. **Using `--fix` without expecting working-tree mutations.** The `--fix` flag causes the remote agent to apply discovered bug fixes directly to the local working tree on completion; ensure you have a clean working state or stash before using it.

9. **Ignoring cost.** Each run costs approximately $10–$20 USD and requires explicit confirmation if the preflight returns `needs-confirm`. The dialog cannot be bypassed without user confirmation.

10. **Running in essential-traffic-only or data-residency mode.** Both network modes block `ultrareview` unconditionally.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Fqf` | Main ultrareview async handler (entry point) |
| `O6` | String/token utility (capitalization helper) |
| `Gs` | Auth mode gate / telemetry check router |
| `OFi` | Auth status inner check |
| `N6` | Auth label formatter |
| `GF` | Auth mode resolver |
| `P$t` | Auth mode classification (firstParty, oauth, enterprise, etc.) |
| `zi` | Telemetry consent check |
| `Fbs` | Telemetry level resolver |
| `J_e` | String coercion utility |
| `ct` | String cast wrapper |
| `A4o` | Fix-flag argument parser |
| `ear` | Argument list normalizer |
| `FL` | String escape utility |
| `kge` | Spend-limit/billing checker |
| `nar` | Repository precondition orchestrator |
| `ymt` | Git work-tree detection |
| `Ot` | Process execution wrapper (git/gh commands) |
| `tmn` | Async-local-storage store reader |
| `dr` | Log/debug sink |
| `Gr` | Child process executor (execFileNoThrow) |
| `LBe` | Child process spawn coordinator |
| `rFu` | String coercion in exec results |
| `T` | Log message formatter |
| `rn` | Stream/pipe utility |
| `nFu` | Stream line reader |
| `Re` | Process result handler |
| `Uo` | Object merge utility |
| `er` | Error constructor wrapper |
| `V` | Spend-limit state reader |
| `qe` | UUID / token validator |
| `$Xe` | UUID generator utility |
| `sN` | Git remote URL fetcher |
| `q7` | Remote URL cache resolver |
| `Umn` | Git config map getter |
| `_tt` | URL credential scrubber |
| `ple` | Git URL parser (protocol/host/path) |
| `Lvs` | URL component splitter |
| `Htt` | URL protocol tester |
| `yi` | String index/slice utility |
| `Nm` | GitHub hostname normalizer |
| `wkt` | www-prefix stripper |
| `vvs` | URL slice helper |
| `Pn` | Base-ref validator |
| `m` | Array filter utility |
| `XHr` | Path normalization (Windows) |
| `k` | File-watcher / scheduled-task coordinator |
| `hXo` | Scheduled task executor |
| `mrn` | Scheduled task cleanup |
| `D` | Daemon write helper |
| `FEe` | Path join utility |
| `O` | Background session watcher/sweeper |
| `I` | Input event handler |
| `h` | Background worker lifecycle manager |
| `Gt` | JSON.parse wrapper |
| `HLo` | Poll timing calculator (500 ms, 8000 ms bounds) |
| `Fqe` | Session status fetcher |
| `it` | Session state machine |
| `_` | Locale string formatter |
| `sol` | Repo object-count checker |
| `ool` | Git count-objects runner |
| `rol` | Session state updater |
| `f` | Path normalizer |
| `L8` | OS path normalizer |
| `qM` | Default branch resolver (symbolic-ref) |
| `nMr` | Git config map default-branch getter |
| `hy` | Current branch resolver (abbrev-ref HEAD) |
| `tMr` | Git config map branch getter |
| `u` | Daemon stop / background session manager |
| `xe` | Feature-ok telemetry emitter |
| `Oe` | Feature-sad telemetry emitter |
| `ke` | Feature-bad telemetry emitter |
| `$F` | Session event dispatcher |
| `D6` | Session queue handler |
| `u5e` | Event index utility |
| `V7r` | Session UUID/event emitter |
| `Wj` | Graceful shutdown coordinator |
| `rye` | Shutdown notifier |
| `pye` | Timeout clearer on shutdown |
| `On` | Timed abort controller |
| `Hzn` | Integer parser (PR diff stats) |
| `rar` | Cloud session launcher (teleportToRemote) |
| `Bzl` | Preflight API caller |
| `y4o` | Preflight result handler |
| `wt` | Feature-sad signal emitter |
| `TOe` | Session-create status processor |
| `K_t` | Overage / spend-limit dialog controller |
| `L0` | Overage dialog layout |
| `Bxe` | Subscription/plan checker |
| `Nc` | Plan eligibility resolver |
| `aE` | API credential resolver |
| `Dt` | Timestamp/date utility |
| `Ao` | Plan display formatter |
| `R3` | Array includes checker |
| `sb` | Subscription plan classifier (max, pro, etc.) |
| `Mi` | Role/permission classifier (admin, billing, owner) |
| `uBr` | User billing-role checker |
| `cBr` | User role checker |
| `OQ` | Session-status display component |
| `$qf` | JSX render function for ultrareview UI |
| `oar` | Remote agent eligibility + launch orchestrator |
| `rfe` | Remote agent feature gate |
| `IFa` | Background remote eligibility checker |
| `w` | Background session display mapper |
| `hJ` | Session display item formatter |
| `L` | Away-summary skip evaluator |
| `UOc` | Away-summary message builder |
| `$Oc` | Away-summary queue manager |
| `Zoe` | Session link display helper |
| `Qll` | Cost-estimate formatter |
| `c` | yn (yes/no prompt) wrapper |
| `yn` | Yes/no confirmation prompt |
| `SW` | teleportToRemote — full cloud session creation |
| `Lc` | OAuth token refresher |
| `qrl` | Session creation request builder |
| `ph` | Token refresh helper |
| `MKn` | Session request header builder |
| `k3` | Axios request executor |
| `lol` | Session endpoint selector (v1alpha2 / v1) |
| `evo` | Git bundle creator and uploader |
| `Rt` | Log/output renderer |
| `Us` | Base URL resolver |
| `aol` | Control event sender |
| `PGt` | Session size checker |
| `Me` | JSON stringify wrapper |
| `ce` | Session status poller helper |
| `QCo` | Session creation response validator |
| `nvo` | Session not-found error handler |
| `rvo` | Session response mapper |
| `col` | Session metadata collector |
| `iol` | Session link UI component |
| `$4n` | Session environment filter |
| `Ioe` | Remote environment lister |
| `_mt` | Default environment creator |
| `he` | Error string extractor |
| `d` | MCP/daemon config updater |
| `gof` | Task title generator (teleport_generate_title) |
| `Eof` | Background-task filter |
| `FF` | Full session state machine runner |
| `Kje` | GitHub App install checker |
| `Ts` | Session display sorter |
| `Z` | Session inclusion filter |
| `de` | Message queue enqueuer |
| `dh` | Error display handler |
| `x_` | Cancellation handler |
| `Mo` | UUID validator |
| `YAe` | Remote agent session poller (fol orchestrator) |
| `LU` | Random bytes generator |
| `Lmt` | Browser/URL opener |
| `PT` | Session status timestamp tracker |
| `Iof` | Session status string formatter |
| `fol` | Session poll loop |
| `ofe` | Session event emitter wrapper |
| `EE` | Event relay |
| `Uqf` | UI result mapper |
| `tar` | Post-review result display / fix applier |