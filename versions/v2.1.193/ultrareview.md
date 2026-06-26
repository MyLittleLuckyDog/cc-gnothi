---
type: feature-spec
feature: "ultrareview"
cc_version: "2.1.193"
updated: "2026-06-26"
tags: ["ultrareview", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.193 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultrareview`

> Analysis basis: CC v2.1.193 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.193

---

## Overview

`/ultrareview` launches a cloud-hosted agent session that autonomously finds and verifies bugs in the current git branch. It operates by running Claude Code on the web (via the "teleport" infrastructure), requires a Claude.ai OAuth account, and carries an estimated cost in the range of $10–$20 USD per run, with an expected runtime of approximately 10–20 minutes. Analysis basis: CC v2.1.193 bundle.js:+12491261

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultrareview` |
| description | `"Start a cloud agent that finds and verifies bugs in your branch ( … , … USD) · Runs in Claude Code on the web. See …"` |
| loc_byte | `12491261` |
| loc_byte_end | `12491531` |
| loc_line | `8388` |
| module_id | `L2l` |
| load_inline | `true` |
| arbor_handler.name | `lRf` |
| arbor_handler.fqn | `claude-2.1.193::lRf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.193 bundle.js:+12491261

---

## Input Branching

The command has more than three distinct pre-flight branches (not-a-git-repo, no-GitHub-remote, monorepo-blocked, remote-too-large, diff-too-large, no-OAuth-token, essential-traffic-only, third-party provider, data-residency zone, preflight API failure, overage dialog, confirm gate, diff empty, no-merge-base, base-ref-not-found, teleport failure). A flowchart is used.

```mermaid
flowchart TD
    A["/ultrareview invoked"] --> B{allow_remote_sessions enabled?}
    B -- No --> BLOCKED["Emit: Cloud sessions disabled by org policy\ntelemetry: tengu_review_remote_precondition_failed"]
    B -- Yes --> C{essential-traffic-only mode?}
    C -- Yes --> ETOnly["Emit: Ultrareview unavailable in\nessential-traffic-only mode\ntelemetry: tengu_review_remote_precondition_failed"]
    C -- No --> D{Third-party provider or\ndata-residency zone?}
    D -- Yes --> TP["Emit: unavailable on third-party providers /\ndata-residency message\ntelemetry: tengu_review_remote_precondition_failed"]
    D -- No --> E{OAuth token present?}
    E -- No --> NOAUTH["Emit: Ultrareview requires Claude.ai account.\nRun /login\ntelemetry: tengu_review_remote_precondition_failed"]
    E -- Yes --> F{Inside a git work-tree?}
    F -- No --> NOGIT["Emit: not_git_repo\ntelemetry: tengu_review_remote_precondition_failed"]
    F -- Yes --> G{GitHub remote present?}
    G -- No --> NORGHUB["Emit: no_github_remote\ntelemetry: tengu_review_remote_precondition_failed"]
    G -- Yes --> H{Anthropic-internal monorepo?}
    H -- Yes --> MONO["Emit: monorepo_blocked\ntelemetry: tengu_review_remote_precondition_failed"]
    H -- No --> I["Call /v1/ultrareview/preflight API\ntelemetry: api_ultrareview_preflight"]
    I --> J{Preflight result}
    J -- schema_mismatch --> SCHEMA["Emit: schema_mismatch error"]
    J -- request_failed --> REQFAIL["Emit: request_failed error"]
    J -- server-blocked --> SRVBLOCK["Emit: Ultrareview unavailable for your org"]
    J -- needs-confirm --> CONFIRM{User confirmed overage?}
    CONFIRM -- No --> CANCEL["Emit: Ultrareview cancelled.\ntelemetry: tengu_review_overage_dialog_shown"]
    CONFIRM -- Yes --> K
    J -- proceed --> K["Validate PR diff size\n(gh pr view --json additions,deletions,changedFiles)"]
    K --> L{PR diff too large?\n(>5000 limit)}
    L -- Yes --> PRTOOLARGE["Emit: pr_diff_too_large\ntelemetry: tengu_review_remote_precondition_failed"]
    L -- No --> M["Compute repo size\n(git count-objects -v)"]
    M --> N{Repo > 5,000,000 objects\nor bundle > 100 MB?}
    N -- Yes --> REPOTOOLARGE["Emit: repo_too_large_to_bundle\ntelemetry: tengu_review_remote_precondition_failed"]
    N -- No --> O["Resolve base ref / merge base\n(git merge-base, git diff --shortstat)"]
    O --> P{Diff empty?}
    P -- Yes --> EMPTYDIFF["Emit: empty_diff\ntelemetry: tengu_review_remote_precondition_failed"]
    P -- No --> Q{Local diff too large?}
    Q -- Yes --> LOCALARGE["Emit: local_diff_too_large\ntelemetry: tengu_review_remote_precondition_failed"]
    Q -- No --> R["Launch teleport cloud session\n(oG / teleportToRemote)\nUpload git bundle if needed"]
    R --> S{Teleport succeeded?}
    S -- No --> TELEPORTFAIL["Emit: Ultrareview failed to launch cloud session\ntelemetry: tengu_review_remote_teleport_failed"]
    S -- Yes --> T["Poll remote agent session\n(SVa / DEe)\nStream results back via JSX renderer"]
    T --> U{Poll result}
    U -- completed --> DONE["Display review findings\nApply --fix patches if requested\ntelemetry: tengu_review_remote_launched"]
    U -- poll_timeout --> TIMEOUT["Emit: poll_timeout error"]
    U -- orchestrator_error --> ORCHERR["Emit: orchestrator_error"]
    U -- session_error --> SESSERR["Emit: session_error"]
    U -- no_review_output --> NOOUT["Emit: no_review_output"]
```

---

## Behavioral Spec

### Pre-flight Gate: Remote Sessions Allowed

```
function checkRemoteSessionsAllowed(appConfig):
    if appConfig.allow_remote_sessions is False:
        emitError("Cloud sessions are disabled by your organization's policy.")
        emitTelemetry("tengu_review_remote_precondition_failed", reason="policy_blocked")
        return ABORT
    if appConfig.networkMode == "essential-traffic-only":
        emitError("Ultrareview runs in Claude Code on the web and is unavailable when essential-traffic-only mode is active.")
        emitTelemetry("tengu_review_remote_precondition_failed", reason="essential-traffic-only")
        return ABORT
    return PASS
```

Analysis basis: CC v2.1.193 bundle.js:+12488746

### Pre-flight Gate: Provider Eligibility

```
function checkProviderEligibility(authState):
    providerType = authState.providerType
    if providerType == "third_party_provider":
        emitError("Ultrareview runs in Claude Code on the web and is unavailable on third-party providers.")
        emitTelemetry("tengu_review_remote_precondition_failed", reason="not_first_party")
        return ABORT
    if providerType == "data_residency" or zoneId == "zdr":
        emitError("Ultrareview is unavailable for data-residency zones.")
        emitTelemetry("tengu_review_remote_precondition_failed", reason="data_residency")
        return ABORT
    if authState.oauthToken is missing or authState.mode == "no-auth":
        emitError("Ultrareview requires a Claude.ai account. Run /login to authenticate.")
        emitTelemetry("tengu_review_remote_precondition_failed", reason="no_oauth_token")
        return ABORT
    return PASS
```

Analysis basis: CC v2.1.193 bundle.js:+12488806 (provider check), +12488837 (no-auth message)

### Pre-flight Gate: Git Repository Checks

```
function checkGitRepo():
    if not isInsideGitWorkTree():           // git rev-parse --is-inside-work-tree
        return FAIL("not_git_repo")
    remoteUrl = getGitRemoteUrl()           // git config --get remote.origin.url
    if remoteUrl is missing:
        return FAIL("no_github_remote")
    normalizedHost = normalizeHost(remoteUrl)  // strip www., lowercase
    if normalizedHost != "github.com":
        return FAIL("no_github_remote")
    if repoOwner in ["anthropics", "anthropic"]:
        return FAIL("monorepo_blocked")
    return PASS(remoteUrl)
```

Analysis basis: CC v2.1.193 bundle.js:+12450461 (not_git_repo), +12450797 (no_github_remote), +12451181 (anthropics check), +12451292 (monorepo_blocked)

### Preflight API Call

```
async function callUltrareviewPreflight(repoUrl, accessToken):
    response = await httpPost("/v1/ultrareview/preflight",
        headers: { "teleport-org": orgId },
        body: { repository: repoUrl }
    )
    if response.status indicates schema mismatch:
        return FAIL("schema_mismatch")
    if response.status indicates request failure:
        return FAIL("request_failed")
    outcome = response.body.outcome   // "proceed" | "needs-confirm" | "server"
    return outcome
```

Estimated cost displayed to user: `$10-$20` (bundle.js:+9108738).
Estimated runtime: `~10–20 min` (bundle.js:+9108830).

If `outcome == "needs-confirm"`, an overage confirmation dialog is shown (`tengu_review_overage_dialog_shown`). If the user declines, the command emits "Ultrareview cancelled." and stops (bundle.js:+12489624). Analysis basis: CC v2.1.193 bundle.js:+12449069

### PR Diff Size Check

```
function checkPrDiffSize(remoteUrl):
    result = runCommand("gh", ["pr", "view", "--repo", remoteUrl,
                                "--json", "additions,deletions,changedFiles"])
    // Timeout: 5000 ms (bundle.js:+12451661)
    total = result.additions + result.deletions + result.changedFiles
    if total > PR_SIZE_LIMIT:       // exact threshold: bundle.js:+12451661
        return FAIL("pr_diff_too_large")
    return PASS
```

PR size command timeout: 5000 ms (bundle.js:+12451661).
Analysis basis: CC v2.1.193 bundle.js:+12451542

### Repository Bundle Size Check

```
function checkRepoBundleSize():
    countResult = runCommand("git", ["count-objects", "-v"])
    // Parses size-pack field
    objectCount = parseObjectCount(countResult)
    if objectCount > 5000000:
        return FAIL("repo_too_large_to_bundle")
    // Max bundle bytes: 100 (MB threshold), verified at bundle.js:+8779876 / +8779895
    bundleSizeEstimate = estimateBundleSize(objectCount)
    if bundleSizeEstimate > MAX_BUNDLE_BYTES:
        emitTelemetry("tengu_ccr_bundle_max_bytes")
        return FAIL("repo_too_large_to_bundle")
    return PASS
```

Object count threshold: 5,000,000 (bundle.js:+8779895). Bundle size upper limit: 100 MB cap (bundle.js:+8779876). Analysis basis: CC v2.1.193 bundle.js:+12452298

### Base Ref / Diff Resolution

```
function resolveBaseRefAndDiff(remoteBranch):
    baseRef = resolveBaseRef(remoteBranch)
    // Attempts: git symbolic-ref --short refs/remotes/origin/HEAD
    // Fallbacks: "main", "master", then git show-ref
    if baseRef is missing:
        return FAIL("base_ref_not_found")

    mergeBase = runCommand("git", ["merge-base", currentBranch, baseRef])
    if mergeBase is missing:
        return FAIL("no_merge_base")

    diffStat = runCommand("git", ["diff", "--shortstat", mergeBase])
    if diffStat is empty:
        return FAIL("empty_diff")
    if parsedChanges > LOCAL_DIFF_LIMIT:
        return FAIL("local_diff_too_large")
    return PASS(mergeBase, diffStat)
```

Default branch fallbacks tried in order: `"main"`, `"master"` (bundle.js:+1169083, +1169090). Analysis basis: CC v2.1.193 bundle.js:+12452947 (merge-base), +12453480 (diff --shortstat)

### Teleport (Cloud Session Launch)

```
async function launchCloudSession(context):
    // Phase: env-select — list available cloud environments
    environments = await listCloudEnvironments(orgUUID, accessToken)
    if environments is empty:
        if canAutoCreateDefault:
            env = await createDefaultEnvironment()   // "Default" environment
        else:
            return FAIL("no_environments")

    // Phase: branch-detect — determine git source strategy
    sourceStrategy = determineBundleMode(githubPreflightResult)
    // Strategies: "github", "forced_bundle", "ghes_optimistic", "bundle", "empty"
    emitTelemetry("tengu_teleport_bundle_mode", mode=sourceStrategy)

    if sourceStrategy requires bundle upload:
        // Phase: bundle-upload
        bundleResult = await uploadGitBundle(context)
        emitTelemetry("tengu_ccr_bundle_upload")

    // Phase: POST-sent — create remote session
    sessionResponse = await postCreateSession(env, context, sourceRef)
    if sessionResponse missing sessionId:
        return FAIL("malformed_response")

    emitTelemetry("tengu_ccr_session_link")
    return sessionResponse.sessionId
```

API beta header used: `"ccr-byoc-2025-07-29"` (bundle.js:+8800247). Organization UUID sent via `"x-organization-uuid"` header (bundle.js:+8800269). Analysis basis: CC v2.1.193 bundle.js:+8800337 (session creation path)

### Remote Agent Polling and Result Streaming

```
async function pollRemoteSession(sessionId, accessToken):
    // Timeout ceiling: 1,800,000 ms (30 min) — bundle.js:+8821849
    startTime = Date.now()
    while elapsed < POLL_TIMEOUT:
        status = await querySessionStatus(sessionId)
        if status == "pending" or status == "starting" or status == "running":
            wait(POLL_INTERVAL)  // 500 ms initial, backs off to 8000 ms max
            continue             // bundle.js:+9109063, +9109097
        if status == "completed":
            findings = extractFindings(status.result)
            if findings is empty:
                return FAIL("no_review_output")
            return PASS(findings)
        if status == "archived":
            return FAIL("session_error")
        if status == "orchestrator_error":
            return FAIL("orchestrator_error")
    return FAIL("poll_timeout")
```

Poll interval minimum: 500 ms (bundle.js:+9109063). Poll interval maximum: 8000 ms (bundle.js:+9109097). Poll timeout: 1,800,000 ms / 30 minutes (bundle.js:+8821849). Analysis basis: CC v2.1.193 bundle.js:+8820686

### --fix Mode

When the user invokes `/ultrareview` with the `--fix` flag, the system appends an instruction to the remote agent prompt to apply findings as patches to the local working tree upon completion (bundle.js:+12488480). The flag is detected as a sub-command token (`"fix"`) during argument parsing (bundle.js:+12450279). Analysis basis: CC v2.1.193 bundle.js:+12450279

### Overage / Cost Warning Dialog

When the preflight API returns `"needs-confirm"`, a JSX dialog is rendered showing the cost estimate (`$10-$20`) and runtime estimate (`~10–20 min`). Telemetry event `tengu_review_overage_dialog_shown` is emitted on display. If the user declines, `tengu_review_overage_blocked` is emitted (bundle.js:+12488998). Analysis basis: CC v2.1.193 bundle.js:+12489335

### JSX Result Rendering

```
function renderUltrareviewResult(findings, sessionUrl):
    // Renders via x2l.jsx component (bundle.js:+12489382)
    // Displays review findings as structured text blocks
    // Source type annotation: "text" (bundle.js:+12454919)
    // Session tag: "ultrareview" (bundle.js:+12456538)
    // Route: "/ultrareview" (bundle.js:+12457702)
    displayFindings(findings)
    if sessionUrl present:
        displayLink(sessionUrl)
```

Analysis basis: CC v2.1.193 bundle.js:+12489382

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_review_remote_precondition_failed` | Emitted for every early-exit condition (policy blocked, no-auth, not-git-repo, no-github-remote, monorepo-blocked, diff-too-large, etc.) — bundle.js:+12450411 |
| Telemetry: `tengu_review_bughunter_config` | Emitted when the bug-hunter config is read — bundle.js:+9108621 |
| Telemetry: `tengu_ccr_bundle_max_bytes` | Emitted when repo size exceeds bundle limit — bundle.js:+8779277 |
| Telemetry: `tengu_ccr_bundle_upload` | Emitted after successful git bundle upload — bundle.js:+8782773 |
| Telemetry: `tengu_ccr_bundle_seed_enabled` | Emitted when seed-bundle path is used — bundle.js:+7351702 |
| Telemetry: `tengu_teleport_bundle_mode` | Records which bundle strategy was selected — bundle.js:+8800597 |
| Telemetry: `tengu_teleport_source_decision` | Records source repository decision — bundle.js:+8806997 |
| Telemetry: `tengu_ccr_session_link` | Emitted after session creation — bundle.js:+8792785 |
| Telemetry: `tengu_teleport_environments_list` | Emitted when listing cloud environments — bundle.js:+7346694 |
| Telemetry: `tengu_teleport_default_environment_create` | Emitted when auto-creating default env — bundle.js:+7347750 |
| Telemetry: `tengu_teleport_generate_title` | Emitted when generating task title — bundle.js:+8786216 |
| Telemetry: `tengu_teleport_git_bundle_upload` | Emitted for git bundle upload path — bundle.js:+8782480 |
| Telemetry: `tengu_review_remote_teleport_failed` | Emitted when teleport launch fails — bundle.js:+12457442 |
| Telemetry: `tengu_review_remote_launched` | Emitted on successful remote agent launch — bundle.js:+12458118 |
| Telemetry: `tengu_review_overage_blocked` | Emitted when user declines cost confirmation — bundle.js:+12488998 |
| Telemetry: `tengu_review_overage_dialog_shown` | Emitted when cost-confirmation dialog is shown — bundle.js:+12489335 |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Daemon worker escalation — bundle.js:+17482166 |
| Telemetry: `tengu_bg_spare_enable` | Background spare worker enabled — bundle.js:+17483464 |
| Telemetry: `tengu_bg_spare_claim` | Background spare worker claimed — bundle.js:+17483592 |
| Telemetry: `tengu_bg_spare_claim_fail` | Background spare claim failed — bundle.js:+17483858 |
| Telemetry: `tengu_bg_sendclaim_failed` | Daemon claim send failed — bundle.js:+17458401 |
| Telemetry: `tengu_bg_low_mem_mb` | Low memory reported — bundle.js:+13266461 |
| Telemetry: `tengu_bg_dispatch_low_mem` | Dispatch under low memory — bundle.js:+17482767 |
| Telemetry: `tengu_bg_retire_pinned_low_mem` | Pinned worker retired due to memory — bundle.js:+17487013 |
| Telemetry: `tengu_bg_prewarm_per_sweep` | Prewarm sweep metric — bundle.js:+17487134 |
| Telemetry: `tengu_bg_state_read_transient` | Transient state read — bundle.js:+4296462 |
| Telemetry: `tengu_daemon_config_reload` | Daemon config reloaded — bundle.js:+17498707 |
| Telemetry: `tengu_daemon_yield` | Daemon yielded to foreground — bundle.js:+17503119 |
| Telemetry: `tengu_daemon_idle_exit` | Daemon exited due to idle — bundle.js:+17504149 |
| Telemetry: `tengu_daemon_control` | Daemon control event — bundle.js:+17520352 |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` | Feature flag probe results — bundle.js:+1026754, +1026821, +1026902 |
| appState changes | Sets/clears active remote session state; renders results via JSX component `x2l.jsx` |
| Network I/O | HTTP POST to `/v1/ultrareview/preflight`; HTTP POST to create session; polling loop for session status; git bundle upload to Anthropic cloud storage |
| File I/O | Writes temporary git bundle file (`.bundle` / `_source_seed.bundle`) for upload; reads `pins.json` |
| Process execution | `git rev-parse`, `git config`, `git merge-base`, `git diff --shortstat`, `git count-objects`, `gh pr view` |
| Sound | `<!-- TODO: not found in depth-2 traversal; needs --depth 4 -->` |

---

## Version History

| Version | Change |
|---|---|
| v2.1.193 | Initial analysis |

---

## Common Mistakes

1. **Running without a Claude.ai login**: `/ultrareview` requires OAuth authentication, not just an `ANTHROPIC_API_KEY`. Run `/login` first and sign in with a Claude.ai account.
2. **Using on a third-party API provider**: The command is locked to Anthropic's first-party API. If `ANTHROPIC_BASE_URL` is set to a custom endpoint, the command will refuse with "unavailable on third-party providers."
3. **Running in a non-GitHub repository**: The current branch must have a `remote.origin.url` pointing to `github.com`. Other git forges (GitLab, Bitbucket, GHES without special config) are not supported without additional setup.
4. **Running on the Anthropic internal monorepo**: Repositories whose owner is `anthropics` or `anthropic` are explicitly blocked (`monorepo_blocked`).
5. **Expecting instant results**: The cloud agent takes approximately 10–20 minutes and costs $10–$20. Cancelling the overage confirmation dialog aborts the command entirely.
6. **Large branches**: PRs or local diffs that exceed the size thresholds will be rejected before any cloud session is started. Split the branch or reduce the diff size before retrying.
7. **Essential-traffic-only network mode**: When the CLI is configured for `essential-traffic-only` traffic, `ultrareview` is unconditionally blocked because it requires full cloud connectivity.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `lRf` | Main async handler for `/ultrareview` command (arbor_handler) |
| `_5` | String normalization / case-fold utility |
| `Fs` | Auth/provider eligibility checker |
| `XLi` | Auth state resolver |
| `y5` | Auth mode classifier |
| `D$` | Auth mode detail builder |
| `nOt` | Auth-mode enum mapper (firstParty, third_party_provider, custom_base_url, no_auth, oauth_no_inference_scope, enterprise, team, prosumer_oauth) |
| `Bi` | Network profile reader |
| `Rds` | Traffic-mode resolver (essential-traffic, no-telemetry, default) |
| `Whe` | Traffic-mode string normalizer |
| `at` | String-to-boolean utility ("yes"/"on") |
| `r` | CLI stdio/process signal handler |
| `Is` | Process exit / CLI error dispatcher |
| `S1o` | Preflight allowance checker (allow_remote_sessions gate) |
| `Cer` | Git remote URL parser / normalizer |
| `Zw` | Regex-replace helper (credential scrubber in URLs) |
| `l6e` | MCP server connection initiator |
| `Bcr` | MCP connection-result applier |
| `mSa` | MCP server auth-status accessor |
| `VWo` | MCP server map reconstructor |
| `wer` | Full ultrareview pre-flight orchestrator |
| `$ut` | Git work-tree check runner (git rev-parse --is-inside-work-tree) |
| `Pt` | Git command executor (base) |
| `Eln` | Async-local-storage context retriever |
| `mr` | Rx/reactive wrapper for command output |
| `Vr` | Child-process spawn wrapper |
| `I$e` | Child-process lifecycle manager |
| `p` | Forced-shutdown handler |
| `DEu` | Child-process error serializer |
| `Kd` | Process timeout controller |
| `an` | Error object factory |
| `MEu` | Stdio-maxbuffer error handler |
| `xe` | Process output collector |
| `Ve` | Not-in-git-repo error factory |
| `Zze` | Base error class |
| `i1` | Git remote URL resolver (git config --get remote.origin.url) |
| `Ez` | Remote URL cache lookup |
| `ncn` | Git config value cache accessor |
| `LJe` | URL credential redactor (replaces `://***@`) |
| `lie` | Git remote URL normalizer / branch extractor |
| `ggs` | Range-style ref parser (`..`) |
| `wJe` | URL scheme validator (https check) |
| `di` | String-slice URL extractor |
| `Em` | GitHub host normalizer (strips www., extracts github.com) |
| `dLt` | Host-string munger |
| `fgs` | Domain slicer |
| `Pn` | Merge-base / default-branch resolver |
| `m` | Daemon worker manager |
| `R` | Worker kill orchestrator |
| `d` | Worker process supervisor |
| `Bt` | JSON.parse wrapper |
| `bEo` | Review bughunter config reader (cost/time estimates) |
| `SWe` | Session status poller |
| `it` | Session state accessor |
| `_` | Locale-string formatter |
| `gVa` | Repository size checker (git count-objects -v) |
| `mVa` | Object-count parser |
| `fVa` | Session it-accessor wrapper |
| `f` | Background worker dispatcher / spawner |
| `D` | Worker lifecycle controller |
| `NMc` | File-system real-path resolver |
| `RHm` | File mtime change detector |
| `Un` | Timeout-with-abort utility |
| `c` | Process signal emitter |
| `Re` | Feature-flag OK reporter |
| `Oe` | Feature-flag error reporter |
| `we` | Feature-flag sad reporter |
| `Knr` | macOS low-memory check |
| `I9e` | pins.json reader / manager |
| `RNt` | pins.json path resolver |
| `In` | ENOENT-safe file wrapper |
| `vUd` | Recursive directory scanner |
| `O` | Worker retirement / timeout scheduler |
| `F` | Worker retirement inner logic |
| `cVo` | Daemon socket claim sender |
| `w9o` | Claim-frame file writer |
| `tHm` | Claim-send timeout handler |
| `eHm` | Claim frame builder |
| `qd` | Error stringifier |
| `be` | String coercer |
| `uk` | Binary frame encoder (Buffer write) |
| `gVo` | Background session worker |
| `hc` | Session work-dir path builder |
| `Gi` | Session state file reader/writer |
| `Lh` | Active-state marker |
| `QLe` | Git-ignore / allowed-path filter |
| `$d` | Path sanitizer |
| `W_t` | Session-done watcher |
| `xKt` | Session roster key builder |
| `XSe` | Session roster entry writer |
| `fk` | Roster error tagger |
| `M0` | Session result persister |
| `nD` | Roster late-tag setter |
| `ZJ` | Session summary splitter |
| `LKt` | Session lock-key path builder |
| `Yk` | Default-branch resolver (symbolic-ref HEAD) |
| `JIr` | Default-branch cache getter |
| `V_` | Current-branch resolver (git branch --abbrev-ref HEAD) |
| `YIr` | Current-branch cache getter |
| `u` | Daemon shutdown orchestrator |
| `R$` | Message-bus event emitter |
| `h5` | Global event-bus getter |
| `ZBe` | Event-loop drainer |
| `xGr` | UUID-based event publisher |
| `Hj` | Graceful-shutdown race coordinator |
| `Yhe` | Event-bus shutdown caller |
| `oHe` | Timeout canceller for shutdown |
| `GGn` | `git shortstat` delta parser (parseInt based) |
| `Ler` | Ultrareview preflight API caller |
| `d2l` | HTTP request executor for `/v1/ultrareview/preflight` |
| `_1o` | Preflight request schema validator |
| `vt` | HTTP response success wrapper |
| `VMe` | Preflight result decoder |
| `rgt` | Subscription / plan type checker |
| `Vx` | Plan-type accessor |
| `fwe` | Subscription model resolver |
| `Rc` | Plan-category normalizer |
| `Dy` | Auth provider + API-key classifier |
| `kt` | Session store accessor |
| `So` | Subscription type mapper (stripe, apple, google_play) |
| `wB` | Array-includes checker |
| `RA` | Role/plan eligibility checker (max, pro, admin, billing, owner) |
| `Ci` | Plan access-level resolver (HPr, hPr) |
| `iJ` | Session-status query |
| `aRf` | UltraReview JSX result renderer wrapper |
| `xer` | Main UltraReview UI / session runner component |
| `ode` | Remote-agent eligibility checker |
| `lLa` | Background remote-eligibility-check runner |
| `w` | Away-summary / blur-state tracker |
| `B7` | Session blur-state accessor |
| `L` | Daemon sweep / prewarm scheduler |
| `v` | Focused-state transition |
| `KAc` | Away-summary accessor |
| `zAc` | Assistant-turn tracker |
| `sre` | Env-override bundle-mode string |
| `W7a` | Status poller with timeout |
| `oG` | Full teleport-to-remote orchestrator |
| `Ql` | Session-create header builder |
| `Wg` | Dbn (DOM/React binding) |
| `oGn` | Session phase annotator |
| `LB` | Remote-task session-create request builder |
| `Rs` | OAuth URL resolver (local/staging/prod) |
| `ES` | HTTP header builder (Content-Type, anthropic-version) |
| `u_o` | Git bundle upload handler |
| `Lt` | Rx error handler |
| `HVa` | Remote task control-event emitter |
| `Q3t` | Session-create POST body constructor |
| `ke` | JSON.stringify wrapper |
| `ne` | Stream event reader |
| `p_o` | Phase branch-detect logger |
| `f_o` | Phase bundle-upload logger |
| `gh` | Object.assign wrapper |
| `hVa` | Session-link telemetry emitter |
| `v$n` | Env-select phase handler |
| `Mne` | Cloud environments list fetcher |
| `Uut` | Default cloud environment creator |
| `R3p` | Remote-agent task schema builder |
| `O3p` | Environment filter |
| `k$` | Session-store updater |
| `M6e` | GitHub App installation checker |
| `As` | User-role / org-role accessor |
| `z` | Feature-flag set accessor |
| `re` | Voice/focus event handler |
| `eo` | Error-string extractor |
| `mh` | Cancel-check utility |
| `p_` | Session-phase logger |
| `No` | Base not-found error class |
| `DEe` | Remote agent session poller / result extractor |
| `Q3` | Random token generator |
| `zft` | Temp file manager for remote session |
| `jC` | Session poll clock |
| `B3p` | Phase-logger string builder |
| `SVa` | Remote-agent polling loop |
| `sde` | Session display component |
| `Vy` | Display layout provider |
| `iRf` | Result-map renderer |
| `ver` | Cancel handler for ultrareview |