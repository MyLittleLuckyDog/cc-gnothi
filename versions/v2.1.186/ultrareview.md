---
type: feature-spec
feature: "ultrareview"
cc_version: "2.1.186"
updated: "2026-06-23"
tags: ["ultrareview", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.186 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultrareview`

> Analysis basis: CC v2.1.186 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.186

---

## Overview

`/ultrareview` launches a cloud-hosted agent that finds and verifies bugs in the current Git branch by uploading the repository to Claude Code on the web and running a remote review session. The command performs a series of precondition checks (organization policy, Git state, GitHub remote, diff size, preflight API), prompts the user for cost confirmation (~$10–$20 USD, ~10–20 min), and then teleports the repository bundle to a remote environment where the review executes. Results are streamed back to the local terminal.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultrareview` |
| description | `"Start a cloud agent that finds and verifies bugs in your branch ( ... , ... USD) · Runs in Claude Code on the web. See ..."` |
| loc_byte | `12388122` |
| loc_byte_end | `12388393` |
| loc_line | `8249` |
| module_id | `e0l` |
| load_inline | `true` |
| arbor_handler.name | `pmf` |
| arbor_handler.fqn | `claude-2.1.186::pmf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.186 bundle.js:+12388122

---

## Input Branching

There are more than 3 distinct branches in the handler, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/ultrareview invoked"]) --> B{allow_remote_sessions\npolicy enabled?}
    B -- No --> ERR1["Error: Cloud sessions disabled by org policy\n(bundle.js:+12385561)"]
    B -- Yes --> C{Organization type\nfirstParty check}
    C -- Not first-party --> ERR2["Error: Unavailable on third-party providers"]
    C -- First-party --> D{Git repo\ndetected?}
    D -- No git repo --> ERR3["Precondition fail: not_git_repo\n(bundle.js:+12347509)"]
    D -- Git repo found --> E{GitHub remote\npresent?}
    E -- No GitHub remote --> ERR4["Precondition fail: no_github_remote\n(bundle.js:+12347842)"]
    E -- Anthropic internal monorepo? --> ERR5["Precondition fail: monorepo_blocked\n(bundle.js:+12348362)"]
    E -- GitHub remote OK --> F{Diff size within\nlimit? ≤5000 lines\n(bundle.js:+12348731)}
    F -- Too large --> ERR6["Precondition fail: pr_diff_too_large or\nlocal_diff_too_large"]
    F -- Empty diff --> ERR7["Precondition fail: empty_diff"]
    F -- Within limit --> G[Call preflight API\n/v1/ultrareview/preflight\n(bundle.js:+12345793)]
    G -- essential-traffic-only --> ERR8["Unavailable in essential-traffic-only mode\n(bundle.js:+12345923)"]
    G -- data-residency / zdr --> ERR9["Unavailable on third-party providers\n(bundle.js:+12346070)"]
    G -- no OAuth token --> ERR10["Requires Claude.ai account: run /login\n(bundle.js:+12346203)"]
    G -- server says unavailable --> ERR11["Ultrareview unavailable for org\n(bundle.js:+12351552)"]
    G -- needs-confirm --> H{User accepts\ncost confirmation\n~$10-$20 USD?}
    G -- proceed --> I[Teleport: bundle & upload\ngit repository]
    H -- Cancelled --> CANCEL["Ultrareview cancelled.\n(bundle.js:+12386485)"]
    H -- Confirmed --> I
    I --> J{Repository bundle\nmode selection}
    J -- GitHub app installed + reachable --> K["Source: github\n(bundle.js:+12597640)"]
    J -- BYOC / no GitHub --> L["Source: bundle upload\n(bundle.js:+12576113)"]
    J -- No git at all --> M["Source: seed bundle / empty sandbox\n(bundle.js:+8599005)"]
    K --> N[POST create remote session]
    L --> N
    M --> N
    N -- Error 401/403/429 --> ERR12["github_repo_access_denied /\ncreate_request_failed"]
    N -- Malformed response --> ERR13["malformed_response\n(bundle.js:+8594518)"]
    N -- Success --> O[Poll remote session\nfor results]
    O -- poll_timeout --> ERR14["poll_timeout\n(bundle.js:+8615935)"]
    O -- orchestrator_error --> ERR15["orchestrator_error\n(bundle.js:+8615867)"]
    O -- no_review_output --> ERR16["no_review_output\n(bundle.js:+8615950)"]
    O -- completed --> P["Display review results\nin terminal"]
    P --> Q([Done])
```

---

## Behavioral Spec

### 1. Entry Point — Handler (`pmf`)

```
async function ultrareviewHandler(context):
    # Check org policy
    if not context.settings["allow_remote_sessions"]:
        emit telemetry("tengu_review_overage_blocked")
        display error("Cloud sessions are disabled by your organization's policy...")
        return

    # Small jitter delay before proceeding
    delay = random(0, 2) * someMilliseconds
    await sleep(delay)

    # Run precondition checks
    result = await checkPreconditions(context)
    if result.failed:
        emit telemetry("tengu_review_remote_precondition_failed", reason=result.reason)
        display error(result.message)
        return

    # Preflight API call
    preflightResult = await callPreflightAPI(context)
    if preflightResult.status != "proceed" and preflightResult.status != "needs-confirm":
        display error(preflightResult.message)
        return

    # Cost confirmation dialog (if required)
    if preflightResult.status == "needs-confirm":
        confirmed = await showConfirmDialog(estimatedCost="$10-$20", duration="~10-20 min")
        if not confirmed:
            display "Ultrareview cancelled."
            return

    # Launch remote session
    launchResult = await launchRemoteSession(context)
    if launchResult.failed:
        display error("Ultrareview failed to launch the cloud session. Check that this is a GitHub repo and try again.")
        emit telemetry("tengu_review_remote_teleport_failed")
        return

    emit telemetry("tengu_review_remote_launched")
    # Poll and display results
    await pollAndDisplayResults(launchResult.sessionId)
```

Analysis basis: CC v2.1.186 bundle.js:+12385524

---

### 2. Precondition Checks (`checkPreconditions` — maps to `ULl` + `ULo`)

```
async function checkPreconditions(context):
    # Parse flags from invocation (e.g. --fix, --comment)
    flags = parseFlags(context.args)   # "fix", "comment" literals at +12347324, +12347330

    # Validate git repository presence
    isGitRepo = await runGit(["rev-parse", "--is-inside-work-tree"])  # +7200579, +7200591
    if not isGitRepo:
        return fail(reason="not_git_repo")   # +12347509

    # Retrieve and validate GitHub remote URL
    remoteUrl = await getGitRemoteUrl()      # runs: git config --get remote.origin.url
    if not remoteUrl:
        return fail(reason="no_github_remote")  # +12347842
    if remoteUrl does not include "github.com":
        return fail(reason="no_github_remote")
    if remoteUrl includes "anthropics" or "anthropic" (internal monorepos):
        return fail(reason="monorepo_blocked")  # +12348362

    # Diff size check via GitHub CLI (gh pr view --json additions,deletions,changedFiles)
    prStats = await runGhCLI(["pr", "view", "--repo", repoName,
                               "--json", "additions,deletions,changedFiles"])
    totalLines = prStats.additions + prStats.deletions
    if totalLines > 5000:                    # limit at +12348731
        return fail(reason="pr_diff_too_large")  # +12348941

    # Repo object-count size check (git count-objects -v)
    objectCount = await runGit(["count-objects", "-v"])
    if objectCount > 5000000:               # limit at +8573262
        return fail(reason="repo_too_large_to_bundle")  # +12349351

    # Verify base branch ref exists
    baseRef = await resolveBaseRef(context)  # git merge-base, symbolic-ref, branch
    if not baseRef:
        return fail(reason="base_ref_not_found")  # +12349682

    # Compute local diff stat
    diffStat = await runGit(["diff", "--shortstat", baseRef])  # +12350467, +12350474
    if diffStat is empty:
        return fail(reason="empty_diff")   # +12350633
    if localDiffTooLarge(diffStat):
        return fail(reason="local_diff_too_large")  # +12350953

    return success()
```

Analysis basis: CC v2.1.186 bundle.js:+12347317 (ULl), +12347441 (ULo)

---

### 3. Preflight API Call (`callPreflightAPI` — maps to `FLo` → `PLl`)

```
async function callPreflightAPI(context):
    # Check essential-traffic-only mode before network call
    if settings["essential-traffic-only"]:
        return fail("Ultrareview runs in Claude Code on the web and is unavailable "
                    "when essential-traffic-only mode is active.")  # +12345923

    # Check auth provider
    if provider == "data-residency" or provider == "zdr":
        return fail("Ultrareview runs in Claude Code on the web and is unavailable "
                    "on third-party providers.")  # +12346070

    # Check OAuth token presence
    if not oauthToken:
        return fail("Ultrareview requires a Claude.ai account. Run /login to authenticate.")
                    # +12346203

    response = await HTTP_GET("/v1/ultrareview/preflight",   # +12345793
                               headers={"teleport-org": orgId})

    emit telemetry("api_ultrareview_preflight")  # +12346414

    if response.schema_mismatch:
        return fail(reason="schema_mismatch")    # +12346442
    if response.status_code != 200:
        return fail(reason="request_failed")     # +12346603

    if response.body.status == "proceed":
        return {status: "proceed"}
    elif response.body.status == "needs-confirm":
        return {status: "needs-confirm", cost: response.body.estimatedCost}
    elif response.body.status == "server":
        return fail("Ultrareview is unavailable for your organization.")  # +12351552
    else:
        return fail(reason="unknown")
```

Analysis basis: CC v2.1.186 bundle.js:+12351310 (PLl), +12345793

---

### 4. Remote Session Launch / Teleport (`launchRemoteSession` — maps to `dmf` → `$Lo` → `R5`)

```
async function launchRemoteSession(context):
    # Eligibility re-check for background remote
    eligibility = await checkBgRemoteEligibility(context)
    # Possible eligibility failures: policy_blocked, not_logged_in, byoc,
    # not_in_git_repo, no_git_remote, github_app_not_installed  (+7202797 … +7203475)

    if eligibility.ineligible:
        emit telemetry("tengu_review_remote_teleport_failed")
        return fail(eligibility.reason)

    # Determine bundle mode
    bundleMode = determineBundleMode(context)
    # Modes: "github", "bundle", "explicit_env_bundle", "byoc", "no_git_at_all"
    emit telemetry("tengu_teleport_bundle_mode", mode=bundleMode)  # +8592979

    if bundleMode == "github":
        uploadResult = await uploadGitBundleToGitHub(context)  # jlo
        emit telemetry("tengu_ccr_bundle_upload", ...)  # +8576113
    elif bundleMode == "bundle":
        uploadResult = await uploadGitBundle(context)
    else:
        uploadResult = {type: "seed_bundle"}

    # POST to create session
    sessionPayload = {
        task:       buildTaskDescription(context),  # kIp, generates title via teleport_generate_title
        source:     uploadResult,
        bundleRef:  uploadResult.ref,
        flags:      context.parsedFlags,
    }
    response = await HTTP_POST(sessionEndpoint, sessionPayload,
                                headers={
                                    "anthropic-beta": "ccr-byoc-2025-07-29",  # +8592629
                                    "x-organization-uuid": orgUuid,
                                })

    if response.status == 401 or 403 or 429:
        return fail(reason="github_repo_access_denied")  # +8594066
    if response.status not in [200, 201]:
        return fail(reason="create_request_failed")  # +8594367
    if not response.body.sessionId:
        return fail(reason="malformed_response",
                    message="Server returned a malformed session response (no session id)")
                    # +8594518

    emit telemetry("tengu_ccr_session_link")   # +8586085
    return {sessionId: response.body.sessionId}
```

Analysis basis: CC v2.1.186 bundle.js:+12386397 (dmf), +12351932 ($Lo), +8592719 (jlo), +8592192 (R5)

---

### 5. Result Polling (`pollAndDisplayResults` — maps to `KHe` → `PNa`)

```
async function pollAndDisplayResults(sessionId):
    startTime = Date.now()
    timeout = 1800000  # 30 minutes in ms (+8613256)

    loop:
        if Date.now() - startTime > timeout:
            emit telemetry("tengu_review_remote_teleport_failed")
            return fail(reason="poll_timeout")   # +8615935

        status = await pollSessionStatus(sessionId)  # GET remote-workflow endpoint

        if status == "pending" or status == "starting" or status == "running":
            await sleep(pollInterval)
            continue
        elif status == "completed":
            result = extractReviewResult(status.messages)   # findLast "result" event
            if not result:
                return fail(reason="no_review_output")      # +8615950
            displayFormattedResult(result)
            emit telemetry("tengu_review_remote_launched")  # +12354899
            return
        elif status == "archived":
            return fail(reason="session_error")
        elif status == "orchestrator_error":
            return fail(reason="orchestrator_error")        # +8615867
        else:
            await sleep(pollInterval)
```

Analysis basis: CC v2.1.186 bundle.js:+8611568 (KHe), +8612093 (PNa), +8613256

---

### 6. `--fix` Flag Behavior

When the user invokes `/ultrareview` with `--fix`, an additional instruction is appended to the task payload sent to the remote agent:

> "The user passed --fix: when the findings arrive, apply them to the local working tree." (bundle.js:+12385263)

The `fix` literal is parsed during the flag-parsing phase (`c7n` at +12347324). The `comment` flag (`+12347330`) similarly modifies the task description to request review comment generation.

Analysis basis: CC v2.1.186 bundle.js:+12385263, +12347324

---

### 7. Overage / Cost Dialog

If the preflight returns `needs-confirm`, the handler shows a dialog displaying:
- Estimated cost range: `$10–$20` (bundle.js:+9045522)
- Estimated duration: `~10–20 min` (bundle.js:+9045615)

If the user dismisses or cancels, the command exits with "Ultrareview cancelled." (bundle.js:+12386485).

The `tengu_review_overage_dialog_shown` event is emitted when the dialog is displayed (+12386195), and `tengu_review_overage_blocked` is emitted when the overall session is blocked by policy (+12385858).

Analysis basis: CC v2.1.186 bundle.js:+9045522, +9045615, +12386195

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_review_remote_precondition_failed` | Fired for every precondition check failure (git repo, remote URL, diff size, etc.) — bundle.js:+12347456 |
| Telemetry: `tengu_review_overage_blocked` | Fired when org policy blocks the command — bundle.js:+12385858 |
| Telemetry: `tengu_review_overage_dialog_shown` | Fired when cost-confirmation dialog is displayed — bundle.js:+12386195 |
| Telemetry: `tengu_review_remote_teleport_failed` | Fired when teleport/session launch fails — bundle.js:+12354311 |
| Telemetry: `tengu_review_remote_launched` | Fired on successful session launch and result display — bundle.js:+12354899 |
| Telemetry: `tengu_review_bughunter_config` | Emitted with bughunter configuration details — bundle.js:+9045405 |
| Telemetry: `tengu_ccr_bundle_upload` | Emitted on each Git bundle upload attempt — bundle.js:+8576113 |
| Telemetry: `tengu_teleport_bundle_mode` | Emitted with the chosen upload mode (github/bundle/seed) — bundle.js:+8592979 |
| Telemetry: `tengu_ccr_session_link` | Emitted when a remote session link is obtained — bundle.js:+8586085 |
| Telemetry: `tengu_ccr_bundle_seed_enabled` | Emitted when seed-bundle mode is selected — bundle.js:+7203222 |
| Telemetry: `tengu_ccr_bundle_max_bytes` | Emitted with bundle size limit during repo-size check — bundle.js:+8572736 |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Fired if background process requires SIGKILL escalation — bundle.js:+17157626 |
| Telemetry: `tengu_bg_spare_claim` | Emitted when a spare background slot is claimed — bundle.js:+17159052 |
| Telemetry: `tengu_bg_spare_enable` | Emitted when spare-slot mode activates — bundle.js:+17158924 |
| Telemetry: `tengu_bg_sendclaim_failed` | Emitted if the claim message to the daemon fails — bundle.js:+17133905 |
| Network: preflight API | HTTP GET `/v1/ultrareview/preflight` with `teleport-org` header |
| Network: session create | HTTP POST to remote session endpoint with `anthropic-beta: ccr-byoc-2025-07-29` header |
| Network: session poll | Periodic GET to `remote-workflow` endpoint until terminal state |
| Git operations | `rev-parse --is-inside-work-tree`, `config --get remote.origin.url`, `count-objects -v`, `diff --shortstat`, `merge-base`, `symbolic-ref`, `stash create`, `for-each-ref`, `bundle create` |
| File system | Writes git bundle to `.claude/` directory (+4918418); uploads bundle file; cleans up on exit |
| Process | May spawn background daemon subprocesses for session management (`lV.spawn` at +17159381) |
| `appState` changes | Registers active remote session; updates session roster entry (`t.rosterEntry` at +17165231) |
| Cancellation | Listens for abort signal; emits "Ultrareview cancelled." on user cancel (+12386485) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.186 | Initial analysis |

---

## Common Mistakes

1. **Not authenticated with Claude.ai**: `/ultrareview` requires a Claude.ai OAuth login, not just an `ANTHROPIC_API_KEY`. Running without `/login` produces: "Ultrareview requires a Claude.ai account. Run /login to authenticate."
2. **No GitHub remote configured**: The command requires a `github.com` remote (`git remote add origin REPO_URL`). SSH or HTTPS remotes to other hosts are rejected with `no_github_remote`.
3. **Invoking on an Anthropic internal monorepo**: Repositories with `anthropics` or `anthropic` in the remote URL are blocked (`monorepo_blocked`).
4. **Diff too large**: The PR must have fewer than 5,000 changed lines. Extremely large branches will be rejected with `pr_diff_too_large` or `local_diff_too_large`.
5. **Organization policy disabled**: If your org admin has set `allow_remote_sessions: false`, the command exits immediately. Contact your org admin to enable cloud sessions.
6. **Essential-traffic-only mode**: Running in a network environment with essential-traffic-only restrictions blocks the command since it must reach external Anthropic endpoints.
7. **Empty diff**: If the current branch has no changes relative to the base branch, the command fails with `empty_diff`. Commit some changes before running `/ultrareview`.
8. **Expecting fast results**: The review runs remotely and takes approximately 10–20 minutes. Do not cancel the process expecting immediate output.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `pmf` | Main async handler for `/ultrareview` (entry point, resolved via Arbor `module_id`) |
| `Js` | Policy/first-party validation check helper |
| `cEi` | Organization configuration accessor |
| `Xz` | Configuration field reader / org-type resolver |
| `C2` | Provider type classifier (firstParty, enterprise, team) |
| `qRt` | Settings file reader (utf-8) |
| `Mme` | Feature-flag membership check (includes, some) |
| `Ki` | Telemetry/network identifier resolver |
| `ins` | String conversion utility |
| `ot` | Core string-to-identifier coercion |
| `Sme` | Secondary string coercion |
| `Ts` | CLI error reporter (console.error + process.exit) |
| `X8e` | Red-coloured terminal error formatter |
| `sT` | Error log file writer (Dre.writeFileSync) |
| `ULl` | Flag parser and initial precondition checks (fix/comment flags, git repo, remote URL) |
| `c7n` | Argument tokenizer (trim, split, replace) |
| `fw` | Shell-escape replacement helper |
| `ULo` | Full precondition pipeline (git checks, diff size, repo size, base ref) |
| `Jit` | Git work-tree detection runner |
| `Ot` | Async shell command executor |
| `hrn` | AsyncLocalStorage store reader |
| `gr` | Global logger accessor |
| `$r` | Process spawner / child process runner |
| `R1e` | Child process lifecycle manager |
| `iO` | Git remote URL cache and fetcher |
| `FK` | Remote URL cache lookup |
| `Xrn` | foe-map (cache) getter |
| `S7e` | URL credential redactor (`://***@`) |
| `moe` | Git remote URL parser |
| `Nss` | URL split/includes checker |
| `E7e` | HTTPS scheme validator |
| `fi` | URL slice/indexOf helper |
| `On` | GitHub CLI runner (`gh pr view`) |
| `f` | Background session process manager (spawn, kill, status tracking) |
| `D` | Daemon session orchestrator (scheduled tasks, process table) |
| `grt` | Roster/state file reader |
| `d` | Daemon write/config-reload handler |
| `_Q` | Config file change detector |
| `NPt` | Session state directory writer |
| `PBi` | Session filter helper |
| `H` | Buffer/stream accumulator |
| `u` | Daemon stop controller |
| `x` | Session message writer / mtime watcher |
| `g` | Request map with timeout |
| `Mdc` | Session status message formatter |
| `uae` | Session roster update helper |
| `Bn` | Timed abort controller |
| `xe` | Feature-sad signal emitter |
| `Pe` | KVe-based feature signal helper |
| `ke` | Feature-ok signal emitter |
| `IXn` | macOS memory check |
| `it` | Tool-use session state tracker |
| `D2e` | pins.json reader / file lstat helper |
| `dDt` | Path joiner for pins file |
| `Bt` | JSON.parse wrapper |
| `kn` | Error code extractor (`mn`) |
| `YTd` | Recursive directory file lister |
| `N` | Permission policy resolver (allow/deny/warn/classify/ask) |
| `Zut` | Ado/y9t-based permission checker |
| `J5` | Tool-use permission gate (zc, bit, IA, ot) |
| `$Bo` | Background session claim sender (Unix socket) |
| `MOo` | Session claim file writer |
| `pYf` | Send-claim timeout/retry handler |
| `dYf` | Claim frame builder |
| `Jd` | Error message normalizer |
| `Ae` | String coercion (String()) |
| `gR` | Binary frame encoder (Buffer, UInt32BE, UInt8) |
| `KBo` | Background session lifecycle manager (spawn, roster, cleanup) |
| `ec` | Path helper for session working directory |
| `Oi` | File watcher / state reader with lstat |
| `fg` | Session active-state setter |
| `ive` | Diff/patch parser (startsWith, indexOf, slice) |
| `kd` | Session ordering helper (Tm, ly) |
| `jmt` | Session result poller (Date.now, Cnf, catch) |
| `QWt` | Path builder (Wh.join + XWt) |
| `dye` | WWe path builder |
| `yR` | pHl error-result accessor |
| `nN` | Session notification writer (Kt, RIo, Wh, zmt) |
| `rM` | Late-result handler (pHl) |
| `JWt` | Session dir path builder |
| `kdo` | Cost/estimate formatter (a6e, Number.isFinite, Math.floor) |
| `a6e` | Tool-tracking session getter (it) |
| `y` | Locale-aware number formatter |
| `v5e` | Teammate mailbox reader |
| `I5e` | Mailbox file path builder |
| `Bg` | ERr / Object.assign object merger |
| `XHe` | Mailbox mark-as-read writer |
| `Wn` | Simple passthrough/identity wrapper |
| `mut` | Mailbox filter helper |
| `Xs` | AsyncLocalStorage (bUu) store reader |
| `De` | JSON.stringify wrapper |
| `LNa` | Git object-count runner (count-objects -v) |
| `wNa` | Git count-objects spawner ($r, po, Number) |
| `vNa` | Count-objects result parser (it) |
| `JR` | Default branch resolver (symbolic-ref, main, master, show-ref) |
| `ayr` | foe-map branch getter |
| `E_` | Current branch getter (branch --abbrev-ref HEAD) |
| `syr` | foe-map current-branch getter |
| `PBn` | Diff stat parser (e.match, parseInt) |
| `FLo` | Preflight gate (PLl + l6e) |
| `PLl` | Preflight API caller (/v1/ultrareview/preflight, status routing) |
| `PLo` | Preflight response status router |
| `Mt` | W+Pe UI component helper |
| `l6e` | Cost-estimate formatter (a6e) |
| `Hdt` | App context / subscription type loader (n0, bIe) |
| `n0` | App root context reader |
| `bIe` | Subscription-type checker (pc, yo) |
| `pc` | Billing plan resolver (ny, wt) |
| `ny` | API key / plan type reader |
| `wt` | Session context timer / plan gate |
| `yo` | Subscription type mapper (ny, l2, Gs) |
| `l2` | Array includes checker |
| `nb` | Plan+role gate (yo, Di, wt) |
| `Di` | Role classifier (ALr, SLr, ny, Gs) |
| `ALr` | Admin role checker |
| `SLr` | Secondary role checker |
| `bte` | Cost estimate accessor (a6e) |
| `dmf` | Remote-session UI orchestrator ($Lo, n, umf) |
| `$Lo` | Full teleport UI component (Xle, R5, KHe, Jle) |
| `Xle` | Cloud eligibility checker (lha) |
| `lha` | Background remote eligibility runner (Js, Mt, iO, Jit, Ot, HU) |
| `I` | Scroll/layout calculation helper |
| `A` | Math.min/max bounded value helper |
| `cte` | Session environment selector |
| `N3a` | Additional cost formatter (a6e) |
| `R5` | Teleport-to-remote session creator (full pipeline) |
| `Nl` | Branch name formatter |
| `wh` | Token refresh helper (I_n) |
| `W2n` | Session status formatter (Gs, ot, GG) |
| `c2` | Session request builder (wt, Gs, qC, lTe) |
| `ks` | OAuth environment URL resolver (local/staging/prod) |
| `KE` | HTTP header builder (Content-Type, anthropic-version) |
| `jlo` | Git bundle uploader (teleport_git_bundle_upload flow) |
| `Rt` | GL-based logger |
| `RNa` | Remote task ID generator (randomUUID, Lr, oet) |
| `mFt` | Session payload builder |
| `ne` | ee/te/A/v UI render helper |
| `kNa` | Session link UI component (W, Pe, Jm, hA, wt) |
| `yDn` | Phase logger ("[teleport] phase: ...") |
| `Nee` | Environment list fetcher (teleport_environments_list) |
| `Xit` | Default environment creator (teleport_default_environment_create) |
| `kIp` | Task description generator (teleport_generate_title) |
| `HU` | Tool-permission hook registrar |
| `b9e` | GitHub App install checker (checkGithubAppInstalled) |
| `_s` | Cancellation / abort state manager |
| `K` | Terminal output writer (X.write, H.write) |
| `se` | Result formatter (K.trim, f, a, $, U) |
| `ao` | Error string coercer |
| `H_` | Cancel-check helper |
| `WH` | Warning display helper |
| `KHe` | Remote agent session monitor (wB, Qct, iC, PNa) |
| `wB` | Random bytes generator (I9l.randomBytes) |
| `Qct` | Session open helper (LJn, gDo, mm, Une.open) |
| `iC` | Session pending-state initializer |
| `FIp` | Status formatter (rco, T, String) |
| `PNa` | Remote session poller (full poll loop, 1800000ms timeout) |
| `Jle` | CLI output renderer (dy) |
| `dy` | Text renderer (to, r, Cjr) |
| `umf` | Session map transformer (e.map) |
| `NLo` | Cancellation / cleanup hook |