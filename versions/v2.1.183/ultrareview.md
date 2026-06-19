---
type: feature-spec
feature: "ultrareview"
cc_version: "2.1.183"
updated: "2026-06-19"
tags: ["ultrareview", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.183 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/ultrareview`

> Analysis basis: CC v2.1.183 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.183

---

## Overview

`/ultrareview` launches a cloud-hosted agent session that autonomously finds and verifies bugs in the current git branch. The command runs entirely on the Claude Code web platform (not locally), requiring a Claude.ai login and a GitHub-connected repository. The estimated cost is in the `$10–$20 USD` range and typical runtime is approximately `~10–20 min`.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `ultrareview` |
| description | `"Start a cloud agent that finds and verifies bugs in your branch ( ... , ... USD) · Runs in Claude Code on the web. See ..."` |
| loc_byte | `12505539` |
| loc_byte_end | `12505810` |
| loc_line | `8111` |
| module_id | `ZEl` |
| load_inline | `true` |
| arbor_handler.name | `cof` |
| arbor_handler.fqn | `claude-2.1.183::cof` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.183 bundle.js:+12505539

---

## Input Branching

The command has more than three distinct branches across its preflight, confirmation, and launch phases. A Mermaid flowchart is used below.

```mermaid
flowchart TD
    A[/ultrareview invoked] --> B{allow_remote_sessions policy?}
    B -- disabled --> C[Error: Cloud sessions disabled by org policy]
    B -- enabled --> D{First-party Anthropic provider?}
    D -- no --> E[Error: Cloud sessions only available on first-party provider]
    D -- yes --> F{Claude.ai OAuth token present?}
    F -- no --> G[Error: Requires Claude.ai login — run /login]
    F -- yes --> H[Collect git context: remote URL, branch, diff stats]
    H --> I{Inside a git repo?}
    I -- no --> J[Error: not_in_git_repo]
    I -- yes --> K{GitHub remote detected?}
    K -- no --> L[Error: Cloud agents require a GitHub remote]
    K -- yes --> M[Call /v1/ultrareview/preflight API]
    M --> N{Preflight response}
    N -- essential-traffic-only mode --> O[Error: Ultrareview unavailable in essential-traffic-only mode]
    N -- data-residency / third-party provider --> P[Error: Ultrareview unavailable on third-party providers]
    N -- no_oauth_token --> Q[Error: Requires Claude.ai account — run /login]
    N -- schema_mismatch --> R[Error: api_ultrareview_preflight schema_mismatch]
    N -- request_failed --> S[Error: request_failed]
    N -- server blocked --> T[Error: Ultrareview unavailable for your organization]
    N -- needs-confirm --> U[Show cost/time confirmation dialog $10-$20 / ~10-20 min]
    N -- proceed --> V[Skip confirmation — launch directly]
    U -- user cancels --> W[Ultrareview cancelled.]
    U -- user confirms --> X[Resolve cloud environment]
    V --> X
    X --> Y{Environment available?}
    Y -- no default env --> Z[Error: Could not create a cloud environment]
    Y -- no environments --> AA[Error: No environments available for session creation]
    Y -- env selected --> AB[Detect bundle upload mode]
    AB --> AC{Source decision}
    AC -- explicit_source_url --> AD[Use explicit URL]
    AC -- git_repository --> AE[Upload git bundle to cloud]
    AC -- no_git_at_all --> AF[Empty sandbox session]
    AE --> AG{Bundle upload result}
    AG -- too_large --> AH[Error: repository too large]
    AG -- no_changes --> AI[Error: no changes to review]
    AG -- success --> AJ[POST session creation request to cloud]
    AD --> AJ
    AF --> AJ
    AJ --> AK{Session creation response}
    AK -- 401/403/429 --> AL[Auth/rate-limit error]
    AK -- github_repo_access_denied --> AM[GitHub access denied error]
    AK -- malformed_response --> AN[Error: no session id in response]
    AK -- success --> AO[Monitor remote session stream]
    AO --> AP{Session event type}
    AP -- result --> AQ[Display findings to user]
    AP -- hook_progress / hook_response --> AR[Stream progress updates]
    AP -- error / timeout 30 min --> AS[Error: cloud session returned an error / exceeded 30 minutes]
    AP -- completed / archived --> AT[Session done — show final output]
```

---

## Behavioral Spec

### 1. Entry Point: Policy and Auth Guard (`cof`)

The top-level async handler (`cof`) is the entry point resolved via `module_id` → `ZEl`.

```
async function ultrareviewHandler(context):
    if context.settings.allow_remote_sessions == false:
        show error: "Cloud sessions are disabled by your organization's policy. Contact your organization admin to enable them."
        emit telemetry: tengu_review_overage_blocked
        return

    if not isFirstPartyProvider(context):
        show error: "Cloud sessions are only available on the first-party Anthropic API provider."
        return

    if not hasOAuthToken(context):
        show error about needing /login
        return

    # Collect git metadata
    gitInfo = collectGitContext()  # calls getGitRemoteInfo, getCurrentBranch, getDiffStats

    # Parse --fix / --comment flags from user args
    flags = parseFlags(context.args, ["fix", "comment"])

    # Run preflight check
    preflightResult = await runPreflight(gitInfo)

    # Branch on preflight result
    await handlePreflightResult(preflightResult, gitInfo, flags, context)
```

Analysis basis: CC v2.1.183 bundle.js:+12503194

---

### 2. Pre-condition Check: Telemetry and Flag Parsing (`parseReviewFlags`)

```
function parseReviewFlags(rawArgs):
    args = rawArgs.trim().split(whitespace)
    flags = new Set()
    for token in args:
        normalized = token.toLowerCase().replace(leading_dashes, "")
        if normalized in ["fix", "comment"]:
            flags.add(normalized)
    # Also check for reference to "/code-review ultra" alias
    return flags
```

Analysis basis: CC v2.1.183 bundle.js:+12465251

---

### 3. Preflight API Call (`runPreflightCheck` → `MEl`)

```
async function runPreflightCheck(gitInfo):
    # Check essential-traffic-only mode before calling API
    if mode == "essential-traffic-only":
        return { status: "essential-traffic-only" }

    response = await httpGet("/v1/ultrareview/preflight", {
        headers: { "teleport-org": orgId }
    })

    if response.status == "data-residency" or provider == "zdr":
        return { status: "data_residency" }

    if not oauthToken:
        return { status: "no-auth", reason: "no_oauth_token" }

    emit telemetry: "api_ultrareview_preflight"

    if schemaInvalid(response):
        emit reason: "schema_mismatch"
        return error

    if requestFailed:
        emit reason: "request_failed"
        return error

    if response.action == "proceed":
        return { status: "proceed", serverData: response }

    if response.action == "needs-confirm":
        return { status: "needs-confirm", costEstimate: "$10-$20", timeEstimate: "~10–20 min" }

    if serverBlocked:
        return { status: "server", message: "Ultrareview is unavailable for your organization." }
```

Analysis basis: CC v2.1.183 bundle.js:+12463652 through +12464407

---

### 4. Confirmation Dialog (`confirmationUI` → `FTo`, `q4e`)

When the preflight returns `needs-confirm`, the UI displays a cost and time estimate dialog.

```
function showConfirmationDialog(costRange, timeEstimate):
    # costRange = "$10-$20"  (bundle.js:+8890576)
    # timeEstimate = "~10–20 min"  (bundle.js:+8890669)
    display modal with:
        - Estimated cost: costRange
        - Estimated time: timeEstimate
        - Confirm / Cancel buttons

    userChoice = await waitForUserInput()

    if userChoice == "cancel":
        return "cancelled"
    if userChoice == "confirm":
        return "confirmed"
```

Analysis basis: CC v2.1.183 bundle.js:+12468877, +8890576, +8890669

---

### 5. Cloud Environment Resolution (`resolveEnvironment` → `y6`, `qee`, `mst`)

```
async function resolveCloudEnvironment(context):
    # Phase: env-select  (bundle.js:+8571971)
    environments = await listTeleportEnvironments()

    if not isFirstParty:
        error: "Remote environments are only available on the first-party Anthropic API provider."
        return null

    if not hasOAuthToken:
        error: "Claude Code web sessions require authentication..."
        return null

    if environments is empty:
        # Attempt auto-create default environment
        defaultEnv = await createDefaultEnvironment("Default")  # (bundle.js:+7177123)
        emit telemetry: "teleport_default_environment_create"
        if creation fails:
            error: "Could not create a cloud environment. Set one up at https://claude.ai/code/onboarding?magic=env-setup"
            return null

    selectedEnv = pickEnvironment(environments)
    return selectedEnv
```

Analysis basis: CC v2.1.183 bundle.js:+7176225, +7177148, +8571971

---

### 6. Git Bundle Upload (`uploadGitBundle` → `Goo`, `Bge`)

```
async function uploadGitBundle(repoPath, sessionParams):
    # Phase: bundle-upload  (bundle.js:+8574912)
    emit telemetry: "teleport_git_bundle_upload"

    verifyNotEmptyRepo()  # check for commits: "Repository has no commits yet"

    # Create git stash refs for bundle seeding
    stashRef = createStashRef("refs/seed/stash")
    rootRef  = createStashRef("refs/seed/root")

    # Bundle generation with fallback strategies:
    # 1. head    — full HEAD bundle
    # 2. fallback_head — fallback HEAD strategy
    # 3. squashed — squash-merge bundle
    # 4. fallback_squashed — last resort
    bundle = await generateBundle(strategy)

    if bundle too large:
        emit telemetry: "tengu_ccr_bundle_max_bytes"
        return { status: "too_large" }

    uploadResult = await uploadBundleToServer(bundle, uploadUrl)

    if uploadResult.status != 200:
        return { status: "upload_failed" }

    return { status: "success", bundleRef: uploadResult }
```

Analysis basis: CC v2.1.183 bundle.js:+8553204, +8554529, +8550149

---

### 7. Remote Session Creation and Monitoring (`teleportToRemote` → `y6`)

```
async function createAndMonitorRemoteSession(env, gitBundle, task, flags):
    # Phase: POST-sent  (bundle.js:+8576940)

    payload = buildSessionPayload({
        environment: env,
        bundle: gitBundle,
        task: task,
        type: "ultrareview",   # (bundle.js:+12471005)
        fixMode: flags.has("fix"),
    })

    if flags.has("fix"):
        # Append fix instruction to system prompt  (bundle.js:+12502933)
        payload.systemSuffix = " The user passed --fix: when the findings arrive, apply them to the local working tree."

    response = await httpPost("/ultrareview", payload)  # (bundle.js:+12471936)

    if response.status in [401, 403, 429]:
        return error(response)
    if response.status == "github_repo_access_denied":
        return error("github_repo_access_denied")
    if not response.sessionId:
        return error("malformed_response", "Server returned a malformed session response (no session id)")

    emit telemetry: "tengu_review_remote_launched"
    emit telemetry: "tengu_ccr_session_link"

    # Monitor the streaming session — timeout: 1800000ms (30 min)  (bundle.js:+8589978)
    await monitorSessionStream(response.sessionId, maxDuration=1800000)
```

Analysis basis: CC v2.1.183 bundle.js:+8568152, +8571094, +8571760, +8571823, +12471005, +12471936, +8589978

---

### 8. Session Stream Handler (`monitorRemoteSession` → `gDa`)

```
async function monitorSessionStream(sessionId):
    startTime = Date.now()
    timeout = 1800000  # 30 minutes  (bundle.js:+8589978)

    loop:
        event = await readNextStreamEvent(sessionId)

        if event.type == "result":
            displayFindings(event.data)
            break

        if event.type == "hook_progress":
            streamProgressUpdate(event)

        if event.type == "hook_response":
            handleHookResponse(event)

        if event.type == "hook_started":
            recordHookStart(event)

        if event.type == "SessionStart":
            markSessionStarted()

        if sessionState == "completed" or sessionState == "archived":
            break

        if (Date.now() - startTime) > timeout:
            error: "cloud session exceeded 30 minutes"
            break

        if sessionState == "error":
            error: "cloud session returned an error"
            break

    if no review output received:
        warn: "no review output — orchestrator may have exited early"
```

Analysis basis: CC v2.1.183 bundle.js:+8590497, +8590422, +8591168, +8591197, +8591688, +8591778, +8592005, +8592579, +8592619, +8592655

---

### 9. Git Remote and Branch Utilities

```
function getGitRemoteUrl(repoPath):
    # Runs: git config --get remote.origin.url  (bundle.js:+1150834)
    url = execGit(["config", "--get", "remote.origin.url"])
    if not url:
        return { error: "No git remote URL found" }  # (bundle.js:+1150963)
    # Redact credentials from URL  (bundle.js:+1154147): "://***@"
    return sanitizeUrl(url)

function getCurrentBranch(repoPath):
    # Runs: git branch --abbrev-ref HEAD  (bundle.js:+1162110)
    branch = execGit(["branch", "--abbrev-ref", "HEAD"])
    return branch.trim()

function getDefaultBranch(repoPath):
    # Tries: git symbolic-ref --short refs/remotes/origin/HEAD  (bundle.js:+1162282)
    # Falls back to "main" then "master"  (bundle.js:+1162420, +1162427)
    result = execGit(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"])
    if fails: return "main"

function getDiffStats(baseBranch, currentBranch):
    # Runs: git merge-base  (bundle.js:+12467634)
    mergeBase = execGit(["merge-base", "--verify", "--quiet", baseBranch, currentBranch])
    # Runs: git diff --shortstat  (bundle.js:+12468141, +12468148)
    stats = execGit(["diff", "--shortstat", mergeBase])
    return parseDiffStats(stats)
```

Analysis basis: CC v2.1.183 bundle.js:+1150834, +1162110, +1162282, +12467634, +12468141

---

### 10. GitHub App Installation Check (`checkGithubAppInstalled` → `Ast`, `T3e`)

```
async function checkGithubAppInstalled(remoteUrl, orgUuid):
    # Runs git rev-parse --is-inside-work-tree  (bundle.js:+7178452, +7178464)
    insideRepo = execGit(["rev-parse", "--is-inside-work-tree"])

    if not accessToken:
        log: "checkGithubAppInstalled: No access token found, assuming app not installed"
        return false  # (bundle.js:+7178599)

    if not orgUuid:
        log: "checkGithubAppInstalled: No org UUID found, assuming app not installed"
        return false  # (bundle.js:+7178712)

    response = await httpGet(githubAppCheckEndpoint)

    if response.status == 400:
        return false  # (bundle.js:+7179370)

    return response.installed  # logs "is" or "is not"  (bundle.js:+7179110, +7179115)
```

Analysis basis: CC v2.1.183 bundle.js:+7178386, +7178599, +7178712

---

### 11. Overage / Cost Guard

```
function checkCostOverage(context):
    if overage policy blocks launch:
        emit telemetry: "tengu_review_overage_blocked"  # (bundle.js:+12503528)
        display admin settings link: "/admin-settings/"  # (bundle.js:+12503650)
        return blocked

    if overage dialog should be shown:
        emit telemetry: "tengu_review_overage_dialog_shown"  # (bundle.js:+12503865)
        show overage dialog
```

Analysis basis: CC v2.1.183 bundle.js:+12503528, +12503650, +12503865

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_review_remote_precondition_failed` (bundle.js:+12465390), `tengu_review_overage_blocked` (+12503528), `tengu_review_overage_dialog_shown` (+12503865), `tengu_review_remote_teleport_failed` (+12471765), `tengu_review_remote_launched` (+12472286), `tengu_review_bughunter_config` (+8890459), `tengu_ccr_bundle_max_bytes` (+8550149), `tengu_ccr_bundle_upload` (+8553526), `tengu_ccr_bundle_seed_enabled` (+7181095), `tengu_ccr_session_link` (+8563535), `tengu_teleport_bundle_mode` (+8570221), `tengu_teleport_source_decision` (+8575822), `tengu_teleport_generate_title` (+8556915), `tengu_teleport_git_bundle_upload` (+8553233), `tengu_teleport_environments_list` (+7176228), `tengu_teleport_default_environment_create` (+7177148), `tengu_bg_dispatch_sigkill_escalate` (+17275023), `tengu_bg_low_mem_mb` (+13292202), `tengu_bg_spare_claim` (+17276449), `tengu_bg_spare_enable` (+17276321), `tengu_bg_sendclaim_failed` (+17251555), `tengu_daemon_config_reload` (+17290894), `tengu_daemon_control` (+17311864), `tengu_feature_ok` (+1021887), `tengu_feature_bad` (+1021954), `tengu_feature_sad` (+1022035), `tengu_scheduled_task_missed` (+16742321) |
| Network calls | `GET /v1/ultrareview/preflight` (preflight check); `POST /ultrareview` (session creation); streaming session event poll |
| Git operations | `git rev-parse`, `git config --get remote.origin.url`, `git branch --abbrev-ref HEAD`, `git symbolic-ref`, `git merge-base`, `git diff --shortstat`, `git stash create`, `git for-each-ref`, `git bundle create` |
| GitHub CLI | `gh pr view --repo --json additions,deletions,changedFiles` with 5000ms timeout (bundle.js:+12466582) |
| File system | Writes git bundle temp files; reads/writes `.claude/` directory for session state; may write `pins.json` |
| appState changes | Session state transitions: `pending → running → completed/archived/error`; remote session roster entry updated |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| --fix side effect | When `--fix` flag is present, findings are applied to the local working tree after the remote session completes (bundle.js:+12502933) |
| Cancellation | On user cancel, emits "Ultrareview cancelled." (bundle.js:+12504173) |

---

## Key Constants and Limits

| Constant | Value | Location |
|---|---|---|
| Estimated cost display | `$10-$20` | bundle.js:+8890576 |
| Estimated time display | `~10–20 min` | bundle.js:+8890669 |
| Session timeout | `1800000 ms` (30 min) | bundle.js:+8589978 |
| Max git objects threshold | `5000000` | bundle.js:+8550675 |
| GitHub CLI PR stats timeout | `5000 ms` | bundle.js:+12466582 |
| Preflight endpoint | `/v1/ultrareview/preflight` | bundle.js:+12463727 |
| Session endpoint | `/ultrareview` | bundle.js:+12471936 |
| Default branch fallbacks | `main`, `master` | bundle.js:+1162420, +1162427 |
| Bundle title prompt max tokens | `75` | bundle.js:+8556611 |
| Admin settings link | `/admin-settings/` | bundle.js:+12503650 |
| Self-onboarding env setup URL | `https://claude.ai/code/onboarding?magic=env-setup` | bundle.js:+8572237 |
| Beta header for BYOC | `ccr-byoc-2025-07-29` | bundle.js:+8569871 |

---

## Version History

| Version | Change |
|---|---|
| v2.1.183 | Initial analysis |

---

## Common Mistakes

1. **Not logged in with Claude.ai**: The command requires a Claude.ai OAuth token, not just an `ANTHROPIC_API_KEY`. Running `/login` is required. Error: "Ultrareview requires a Claude.ai account. Run /login to authenticate." (bundle.js:+12464137).

2. **No GitHub remote configured**: The repository must have a GitHub remote (`remote.origin.url` pointing to `github.com`). Pure local repos or non-GitHub remotes will fail with the "Cloud agents require a GitHub remote" error (bundle.js:+8583586).

3. **Organization policy blocking remote sessions**: The `allow_remote_sessions` policy must be enabled at the org level. If disabled, the error "Cloud sessions are disabled by your organization's policy. Contact your organization admin to enable them." is shown (bundle.js:+12503231).

4. **Running in essential-traffic-only mode**: When network policy restricts traffic to essential-only, Ultrareview is blocked entirely: "Ultrareview runs in Claude Code on the web and is unavailable when essential-traffic-only mode is active." (bundle.js:+12463857).

5. **Empty repository or no commits**: The cloud agent requires at least one commit. An empty repository triggers "Repository has no commits — run `git add . && git commit -m "initial"` then retry" (bundle.js:+8575251).

6. **Using `--fix` flag without understanding local write-back**: When `--fix` is passed, findings are applied to the local working tree after the remote session completes. Users should commit or stash local changes before running with `--fix` to avoid unexpected modifications.

7. **Third-party API provider**: Ultrareview only works with the first-party Anthropic API provider. Using a third-party or data-residency provider returns "Ultrareview runs in Claude Code on the web and is unavailable on third-party providers." (bundle.js:+12464004).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `cof` | Top-level `/ultrareview` async command handler (entry point) |
| `di` | First-party / policy gate check function |
| `oAi` | Outer policy validation wrapper |
| `Cz` | Core policy check orchestrator |
| `pB` | Permission/policy field evaluator |
| `Oxt` | Config file reader for policy values |
| `Mme` | Telemetry mode resolver (essential-traffic, no-telemetry, default) |
| `ra` | Traffic mode string resolver |
| `eJo` | Traffic mode enum helper |
| `st` | Generic string coercion utility |
| `Eme` | Error message string builder |
| `Fs` | CLI fatal error handler (writes error, exits process) |
| `yje` | Console error formatter |
| `eI` | Error file writer |
| `OEl` | Flag/args parser for ultrareview subcommand |
| `Oqn` | Token normalizer for flag parsing |
| `V0` | Regex escape helper |
| `n3e` | MCP connection orchestrator |
| `uZn` | MCP connection slot applier |
| `mta` | MCP server config initializer |
| `T` | System prompt / message builder |
| `B1o` | MCP client list and reconnect manager |
| `UTo` | Core ultrareview launch function (git context, environment, bundle) |
| `Ast` | Git repo verifier (`git rev-parse --is-inside-work-tree`) |
| `Mt` | Git command executor |
| `Qen` | Async store getter |
| `Ar` | Generic async runner |
| `qr` | Git command runner with timeout |
| `zOe` | Child process spawner for git |
| `p` | Forced shutdown handler |
| `_Xc` | ERR_CHILD_PROCESS_STDIO_MAXBUFFER handler |
| `Gp` | Git process output aggregator |
| `dn` | Debug logger |
| `HXc` | stdio maxbuffer error code checker |
| `De` | Error event logger with push to error array |
| `j` | React/UI render helper |
| `XO` | Git remote URL fetcher and cacher |
| `mK` | Remote URL cache store |
| `Rtn` | Remote URL cache getter |
| `$Ke` | URL credential redactor (`://***@`) |
| `goe` | Git remote URL parser and branch resolver |
| `Mes` | Git branch range parser |
| `FKe` | HTTPS URL format checker |
| `Di` | URL slice/index helper |
| `Un` | Git branch/ref command runner |
| `f` | Background session manager (daemon process handler) |
| `M` | Remote session daemon spawner |
| `Dtt` | Session config file reader |
| `d` | Daemon supervisor process writer |
| `CQ` | Daemon config watcher |
| `CMt` | Daemon config directory writer |
| `J1i` | Session expiry filter |
| `g` | IPC buffer/socket reader |
| `u` | Daemon stop handler |
| `k` | Daemon mtime-change watcher |
| `h` | Session timeout scheduler |
| `q` | Session map |
| `Jnc` | Session change message formatter |
| `fae` | Session roster file updater |
| `Bn` | Abort/timeout race wrapper |
| `c` | Abort signal handler |
| `Re` | Async feature flag OK reporter |
| `Ue` | Feature flag event emitter |
| `ke` | Feature flag error reporter |
| `YKn` | Low-memory threshold checker |
| `ct` | Memory cache store (pIe) |
| `B$e` | Pins file reader/writer |
| `nDt` | Pins file path builder |
| `Gt` | JSON.parse safe wrapper |
| `Mn` | Debug log helper |
| `zAd` | Directory recursive file lister |
| `$` | Permission policy resolver |
| `zlt` | Policy rule evaluator (allow/deny/warn/classify) |
| `R6` | Rule chain executor |
| `NNo` | IPC socket claim sender |
| `Nko` | Daemon socket file writer |
| `f6f` | Send-claim timeout/retry handler |
| `p6f` | Claim frame builder |
| `wp` | Debug log with errno |
| `Ee` | String coercion for error codes |
| `FM` | IPC binary frame encoder |
| `jNo` | Background session lifecycle manager |
| `Ic` | Session socket path builder |
| `fa` | File watcher / session state file reader |
| `pg` | Session active-state checker |
| `OCe` | Session change categorizer |
| `Pp` | Session path helper |
| `rft` | Session roster timing recorder |
| `P6t` | Session roster path builder (qh.join + M6t) |
| `e_e` | Session extended error writer |
| `iD` | Session late-write handler |
| `BN` | Session UUID/path setup |
| `WM` | Session late-cleanup handler |
| `R6t` | Session roster entry writer |
| `hio` | Cost/token count display formatter |
| `W4e` | Token count aggregator |
| `H` | Usage/cost locale string formatter |
| `I4e` | Teammate mailbox reader |
| `b4e` | Mailbox config path builder |
| `Og` | Object merge helper |
| `Wge` | Mailbox message reader |
| `Wn` | Message type guard |
| `vlt` | Message filter |
| `ci` | Async local store getter |
| `Pe` | JSON.stringify safe wrapper |
| `dDa` | Git object count checker (`git count-objects -v`) |
| `uDa` | Git count-objects runner |
| `cDa` | Memory cache check for object count |
| `CR` | Default branch resolver (`git symbolic-ref`) |
| `oAr` | Default branch cache getter |
| `C_` | Current branch resolver (`git branch --abbrev-ref HEAD`) |
| `nAr` | Current branch cache getter |
| `oBn` | Diff stat parser (additions/deletions/changedFiles) |
| `FTo` | Confirmation UI renderer |
| `MEl` | Preflight API caller and response handler |
| `DEl` | Preflight request builder |
| `PTo` | Preflight error display renderer |
| `Pt` | Async feature-sad reporter |
| `q4e` | Confirmation dialog cost display component |
| `pct` | Session plan/subscription type resolver |
| `WD` | Subscription plan getter |
| `ZTe` | Subscription type formatter |
| `Mc` | Auth/plan check coordinator |
| `hy` | Auth context reader |
| `Ct` | App state recorder with timestamp |
| `vo` | Subscription tier checker |
| `Y2` | Plan type array checker |
| `TC` | Team/org role checker |
| `sa` | Role membership validator |
| `yIr` | Role "max" checker |
| `_Ir` | Role "pro" checker |
| `Cte` | Cost estimate display component (token cost widget) |
| `lof` | Outer ultrareview JSX component wrapper |
| `$To` | Core teleport-to-remote session launcher |
| `rce` | Remote eligibility pre-checker |
| `oca` | Background remote eligibility checker |
| `E` | Concurrency limiter (Math.max/min) |
| `_` | Promise-all parallel task runner |
| `hte` | Session header/title component |
| `xPa` | Cost display sub-component |
| `y6` | Full remote session creation and monitoring function |
| `Ac` | Tool permission helper |
| `Lh` | OAuth token refresh helper |
| `lFn` | Session message formatter |
| `X2` | Session event type router |
| `Ps` | OAuth environment URL validator |
| `YE` | HTTP client with bearer token |
| `Goo` | Git bundle upload orchestrator |
| `Lt` | Generic logger |
| `Qe` | UI render primitive |
| `fDa` | Remote session event emitter / UUID generator |
| `oNt` | Object key enumerator for session payload |
| `ne` | Event handler registrar |
| `pDa` | Session link display component |
| `zkn` | Session phase logger |
| `qee` | Cloud environment list fetcher |
| `mst` | Default cloud environment creator |
| `Ehp` | Session title generator (LLM call for `claude/task` prompt) |
| `oF` | App state feature flag reader |
| `T3e` | GitHub App installation checker |
| `js` | HTTP client factory |
| `K` | IPC stream writer |
| `re` | Session result parser |
| `Ho` | Error string coercer |
| `hH` | Cancel/abort check |
| `KH` | HTTP cancellation checker |
| `Bge` | Remote agent session creator (top-level POST) |
| `d3` | Random bytes / session ID generator |
| `mlt` | OS browser opener |
| `u0` | Pending status poller |
| `xhp` | Session URL string builder |
| `gDa` | Remote session event stream monitor |
| `oce` | Session UI display component |
| `Sy` | UI layout component |
| `aof` | Component list mapper |
| `NTo` | Cancellation / cleanup handler |