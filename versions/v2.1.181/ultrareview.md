---
type: feature-spec
feature: "ultrareview"
cc_version: "2.1.181"
updated: "2026-06-19"
tags: ["ultrareview", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.181 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultrareview`

> Analysis basis: CC v2.1.181 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.181

---

## Overview

`/ultrareview` dispatches a cloud-hosted agent (running in Claude Code on the web) that finds and verifies bugs across the current Git branch. The command performs a multi-stage preflight check — validating organization policy, authentication, Git state, and cost eligibility — before uploading a Git bundle to Anthropic's remote infrastructure and streaming results back to the local terminal. The estimated cost is $10–$20 USD per run, with a typical runtime of approximately 10–20 minutes.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultrareview` |
| description | `"Start a cloud agent that finds and verifies bugs in your branch ( … , … USD) · Runs in Claude Code on the web. See …"` |
| module_id | `kyl` |
| load_inline | `true` |
| loc_byte | `12481585` |
| loc_byte_end | `12481856` |
| loc_line | `8060` |
| arbor_handler.name | `Dtf` |
| arbor_handler.fqn | `claude-2.1.181::Dtf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.181 bundle.js:+12481585

---

## Input Branching

The command follows more than three distinct paths depending on policy flags, authentication state, Git status, and a cost-confirmation dialog. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/ultrareview invoked"] --> B{allow_remote_sessions policy?}
    B -- disabled --> C["Error: Cloud sessions disabled by org policy\ntelemetry: tengu_review_remote_precondition_failed"]
    B -- enabled --> D{Essential-traffic-only mode?}
    D -- yes --> E["Error: Ultrareview unavailable in essential-traffic-only mode"]
    D -- no --> F{Data-residency / third-party provider?}
    F -- zdr / data-residency provider --> G["Error: Ultrareview unavailable on third-party providers"]
    F -- first-party --> H{OAuth token present?}
    H -- no --> I["Error: Requires Claude.ai account — run /login\ntelemetry: tengu_review_remote_precondition_failed"]
    H -- yes --> J["Call /v1/ultrareview/preflight API\ntelemetry: api_ultrareview_preflight"]
    J --> K{Preflight response status?}
    K -- schema_mismatch --> L["Error: schema mismatch"]
    K -- request_failed --> M["Error: request failed"]
    K -- server: unavailable --> N["Error: Ultrareview unavailable for your org"]
    K -- needs-confirm --> O["Show cost-confirmation dialog\n($10–$20 USD, ~10–20 min)\ntelemetry: tengu_review_overage_dialog_shown"]
    K -- proceed --> P["Check Git preconditions via checkRemoteEligibility"]
    O --> O2{User confirms?}
    O2 -- no --> Z["Cancelled: 'Ultrareview cancelled.'"]
    O2 -- yes --> P
    P --> Q{Git repo present?}
    Q -- no --> R["Error: not_in_git_repo\ntelemetry: tengu_review_remote_precondition_failed"]
    Q -- yes --> S{Git remote (GitHub) URL found?}
    S -- no --> T["Error: no_git_remote / no_github_remote\ntelemetry: tengu_review_remote_precondition_failed"]
    S -- yes --> U{Overage/budget check passes?}
    U -- blocked --> V["Error: overage blocked\ntelemetry: tengu_review_overage_blocked"]
    U -- ok --> W["Upload Git bundle → teleportToRemote\ntelemetry: tengu_teleport_bundle_mode, tengu_ccr_bundle_upload"]
    W --> X{Upload outcome?}
    X -- failed --> Y["Error: Ultrareview failed to launch\ntelemetry: tengu_review_remote_teleport_failed"]
    X -- success --> AA["Stream remote-agent session\ntelemetry: tengu_review_remote_launched"]
    AA --> AB{Session result?}
    AB -- completed --> AC["Display findings; apply fixes if --fix passed"]
    AB -- error / timeout --> AD["Error: cloud session returned an error / exceeded 30 min"]
    AB -- no output --> AE["Error: no review output — orchestrator may have exited early"]
```

---

## Behavioral Spec

### 1. Entry Point — Handler `Dtf`

The top-level async handler (Arbor-resolved as `Dtf`, module `kyl`) orchestrates the entire command.

Analysis basis: CC v2.1.181 bundle.js:+12479240

```
async function ultrareviewHandler(context):
    // 1. Policy guard
    if not context.appState.allow_remote_sessions:
        emit telemetry("tengu_review_remote_precondition_failed")
        return error("Cloud sessions are disabled by your organization's policy. Contact your organization admin to enable them.")

    // 2. Jitter delay (Math.random * 2 seconds) before preflight
    await jitterDelay()   // ~0–2 s random back-off

    // 3. Gather branch-level Git stats (myl)
    branchStats = await gatherBranchStats(context)

    // 4. Build PR metadata (Mbo)
    prMeta = await buildPRMetadata(context)

    // 5. Preflight check via remote API (Rbo → dyl)
    preflight = await callPreflightAPI(context)
    if preflight.status != "proceed" and != "needs-confirm":
        return handlePreflightError(preflight)

    // 6. Overage confirmation dialog if required
    if preflight.status == "needs-confirm":
        emit telemetry("tengu_review_overage_dialog_shown")
        confirmed = await showCostDialog()
        if not confirmed:
            return message("Ultrareview cancelled.")

    // 7. Budget / overage block (j)
    if overageLimitExceeded(context):
        emit telemetry("tengu_review_overage_blocked")
        return

    // 8. Cloud agent launch (ktf → Pbo → teleportToRemote)
    result = await launchCloudAgent(context, branchStats, prMeta)
    if result.error:
        emit telemetry("tengu_review_remote_teleport_failed")
        return error("Ultrareview failed to launch the cloud session. Check that this is a GitHub repo and try again.")

    // 9. Post-launch rendering (Dbo)
    renderResults(result)
```

### 2. Branch Stats Gathering — `gatherBranchStats` (maps to `myl` / `YWn`)

Collects changed-file statistics for the current branch to present in the review context.

Analysis basis: CC v2.1.181 bundle.js:+12441297

```
async function gatherBranchStats(context):
    raw = trimAndSplit(context.branchDiff)
    normalized = applyEscapeReplacement(raw)   // escapes special chars with '\$&'
    tags = new Set()
    if normalized includes "fix":   tags.add("fix")
    if normalized includes "comment": tags.add("comment")
    // Cross-reference against /code-review ultra history (loc_byte 12441389)
    return { tags, normalized }
```

### 3. PR Metadata Builder — `buildPRMetadata` (maps to `Mbo`)

Fetches pull-request metadata using the `gh` CLI and local Git commands, then validates the repository is within an allowed GitHub organization.

Analysis basis: CC v2.1.181 bundle.js:+12441421

```
async function buildPRMetadata(context):
    // 3a. Verify git repo (Yot → git rev-parse --is-inside-work-tree)
    isRepo = await runGit(["rev-parse", "--is-inside-work-tree"])
    if not isRepo: return { error: "not_in_git_repo" }

    // 3b. Resolve remote URL (UO → git config --get remote.origin.url)
    remoteUrl = await getRemoteUrl()
    if not remoteUrl: return { error: "no_git_remote", msg: "No git remote URL found" }
    remoteUrl = sanitizeCredentials(remoteUrl)   // masks '://***@' patterns

    // 3c. Org allowlist check: host must be github.com;
    //     owner must match "anthropics" or "anthropic" prefix
    //     (literals at loc_byte 12442139, 12442177, 12442214)

    // 3d. Fetch PR stats via gh CLI
    //     gh pr view --repo REPO --json additions,deletions,changedFiles
    //     timeout: 5000 ms (loc_byte 12442628)
    prJson = await runGhCLI(["pr", "view", "--repo", repo,
                              "--json", "additions,deletions,changedFiles"])
    stats = parseJSON(prJson)

    // 3e. Git object-count check (Z0a → git count-objects -v)
    //     Limit: 5,000,000 objects (loc_byte 8545229)
    objectCount = await countGitObjects()
    if objectCount > 5_000_000: return { error: "too_large" }

    // 3f. Merge-base computation (git merge-base ...)
    mergeBase = await runGit(["merge-base", defaultBranch, "HEAD"])

    // 3g. Diff shortstat (git diff --shortstat MERGE_BASE)
    shortstat = await runGit(["diff", "--shortstat", mergeBase])

    return { remoteUrl, prStats: stats, mergeBase, shortstat }
```

### 4. Preflight API Call — `callPreflightAPI` (maps to `Rbo` / `dyl`)

Calls the server-side eligibility endpoint and interprets the structured response.

Analysis basis: CC v2.1.181 bundle.js:+12439773

```
async function callPreflightAPI(context):
    // Endpoint: POST /v1/ultrareview/preflight (loc_byte 12439773)
    response = await httpPost("/v1/ultrareview/preflight", {
        teleport_org: context.orgId,   // header: teleport-org
    })

    // Guard: essential-traffic-only mode (loc_byte 12439867, 12439903)
    if trafficMode == "essential-traffic-only":
        return error("Ultrareview runs in Claude Code on the web and is unavailable when essential-traffic-only mode is active.")

    // Guard: third-party / data-residency provider (loc_byte 12440011, 12440022, 12440050)
    if provider == "zdr" or "data-residency":
        return error("Ultrareview runs in Claude Code on the web and is unavailable on third-party providers.")

    // Guard: no OAuth token (loc_byte 12440162, 12440183, 12440255)
    if not oauthToken:
        emit telemetry("api_ultrareview_preflight", { reason: "no_oauth_token" })
        return error("Ultrareview requires a Claude.ai account. Run /login to authenticate.")

    // Emit preflight telemetry
    emit telemetry("api_ultrareview_preflight",
                   { result: response.status })   // loc_byte 12440394

    // Interpret schema_mismatch / request_failed (loc_bytes 12440422, 12440583)
    if response.status == "schema_mismatch": return { error: "schema_mismatch" }
    if response.status == "request_failed":  return { error: "request_failed" }

    // Server-side block (loc_byte 12445165)
    if response.status == "server" and response.available == false:
        return error("Ultrareview is unavailable for your organization.")

    // needs-confirm or proceed
    return response   // status: "needs-confirm" | "proceed"
```

### 5. Cloud Agent Launch — `launchCloudAgent` (maps to `ktf` / `Pbo`)

Performs remote-eligibility pre-checks, uploads a Git bundle, and spawns the cloud session.

Analysis basis: CC v2.1.181 bundle.js:+12478688

```
async function launchCloudAgent(context, branchStats, prMeta):
    // 5a. Remote eligibility (Vle → qaa)
    //     Checks: policy_blocked, not_logged_in, byoc, not_in_git_repo,
    //             no_git_remote, github_app_not_installed
    //     Seed-bundle flag: tengu_ccr_bundle_seed_enabled
    eligibility = await checkRemoteEligibility(context)
    if eligibility.blocked:
        return { error: eligibility.reason }

    // 5b. Cloud environment selection (a6)
    //     Policy checks:
    //       - First-party provider required (loc_byte 8563515)
    //       - Claude.ai login required (loc_byte 8563658)
    //       - Organization UUID required (loc_byte 8564006)
    //     Beta header sent: ccr-byoc-2025-07-29 (loc_byte 8564425)
    env = await selectCloudEnvironment(context)

    // 5c. Git bundle upload (jro → teleportGitBundleUpload)
    //     Bundle modes: head, fallback_head, squashed, fallback_squashed
    //     Max size enforced (tengu_ccr_bundle_max_bytes)
    //     Upload timeout: 200 ms claim window; 500 ms retry (loc_bytes 8548604, 17078491)
    bundleResult = await uploadGitBundle(context, env)
    emit telemetry("tengu_ccr_bundle_upload", { result: bundleResult.status })

    // 5d. Session POST (a6 → ho.post)
    //     Cost range: $10–$20 USD (loc_byte 8881928)
    //     Duration estimate: ~10–20 min (loc_byte 8882021)
    //     Environment env_011111111111111111111113 used for test/staging (loc_byte 12446322)
    //     Polling parameters: min 5 s, max 25 s, session timeout 600–1800 s
    //       (loc_bytes 12446556, 12446622, 12446685, 12446689)
    //     Session link telemetry: tengu_ccr_session_link
    sessionId = await createRemoteSession(env, bundleResult, context)
    emit telemetry("tengu_review_remote_launched")

    // 5e. Stream session results (Tge → ska)
    //     Session max wall-time: 1,800,000 ms = 30 min (loc_byte 8584532)
    //     Polls for: running → completed / archived / error
    //     Emits hook_progress, hook_response, hook_started events
    result = await streamRemoteSession(sessionId)
    return result
```

### 6. Result Rendering and Fix Application — `renderResults` (maps to `Dbo`)

Processes findings returned by the cloud session and optionally applies patches.

Analysis basis: CC v2.1.181 bundle.js:+12480197

```
function renderResults(sessionResult):
    if sessionResult.status == "error":
        display("cloud session returned an error")
        return

    if sessionResult.timedOut:
        display("cloud session exceeded 30 minutes")
        return

    if sessionResult.output is empty:
        display("no review output — orchestrator may have exited early")
        return

    // Display findings as assistant messages
    for finding in sessionResult.findings:
        renderAsAssistantMessage(finding)   // role: "assistant" (loc_byte 8584803)

    // If --fix flag was passed (loc_byte 12478979):
    //   " The user passed --fix: when the findings arrive, apply them to the local working tree."
    if context.flags.fix:
        applyFindingsToWorkingTree(sessionResult.findings)
```

### 7. Git Remote-Eligibility Check — `checkRemoteEligibility` (maps to `qaa` / `Vle`)

Validates all preconditions required to run a remote cloud session, emitting structured telemetry for each failure reason.

Analysis basis: CC v2.1.181 bundle.js:+7175423

```
async function checkRemoteEligibility(context):
    // policy_blocked: org policy denies remote sessions
    if policy.denied:
        emit telemetry("tengu_review_remote_precondition_failed", { reason: "policy_blocked" })
        return blocked("policy_blocked")

    // not_logged_in: no OAuth credentials
    if not oauthToken:
        emit telemetry("tengu_review_remote_precondition_failed", { reason: "not_logged_in" })
        return blocked("not_logged_in")

    // byoc: bring-your-own-cloud provider detected
    if provider == "byoc":
        emit telemetry("tengu_review_remote_precondition_failed", { reason: "byoc" })
        return blocked("byoc", msg: "Please run /login and sign in with your Claude.ai account (not Console).")

    // not_in_git_repo: git rev-parse fails
    if not inGitRepo:
        emit telemetry("tengu_review_remote_precondition_failed", { reason: "not_in_git_repo" })
        return blocked("not_in_git_repo")

    // no_git_remote: no GitHub-compatible remote
    if not githubRemote:
        emit telemetry("tengu_review_remote_precondition_failed", { reason: "no_git_remote" })
        return blocked("no_git_remote",
                       msg: "Cloud agents require a GitHub remote. Add one with `git remote add origin REPO_URL`.")

    // github_app_not_installed: checked via ZBe → /v1/... GitHub app endpoint
    if not githubAppInstalled:
        emit telemetry("tengu_review_remote_precondition_failed", { reason: "github_app_not_installed" })
        return blocked("github_app_not_installed")

    return eligible()
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_review_remote_precondition_failed` | Fired on each category of pre-launch failure (policy, auth, git, etc.) |
| Telemetry: `tengu_review_overage_blocked` | Fired when the cost cap prevents launch |
| Telemetry: `tengu_review_overage_dialog_shown` | Fired when the cost-confirmation dialog is presented to the user |
| Telemetry: `api_ultrareview_preflight` | Fired after the `/v1/ultrareview/preflight` call completes, including schema/request-failure sub-reasons |
| Telemetry: `tengu_ccr_bundle_seed_enabled` | Fired when seed-bundle mode is active for the branch |
| Telemetry: `tengu_ccr_bundle_upload` | Fired after the Git bundle upload attempt (success or failure) |
| Telemetry: `tengu_ccr_bundle_max_bytes` | Fired to record the maximum bundle size threshold |
| Telemetry: `tengu_ccr_session_link` | Fired when the cloud session link is established |
| Telemetry: `tengu_teleport_bundle_mode` | Records the bundle strategy chosen (head / squashed / fallback variants) |
| Telemetry: `tengu_teleport_source_decision` | Records the source-code decision path taken |
| Telemetry: `tengu_review_remote_teleport_failed` | Fired when the teleport/upload phase fails |
| Telemetry: `tengu_review_remote_launched` | Fired on successful cloud session creation |
| Telemetry: `tengu_review_bughunter_config` | Records bughunter configuration parameters before launch |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Fired if background agent requires SIGKILL escalation |
| Telemetry: `tengu_bg_spare_enable` / `tengu_bg_spare_claim` / `tengu_bg_spare_claim_fail` | Background spare-agent lifecycle events |
| Telemetry: `tengu_bg_sendclaim_failed` | Fired when a background session claim message fails to send |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` | Feature gate result signals |
| Telemetry: `tengu_daemon_config_reload` / `tengu_daemon_control` | Daemon lifecycle signals |
| Telemetry: `tengu_scheduled_task_missed` | Fired when a scheduled background task is skipped |
| Telemetry: `tengu_bg_low_mem_mb` / `tengu_bg_dispatch_low_mem` | Memory-pressure signals affecting dispatch |
| Network I/O | POST `/v1/ultrareview/preflight`; Git bundle upload to Anthropic's remote infrastructure; cloud session polling |
| Git side effects | Reads remote URL, object count, merge-base, diff shortstat; creates temporary bundle file (`.bundle`); may create `refs/seed/stash` and `refs/seed/root` refs temporarily |
| File system | Reads/writes under `.claude/` directory; writes session roster and claim files |
| Process spawning | Runs `git`, `gh` CLI subprocesses; may spawn daemon background processes |
| appState changes | Session state progresses through: `pending → running → completed / archived / error` |
| Cost | Estimated $10–$20 USD per run (bundle.js:+8881928) |
| Session timeout | Hard limit: 1,800,000 ms (30 minutes) (bundle.js:+8584532) |
| Fix flag | When `--fix` is passed, approved findings are applied to the local working tree after the session completes (bundle.js:+12478979) |
| Cancellation | Typing cancel at the cost-confirmation prompt produces `"Ultrareview cancelled."` (bundle.js:+12480219) |
| Admin settings URL | Organization policy can be adjusted at `/admin-settings/` (bundle.js:+12479696) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.181 | Initial analysis |

---

## Common Mistakes

1. **Running outside a GitHub-backed repository.** The command requires a `git remote` pointing to `github.com`. Repositories with no remote, or remotes on GitHub Enterprise Server without the GitHub App installed, will fail with `no_git_remote` or `github_app_not_installed`.
2. **Using an API key instead of a Claude.ai OAuth login.** `/ultrareview` requires OAuth authentication (`/login`), not just an `ANTHROPIC_API_KEY`. Pure API-key sessions produce a `not_logged_in` or `no_access_token` error.
3. **Organization policy blocking remote sessions.** If `allow_remote_sessions` is disabled in the org settings, the command fails immediately. An admin must enable it at the `/admin-settings/` URL.
4. **Running in essential-traffic-only or data-residency mode.** Both modes prevent the command from reaching Anthropic's cloud infrastructure; the error message names the active mode.
5. **Expecting instant results.** The typical runtime is 10–20 minutes. The session has a hard 30-minute wall-clock timeout; no output is produced if the orchestrator exits early.
6. **Forgetting `--fix` before reviewing findings.** The patch-application step only fires when `--fix` is passed at invocation time; findings cannot be retroactively applied without re-running the command.
7. **Repository size limits.** Repositories exceeding approximately 5,000,000 git objects will be rejected (`too_large`) before the bundle upload begins (bundle.js:+8545229).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Dtf` | Top-level async handler for `/ultrareview` (Arbor-resolved entry point) |
| `ii` | Remote-session eligibility router |
| `Xfi` | First-party provider check wrapper |
| `dz` | Provider / plan context resolver |
| `tB` | Plan-type classifier (firstParty, enterprise, team, etc.) |
| `cxt` | Config file reader (readFileSync, utf-8) |
| `Ame` | Permission / allow-product-feedback checker |
| `ta` | Traffic-mode resolver |
| `qYo` | Traffic-mode string mapper |
| `rt` | String coercion utility |
| `rme` | Error message formatter |
| `Ps` | CLI error writer and process-exit handler |
| `eje` | Console error emitter with red formatting |
| `JT` | Error log file writer |
| `myl` | Branch stats gatherer |
| `YWn` | Branch diff normalizer (trim / split / replace) |
| `j0` | Special-character escape helper |
| `o` | Pad-and-map string utility |
| `a` | MCP connection orchestrator |
| `DBe` | MCP server connection builder |
| `bQn` | MCP update applicator |
| `I` | Git/environment info formatter |
| `l` | Connection list utility |
| `kOo` | MCP client-map builder |
| `Mbo` | PR metadata builder |
| `Yot` | Git work-tree verifier |
| `Mt` | Async-storage context getter |
| `cen` | Local storage store accessor |
| `gr` | Config file path resolver |
| `Vr` | Git command runner |
| `LOe` | Git subprocess spawner |
| `p` | Forced-shutdown / process-exit guard |
| `qzc` | Git stderr string converter |
| `Wzc` | STDIO-maxbuffer error handler |
| `ke` | Git command error logger |
| `UO` | Remote URL cache manager |
| `tK` | Remote URL cache key resolver |
| `qen` | Remote URL store getter |
| `SKe` | Credential masker (`://***@`) |
| `ioe` | Remote URL parser |
| `TZo` | Range-ref (`..`) splitter |
| `EKe` | Ref-format validator |
| `Li` | URL path slicer |
| `Un` | Git command queue runner |
| `f` | Background daemon session manager |
| `M` | Daemon process lifecycle controller |
| `mtt` | Daemon config file reader |
| `d` | Daemon supervisor writer |
| `hQ` | Daemon connection-factory wrapper |
| `oMt` | Daemon config directory writer |
| `qOi` | Daemon file filter |
| `g` | Buffer/stream line splitter |
| `u` | Daemon stop controller |
| `x` | Daemon mtime watcher |
| `h` | Daemon reconnect-timeout holder |
| `Lec` | Daemon log formatter |
| `tae` | Daemon tool-approval file writer |
| `Fn` | Timeout-with-abort promise wrapper |
| `c` | Abort-signal resolver |
| `Me` | Feature-sad signal emitter |
| `$e` | Feature result renderer |
| `xe` | Feature-ok signal emitter |
| `aKn` | macOS memory-usage sampler |
| `ut` | Low-memory dispatch guard |
| `H$e` | Pins-file reader/cleaner |
| `Pkt` | Pins path joiner |
| `Wt` | JSON.parse wrapper |
| `Dn` | `ENOENT` error classifier |
| `Cfd` | Directory recursive file finder |
| `F` | Permission-mode classifier (allow/deny/warn/classify/ask) |
| `Clt` | Permission orchestrator |
| `YW` | Permission UI presenter |
| `x1o` | Background session claim sender |
| `k0o` | Claim file writer |
| `c9f` | Send-claim timeout/retry handler |
| `l9f` | Claim frame builder |
| `kp` | Log-path resolver |
| `Ee` | String error formatter |
| `UM` | Binary frame encoder (UInt32BE/UInt8) |
| `O1o` | Background session orchestrator |
| `Tc` | Socket-path joiner |
| `fa` | File watcher / roster entry manager |
| `lg` | Active-session marker |
| `ECe` | Session-state parser |
| `Fp` | Session roster path builder |
| `Mpt` | Session completion poller |
| `l6t` | Error-state path builder |
| `NHe` | Late-state path builder |
| `oD` | Error-log writer |
| `PN` | Session-claim directory preparer |
| `jM` | Late-log writer |
| `a6t` | Claim directory path builder |
| `gso` | Cost formatter (Number.isFinite, Math.floor) |
| `S4e` | Token-usage sampler |
| `H` | Locale-string formatter |
| `t4e` | Mailbox session manager |
| `Z9e` | Mailbox file path resolver |
| `Fg` | Object-assign config merger |
| `Cge` | Mailbox reader with lock |
| `qn` | Generic identity/pass-through |
| `oi` | AsyncLocalStorage getter |
| `Re` | JSON.stringify wrapper |
| `Z0a` | Git object-count checker |
| `Q0a` | Object-count command runner |
| `J0a` | Object-count token sampler |
| `FO` | Default-branch resolver (symbolic-ref) |
| `Amr` | Default-branch store getter |
| `Vy` | Current-branch resolver (--abbrev-ref HEAD) |
| `fmr` | Current-branch store getter |
| `H2n` | Shortstat parser (match / parseInt) |
| `Rbo` | Preflight response interpreter |
| `dyl` | Preflight HTTP caller (`/v1/ultrareview/preflight`) |
| `xbo` | Preflight error classifier |
| `Ut` | Feature-sad renderer |
| `b4e` | Cost-range token sampler |
| `Glt` | Subscription-type gate |
| `jD` | Subscription plan resolver |
| `OTe` | Plan-guard wrapper |
| `kc` | Plan type checker |
| `uy` | Auth/plan context reader |
| `It` | Plan metadata resolver |
| `To` | Plan-type membership tester |
| `U2` | Array-include helper |
| `TR` | Role + plan gate |
| `da` | Role classifier (max/pro/admin/billing/owner) |
| `hte` | Cost-estimate token sampler |
| `ktf` | Cloud agent launcher (top-level) |
| `Pbo` | Cloud session orchestrator |
| `Vle` | Remote eligibility pre-checker |
| `qaa` | Remote eligibility detailed checker |
| `E` | Math.max/min bounded value helper |
| `_` | Promise.all multi-permission checker |
| `ste` | Session status formatter |
| `gRa` | Cost-range token sampler (variant) |
| `a6` | Cloud session creator (teleportToRemote) |
| `Ac` | Context/provider reader |
| `Ch` | API header builder |
| `TUn` | Session token formatter |
| `F2` | Session creation request builder |
| `ks` | OAuth endpoint validator |
| `jE` | HTTP client (Gw/axios wrapper) |
| `jro` | Git bundle uploader (teleportGitBundleUpload) |
| `Lt` | Config file path resolver (variant) |
| `Qe` | Feature-result JSX renderer |
| `tka` | Control-request event builder |
| `U1t` | Object-key presence checker |
| `ne` | UI element composer |
| `eka` | Session-link JSX renderer |
| `ckn` | GitHub-app install checker helper |
| `Ree` | Environment lister (teleport_environments_list) |
| `zot` | Default environment creator (teleport_default_environment_create) |
| `Qfp` | Title generator (teleport_generate_title) |
| `YU` | Background task tracker |
| `ZBe` | GitHub App install verifier |
| `Ns` | Network utility (xK/gs/Ug) |
| `V` | stdout/stderr writer |
| `re` | Result formatter |
| `Ho` | Error-to-string converter |
| `AH` | Axios-cancel checker |
| `KH` | Network-error classifier |
| `Tge` | Remote-agent session streamer |
| `XB` | Random-bytes generator |
| `Kat` | TLS/socket opener |
| `o0` | Socket-timestamp checker |
| `amp` | Session-URL builder |
| `ska` | Session-event poller |
| `Kle` | Polling interval adjuster |
| `Ay` | Rate-limit backoff helper |
| `xtf` | Flag-map transformer |
| `Dbo` | Result renderer (post-session) |