---
type: feature-spec
feature: "ultrareview"
cc_version: "2.1.190"
updated: "2026-06-24"
tags: ["ultrareview", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.190 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultrareview`

> Analysis basis: CC v2.1.190 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.190

---

## Overview

`/ultrareview` launches a cloud-based agent session that finds and verifies bugs in the current Git branch. The command runs entirely in Claude Code on the web — not locally — and incurs a monetary cost (approximately $10–$20 USD per invocation). Before dispatching any remote work the command executes a multi-stage preflight sequence: policy checks, Git/GitHub validation, diff-size gating, a server-side preflight API call, and user confirmation, after which it teleports a Git bundle to a cloud environment and polls for results.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultrareview` |
| description | `"Start a cloud agent that finds and verifies bugs in your branch ( … , … USD) · Runs in Claude Code on the web. See …"` |
| loc_byte | `12280721` |
| loc_byte_end | `12280992` |
| loc_line | `8239` |
| module_id | `s0l` |
| load_inline | `true` |
| arbor_handler.name | `Aff` |
| arbor_handler.fqn | `claude-2.1.190::Aff` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.190 bundle.js:+12280721

---

## Input Branching

The command has more than three distinct branching paths (policy gate → Git repo gate → GitHub remote gate → monorepo gate → diff-size gate → preflight API gate → cost-confirm gate → teleport/launch → poll/result), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    START(["/ultrareview invoked"]) --> POLICY{allow_remote_sessions\npolicy enabled?}
    POLICY -- No --> ERR_POLICY["Error: cloud sessions disabled\nby org policy\ntelemetry: tengu_review_remote_precondition_failed"]
    POLICY -- Yes --> ESSENTIAL{essential-traffic-only\nmode active?}
    ESSENTIAL -- Yes --> ERR_ESSENTIAL["Error: ultrareview unavailable\nin essential-traffic-only mode"]
    ESSENTIAL -- No --> AUTH{OAuth token / Claude.ai\naccount present?}
    AUTH -- No --> ERR_AUTH["Error: requires Claude.ai account\nrun /login"]
    AUTH -- Yes --> GIT{Inside a Git\nwork-tree?}
    GIT -- No --> ERR_GIT["Precondition failed: not_git_repo\ntelemetry: tengu_review_remote_precondition_failed"]
    GIT -- Yes --> REMOTE{GitHub remote\nURL present?}
    REMOTE -- No --> ERR_REMOTE["Precondition failed: no_github_remote\ntelemetry: tengu_review_remote_precondition_failed"]
    REMOTE -- Yes --> MONOREPO{Repo owned by\nanthropic/anthropics?}
    MONOREPO -- Yes --> ERR_MONO["Precondition failed: monorepo_blocked"]
    MONOREPO -- No --> PR{Optional: PR supplied?\nFetch PR stats via gh CLI}
    PR -- PR diff too large --> ERR_PRDIFF["Precondition failed: pr_diff_too_large\n(threshold: 8000 units)"]
    PR -- OK or no PR --> DIFFSTAT["Run git diff --shortstat\nagainst merge-base"]
    DIFFSTAT -- empty diff --> ERR_EMPTY["Precondition failed: empty_diff"]
    DIFFSTAT -- local diff too large --> ERR_LOCALDIFF["Precondition failed: local_diff_too_large"]
    DIFFSTAT -- OK --> REPOBIG{Repo object count\n> 5 000 000?}
    REPOBIG -- Yes --> ERR_REPOBIG["Precondition failed: repo_too_large_to_bundle"]
    REPOBIG -- No --> PREFLIGHT["POST /v1/ultrareview/preflight\ntelemetry: api_ultrareview_preflight"]
    PREFLIGHT -- request_failed --> ERR_PFFAIL["Error: request_failed"]
    PREFLIGHT -- schema_mismatch --> ERR_SCHEMA["Error: schema_mismatch"]
    PREFLIGHT -- server blocked --> ERR_SERVER["Error: ultrareview unavailable for org"]
    PREFLIGHT -- needs-confirm --> CONFIRM["Show cost confirmation dialog\n($10–$20, ~10–20 min)\ntelemetry: tengu_review_overage_dialog_shown"]
    PREFLIGHT -- proceed --> TELEPORT
    CONFIRM -- user cancels --> CANCELLED["Print: Ultrareview cancelled."]
    CONFIRM -- user confirms --> TELEPORT["Teleport: bundle upload + cloud\nsession creation\ntelemetry: tengu_teleport_bundle_mode,\ntengu_ccr_bundle_upload"]
    TELEPORT -- teleport_failed --> ERR_TELE["Error: remote teleport failed\ntelemetry: tengu_review_remote_teleport_failed\nMessage: check GitHub repo, try again"]
    TELEPORT -- remote_agent_ineligible --> ERR_INELIG["Error: remote agent ineligible"]
    TELEPORT -- success --> POLL["Poll remote agent session\nfor results\n(max ~30 min / 1 800 000 ms)"]
    POLL -- no_review_output --> ERR_NOREVIEW["Error: no_review_output"]
    POLL -- poll_timeout --> ERR_TIMEOUT["Error: poll_timeout"]
    POLL -- session_error --> ERR_SESSION["Error: session_error"]
    POLL -- completed --> RESULT["Stream results to terminal\ntelemetry: tengu_review_remote_launched"]
    RESULT -- --fix flag set --> APPLY["Apply findings to local\nworking tree"]
    APPLY --> DONE([Done])
    RESULT --> DONE
```

Analysis basis: CC v2.1.190 bundle.js:+12278123

---

## Behavioral Spec

### 1. Handler Entry — `mainHandler` (bundle: `Aff`)

The top-level async handler is resolved via `module_id → s0l → Aff`.

```
async function mainHandler(context):
    if not remoteSessionsAllowed(context):
        emitTelemetry("tengu_review_remote_precondition_failed")
        showError("Cloud sessions are disabled by your organization's policy.")
        return

    // Jitter delay before proceeding (Math.random, setTimeout)
    await jitterDelay(maxMs=2)

    preflightResult = await runPreflight(context)   // WLl → r0o
    if preflightResult.failed:
        return

    sessionResult  = await launchCloudSession(context, preflightResult)  // o0o
    if sessionResult.failed:
        return

    await renderAndMonitorSession(context, sessionResult)  // Sff
```

Analysis basis: CC v2.1.190 bundle.js:+12278123

---

### 2. Policy Pre-check — `checkRemotePolicy` (bundle: `Js`)

```
function checkRemotePolicy(appState):
    if not appState.has("allow_remote_sessions"):
        return { blocked: true, reason: "policy_blocked" }

    if telemetryMode == "essential-traffic-only":
        return { blocked: true, reason: "essential_traffic" }

    if not appState.has("allow_product_feedback"):
        // data-residency / third-party provider path
        if provider == "zdr" or provider == "data-residency":
            return { blocked: true, reason: "data_residency" }
        // third-party provider
        return { blocked: true, reason: "data_residency" }

    if no OAuth token present:
        return { blocked: true, reason: "no_oauth_token" }

    return { blocked: false }
```

Literal constants observed: `"allow_remote_sessions"` (bundle.js:+12278126), `"allow_product_feedback"` (bundle.js:+3352407), `"essential-traffic-only"` (bundle.js:+12238486).

Analysis basis: CC v2.1.190 bundle.js:+3352335

---

### 3. Git / GitHub Pre-checks — `runGitPreconditions` (bundle: `r0o`, `mat`, `cO`, `Un`)

```
async function runGitPreconditions(context):
    // Check git work-tree
    isGitRepo = await git("rev-parse", "--is-inside-work-tree")
    if not isGitRepo:
        emitTelemetry("tengu_review_remote_precondition_failed")
        return { error: "not_git_repo" }

    remoteUrl = await getRemoteOriginUrl()   // git config --get remote.origin.url
    if not remoteUrl:
        return { error: "no_github_remote" }

    if remoteUrl does not contain "github.com":
        return { error: "no_github_remote" }

    if remoteUrl.owner in ["anthropics", "anthropic"]:
        return { error: "monorepo_blocked" }

    // Optional PR stats via gh CLI
    if prNumber supplied:
        prStats = await execGh("pr", "view", "--repo", repoId,
                               "--json", "additions,deletions,changedFiles")
        if totalChanges > 8000:
            return { error: "pr_diff_too_large" }

    // Local diff stats
    mergeBase = await git("merge-base", currentBranch, defaultBranch)
    if no mergeBase:
        return { error: "no_merge_base" }

    shortstat = await git("diff", "--shortstat", mergeBase)
    if shortstat is empty:
        return { error: "empty_diff" }

    parsedLines = parseDiffShortstat(shortstat)   // YBn → parseInt + regex
    if parsedLines > threshold:
        return { error: "local_diff_too_large" }

    // Repo object-count guard
    objCount = await git("count-objects", "-v")
    if objCount > 5_000_000:
        return { error: "repo_too_large_to_bundle" }

    return { ok: true, remoteUrl, mergeBase, defaultBranch }
```

Key literals: `"rev-parse"` (bundle.js:+7214139), `"--is-inside-work-tree"` (bundle.js:+7214151), `"remote.origin.url"` (bundle.js:+1153253), `"github.com"` (bundle.js:+12240812), `"anthropics"` / `"anthropic"` (bundle.js:+12240850 / +12240887), `"additions,deletions,changedFiles"` (bundle.js:+12241285), PR threshold `5000` (bundle.js:+12241330 — likely lines/files, distinct from repo object count), `5_000_000` object-count limit (bundle.js:+8588562), `8000` diff-size limit (bundle.js:+8919215).

Analysis basis: CC v2.1.190 bundle.js:+12240040

---

### 4. Server Preflight — `serverPreflight` (bundle: `$Ll`)

```
async function serverPreflight(context):
    response = await httpGet("/v1/ultrareview/preflight")
    // checks teleport-org header
    if response.status == "schema_mismatch":
        return { error: "schema_mismatch" }
    if response.status == "request_failed":
        return { error: "request_failed" }

    if essentialTrafficOnly:
        return { error: "essential_traffic_only",
                 message: "Ultrareview runs in Claude Code on the web and is
                           unavailable when essential-traffic-only mode is active." }

    if thirdPartyProvider:
        return { error: "data_residency",
                 message: "Ultrareview runs in Claude Code on the web and is
                           unavailable on third-party providers." }

    if not authenticated:
        return { error: "no_oauth_token",
                 message: "Ultrareview requires a Claude.ai account. Run /login..." }

    match response.outcome:
        "proceed"       → return { proceed: true }
        "needs-confirm" → return { needsConfirm: true, costRange: "$10-$20" }
        "server"        → return { error: "server_blocked",
                                   message: "Ultrareview is unavailable for your organization." }
```

Endpoint literal: `"/v1/ultrareview/preflight"` (bundle.js:+12238392). Telemetry tag: `"api_ultrareview_preflight"` (bundle.js:+12239013). Header: `"teleport-org"` (bundle.js:+12238426).

Analysis basis: CC v2.1.190 bundle.js:+12238317

---

### 5. Cost Confirmation Dialog — `showConfirmDialog` (bundle: `o0o`, `T6e`, `b6e`)

When the preflight returns `"needs-confirm"`, the command renders an interactive JSX dialog:

```
function showConfirmDialog(costRange, estimatedTime):
    // costRange = "$10-$20"   (bundle.js:+8918855)
    // estimatedTime = "~10–20 min"  (bundle.js:+8918948)
    emitTelemetry("tengu_review_overage_dialog_shown")
    options = ["confirm", "cancel"]
    choice = await renderInteractiveChoice(options)
    if choice == "cancel":
        print("Ultrareview cancelled.")
        return false
    return true
```

Analysis basis: CC v2.1.190 bundle.js:+12243909

---

### 6. Teleport / Cloud Session Launch — `teleportToRemote` (bundle: `s0o` / `P5`)

This is the most complex sub-system. It:

1. Validates cloud-session eligibility (first-party provider, access token, org UUID).
2. Selects or auto-creates a cloud environment.
3. Detects the Git source strategy (`github`, `bundle`, `explicit_source_url`, `no_git_at_all`).
4. Optionally uploads a Git bundle (`teleport_git_bundle_upload`).
5. POSTs a session-creation request and obtains a session ID.
6. Streams control events to the remote worker.

```
async function teleportToRemote(context, params):
    // Eligibility
    if not firstPartyProvider:
        return { error: "not_first_party",
                 message: "Cloud sessions are only available on the first-party Anthropic API provider." }
    if not accessToken:
        return { error: "no_access_token" }
    if not orgUUID:
        return { error: "no_org_uuid",
                 message: "Unable to get organization UUID for cloud session creation" }

    // Environment selection
    envList = await fetchEnvironments()
    env = selectOrCreateDefaultEnv(envList)   // auto-creates "Default" if absent
    if not env:
        return { error: "no_environments",
                 message: "No environments available for session creation" }

    // Source-code strategy
    sourceStrategy = determineSourceStrategy(context)
    // possible values: "github", "bundle", "explicit_source_url",
    //                  "explicit_env_bundle", "no_git_at_all"
    emitTelemetry("tengu_teleport_source_decision", { strategy: sourceStrategy })

    if sourceStrategy == "github":
        ghAppOk = await checkGithubAppInstalled()
        emitTelemetry(ghAppOk ? "github_preflight_ok" : "github_preflight_failed")

    if sourceStrategy in ["bundle", "explicit_env_bundle"]:
        uploadResult = await uploadGitBundle(repoPath)
        emitTelemetry("tengu_ccr_bundle_upload", uploadResult)
        emitTelemetry("tengu_teleport_bundle_mode", { mode: ... })

    // POST session
    sessionResp = await httpPost("/v1/sessions", {
        environment: env.id,
        source: sourceStrategy,
        task: taskDescription,
        permissionMode: "default",
        ...
    })
    if sessionResp.status in [401, 403, 429]:
        return { error: "create_request_failed" }
    if not sessionResp.sessionId:
        return { error: "malformed_response",
                 message: "Server returned a malformed session response (no session id)" }

    emitTelemetry("tengu_ccr_session_link")
    return { sessionId: sessionResp.sessionId }
```

Bundle-upload size limit: `5_000_000` objects (bundle.js:+8588562). Bundle file suffix: `".bundle"` (bundle.js:+8592427). Stash refs: `"refs/seed/stash"` / `"refs/seed/root"` (bundle.js:+8591221 / +8591239). Session creation HTTP status codes: 201 success (bundle.js:+8609363), 401/403/429 failure (bundle.js:+8609432–+8609440).

Analysis basis: CC v2.1.190 bundle.js:+12246087

---

### 7. Result Polling — `pollRemoteAgent` (bundle: `r_e`, `GUa`)

```
async function pollRemoteAgent(sessionId, options):
    maxPollMs   = 1_800_000   // 30 minutes  (bundle.js:+8628794)
    startTime   = Date.now()
    agentState  = "pending"   // → "running" → "completed" / "archived"

    while Date.now() - startTime < maxPollMs:
        status = await fetchSessionStatus(sessionId)
        agentState = status.state

        match status.event:
            "SessionStart"      → agentState = "starting"
            "hook_progress"     → streamProgressToUI(status)
            "hook_response"     → processHookResponse(status)
            "result"            → break with result
            "orchestrator_error"→ return { error: "orchestrator_error" }
            "session_error"     → return { error: "session_error" }

        if agentState in ["completed", "archived"]:
            break

    if timedOut:
        return { error: "poll_timeout" }
    if not result:
        return { error: "no_review_output" }

    return { ok: true, findings: result }
```

Poll timeout: `1_800_000 ms` (bundle.js:+8628794). State machine values observed: `"pending"`, `"running"`, `"starting"`, `"completed"`, `"archived"` (bundle.js:+13326759, +8627217, +8630821, +8629313, +8629238).

Analysis basis: CC v2.1.190 bundle.js:+8627106

---

### 8. Result Rendering and `--fix` Application — `renderSessionResult` (bundle: `Sff`, `s0o`)

```
async function renderSessionResult(findings, options):
    // Render findings as JSX to terminal (local-jsx type)
    renderJSX(findings)

    if options.fix:
        // "--fix" flag: apply patch findings to local working tree
        // Literal: " The user passed --fix: when the findings arrive, apply them..."
        await applyFindingsToWorkingTree(findings)

    emitTelemetry("tengu_review_remote_launched")
```

`--fix` flag literal: `"fix"` (bundle.js:+12239923). `--comment` flag also parsed: `"comment"` (bundle.js:+12239929). Companion command `/code-review ultra` mentioned in argument parsing: `"/code-review ultra"` (bundle.js:+12240008).

Analysis basis: CC v2.1.190 bundle.js:+12277571

---

### 9. MCP / Background Worker Infrastructure

The teleport system reuses the daemon background-session infrastructure. Key state transitions observed in the call graph (`f`, `P3o`, `D`, `L3o`):

```
daemonSessionLifecycle states:
  "spare"    → "claimed"   → "working"  → "idle"
  "working"  → "crashed"   / "killed"   / "done"
  "bg"       → "daemon"    → "resuming"
  "blocked"  → "stopped"
```

Idle-exit timeout: `300_000 ms` (5 min) (bundle.js:+17206382). SIGKILL escalation after SIGTERM: telemetry `tengu_bg_dispatch_sigkill_escalate` (bundle.js:+17198228). Low-memory guard: threshold check emits `tengu_bg_low_mem_mb` (bundle.js:+13054968).

Analysis basis: CC v2.1.190 bundle.js:+17199633

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_review_remote_precondition_failed` | Fired on any pre-flight gate failure (policy, git, GitHub, diff size) |
| Telemetry: `tengu_review_overage_dialog_shown` | Fired when cost-confirmation dialog is displayed |
| Telemetry: `tengu_review_overage_blocked` | Fired when org policy blocks the command (bundle.js:+12278457) |
| Telemetry: `tengu_review_remote_teleport_failed` | Fired when cloud session creation/teleport fails |
| Telemetry: `tengu_review_remote_launched` | Fired on successful result delivery |
| Telemetry: `tengu_review_bughunter_config` | Fired with bughunter configuration parameters |
| Telemetry: `tengu_ccr_bundle_upload` | Fired with bundle upload result metadata |
| Telemetry: `tengu_teleport_bundle_mode` | Fired with the chosen bundle/source mode |
| Telemetry: `tengu_ccr_session_link` | Fired when session link is obtained |
| Telemetry: `tengu_teleport_source_decision` | Fired with the source-code strategy chosen |
| Telemetry: `tengu_ccr_bundle_max_bytes` | Fired with the max-bytes limit for bundle upload |
| Telemetry: `tengu_ccr_bundle_seed_enabled` | Fired when seed-bundle mode is active |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Fired when a background worker is SIGKILL-escalated |
| Telemetry: `tengu_daemon_config_reload` | Fired on daemon config reload |
| Telemetry: `tengu_bg_low_mem_mb` / `tengu_bg_dispatch_low_mem` | Low-memory events |
| Telemetry: `tengu_daemon_idle_exit` / `tengu_daemon_yield` | Daemon lifecycle events |
| Telemetry: `tengu_bg_spare_enable` / `tengu_bg_spare_claim` / `tengu_bg_spare_claim_fail` | Spare-session pool events |
| Telemetry: `tengu_bg_sendclaim_failed` | Claim-frame send failure |
| Telemetry: `tengu_bg_state_read_transient` | Transient state-file read event |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` | Generic feature health events |
| appState reads | `allow_remote_sessions`, `allow_product_feedback` policy flags |
| Git side effects | Reads `remote.origin.url`; may create temporary stash refs `refs/seed/stash`, `refs/seed/root`; runs `git bundle create` for upload |
| File I/O | Writes bundle file (`*.bundle`, `_source_seed.bundle`) to temp path; writes `state.json`, `pins.json` in daemon state directory |
| Network | POSTs to `/v1/ultrareview/preflight` and session-creation endpoint; polls session-status endpoint; uploads bundle via HTTP |
| Sound | None observed |
| Hook registration | Registers `control_request`, `set_permission_mode`, `apply_flag_settings`, `focus` event handlers on the remote session channel |
| `--fix` flag | Applies remote findings as patches to local working tree when set |

---

## Version History

| Version | Change |
|---|---|
| v2.1.190 | Initial analysis |

---

## Common Mistakes

1. **Running outside a Git repository** — `/ultrareview` requires a Git working tree. It will fail with `not_git_repo` immediately if `git rev-parse --is-inside-work-tree` returns false.
2. **No GitHub remote configured** — The command requires `remote.origin.url` to point to `github.com`. A non-GitHub remote (GitLab, Bitbucket, bare SSH, etc.) will be rejected with `no_github_remote`. Add one with `git remote add origin <GITHUB_URL>`.
3. **Using an API key instead of a Claude.ai OAuth session** — `/ultrareview` explicitly requires a Claude.ai login. Authenticating only via `ANTHROPIC_API_KEY` is not sufficient; run `/login` first.
4. **Diff is empty or on the default branch** — The command gates on a non-empty diff relative to the merge-base of the default branch. If you haven't committed any changes, or are already on the default branch with no divergence, the check will fail with `empty_diff` or `no_merge_base`.
5. **Repository too large** — Repositories exceeding approximately 5 000 000 Git objects cannot be bundled and uploaded; the command exits with `repo_too_large_to_bundle`.
6. **Organization policy disabled** — If `allow_remote_sessions` is not set in the org policy, the command is unconditionally blocked regardless of other settings. Contact your org admin to enable it.
7. **Anthropic/anthropics-owned repos are blocked** — Repositories whose GitHub owner is `anthropic` or `anthropics` are explicitly rejected with `monorepo_blocked`.
8. **Expecting free execution** — Each run costs approximately $10–$20 USD and takes approximately 10–20 minutes. A confirmation dialog is shown when the server returns `needs-confirm`; declining cancels the run without charge.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Aff` | Main handler — top-level async entry point for `/ultrareview` |
| `Js` | Remote policy pre-check (checks `allow_remote_sessions`, telemetry mode) |
| `sSi` | Telemetry mode reader |
| `Jz` | Telemetry-mode branch dispatcher |
| `K9` | Telemetry-mode getter |
| `uxt` | File-based telemetry config reader (readFileSync, utf-8) |
| `Wme` | `allow_product_feedback` policy checker |
| `Vi` | Traffic-mode classifier (`essential-traffic`, `no-telemetry`, `default`) |
| `Jns` | Traffic-mode string normalizer |
| `nt` | Generic string-to-enum converter |
| `Rme` | Telemetry-mode string resolver |
| `Is` | CLI error reporter (console.error + process.exit) |
| `dqe` | Error color formatter (St.red) |
| `iT` | Error file writer (Pre.writeFileSync) |
| `e` | Jitter-delay helper (Math.random + setTimeout) |
| `WLl` | Argument parser for `--fix` / `--comment` flags |
| `I7n` | Flag token splitter and normalizer |
| `fw` | Shell-escape replacer |
| `r0o` | Git/GitHub precondition runner |
| `mat` | Git work-tree checker (rev-parse --is-inside-work-tree) |
| `Pt` | Git command executor |
| `Mrn` | AsyncLocalStorage store accessor |
| `gr` | Git result validator |
| `Wr` | Child-process runner |
| `B1e` | Child-process spawner with stdio handling |
| `p` | Forced-shutdown helper (process.exit + u.abort) |
| `Oiu` | Stdio buffer converter (String) |
| `sp` | Process-output stream handler |
| `Piu` | Stderr accumulator |
| `ke` | Command result collector |
| `W` | Generic result wrapper / state node |
| `Ve` | Error-code classifier |
| `aKe` | Error-category mapper |
| `cO` | Remote-origin URL fetcher (git config --get remote.origin.url) |
| `BK` | Cached remote-URL lookup |
| `mon` | Remote-URL cache store accessor |
| `U7e` | URL credential scrubber (`://***@`) |
| `hoe` | Git-URL parser |
| `Lis` | Branch-range parser |
| `N7e` | URL scheme validator |
| `fi` | URL substring extractor |
| `Un` | Base-ref resolver |
| `f` | Background session manager / daemon worker |
| `D` | Session process supervisor |
| `VEc` | Session working-directory resolver (realpath/stat) |
| `XJf` | Session binary locator |
| `d` | Session write channel |
| `Kn` | Timed-retry helper (setTimeout/clearTimeout) |
| `c` | Abort-state tracker |
| `Re` | Feature-ok telemetry emitter |
| `Pe` | Feature-ok event builder |
| `Le` | Feature-ok payload builder |
| `GXn` | Low-memory detector |
| `it` | Token-usage tracker |
| `B2e` | Pins-file reader/cleaner |
| `MDt` | Pins-file path builder |
| `Gt` | JSON.parse wrapper |
| `kn` | ENOENT-safe file accessor |
| `ECd` | Pinned-session directory scanner |
| `U` | Session keep-alive / retire-if-settled helper |
| `N` | Timer reference holder |
| `M` | Periodic writer |
| `L3o` | Session claim sender (socket connect + claim frame) |
| `n1o` | Session state-file writer (dV.writeFile) |
| `EJf` | Claim-send timeout enforcer |
| `yJf` | Claim-frame builder |
| `Jd` | Generic logger |
| `be` | String coercer |
| `gR` | Binary frame encoder (Buffer) |
| `P3o` | Session roster / lifecycle manager |
| `ec` | Session socket-path builder |
| `Di` | Session state-file reader/watcher |
| `yg` | Active-state marker |
| `Eve` | Permission-path filter |
| `kd` | Session config path builder |
| `cht` | Session health-check poller |
| `i8t` | Session path builder (i8t variant) |
| `bye` | Session path builder (bye variant) |
| `yR` | Late-response handler |
| `uN` | Session inbox initializer |
| `lM` | Late-message handler |
| `s8t` | Session socket-path builder (s8t variant) |
| `F` | Interval disposer (clearInterval) |
| `Xdo` | Diff-size parser (Number.isFinite, Math.floor) |
| `b6e` | Cost/time range formatter (`$10-$20`, `~10–20 min`) |
| `y` | Locale-string formatter |
| `G5e` | TeammateMailbox reader |
| `$5e` | Mailbox file reader |
| `zg` | Object-assign merger |
| `a_e` | Mailbox message processor |
| `zn` | Array item extractor |
| `wut` | Unread-message filter |
| `Xs` | AsyncLocalStorage context accessor |
| `Me` | JSON.stringify wrapper |
| `OUa` | Repo object-count reader (git count-objects -v) |
| `PUa` | Object-count parser |
| `DUa` | Token-usage tracker (DUa variant) |
| `ZR` | Default-branch resolver (symbolic-ref) |
| `Myr` | Default-branch cache accessor |
| `I_` | Current-branch resolver (git branch --abbrev-ref HEAD) |
| `Ryr` | Current-branch cache accessor |
| `YBn` | Diff-shortstat parser (regex + parseInt) |
| `o0o` | Post-preflight flow (confirm dialog + session dispatch) |
| `$Ll` | Server preflight caller (POST /v1/ultrareview/preflight) |
| `e0o` | Preflight error renderer |
| `Mt` | Generic modal/message renderer |
| `T6e` | Confirmation dialog renderer |
| `Cdt` | Subscription-check helper |
| `i0` | Subscription plan reader |
| `OIe` | Subscription-type classifier |
| `hc` | Subscription plan handler |
| `ay` | Auth-provider detector |
| `Dt` | Session tracker / metrics recorder |
| `Ao` | Subscription capability checker |
| `H2` | Array-include checker |
| `oA` | Auth-tier gate (max/pro/admin/billing/owner) |
| `Ci` | Auth tier resolver |
| `YLr` | Tier-name normalizer |
| `jLr` | Tier-fallback handler |
| `Ite` | Cost-range display helper |
| `Sff` | Top-level result renderer (JSX shell) |
| `s0o` | Core cloud-session UI component |
| `Zle` | Session-creation orchestrator |
| `mga` | Remote-eligibility checker |
| `I` | Scroll-position calculator |
| `x` | Terminal write helper |
| `A` | Clamp/min-max helper |
| `dte` | Session-display timer |
| `S3a` | Cost-range picker |
| `P5` | Teleport-to-remote orchestrator (main teleport function) |
| `Nl` | First-party provider checker |
| `xh` | OAuth token refresher |
| `lBn` | Org-UUID resolver |
| `_2` | Session creation request builder |
| `Ls` | Environment-URL builder |
| `YE` | HTTP client wrapper |
| `Mco` | Git bundle uploader |
| `kt` | Upload-URL builder |
| `UUa` | Session control-request sender |
| `DFt` | Session payload formatter |
| `ne` | Stream event dispatcher |
| `NUa` | Session-link renderer |
| `FDn` | Session-display formatter |
| `Fee` | Environment lister |
| `fat` | Default-environment creator |
| `uvp` | Branch-detection helper |
| `vU` | Token-usage event emitter |
| `P9e` | GitHub App installation checker |
| `gs` | Polling transport |
| `K` | Platform-capability reader |
| `se` | Stream-end handler |
| `fo` | Error string coercer |
| `IH` | Cancel-error detector |
| `jH` | User-facing error renderer |
| `r_e` | Remote-agent poller (main poll loop) |
| `OB` | Random-bytes generator |
| `fut` | Poll socket opener |
| `aC` | Poll timestamp recorder |
| `yvp` | Poll-status formatter |
| `GUa` | Poll event processor (hook_progress, hook_response, result, errors) |
| `ece` | Result-stream renderer |
| `gy` | Output stream combiner |
| `Eff` | findings-list mapper |
| `n0o` | Cancellation handler |

---

*Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.*