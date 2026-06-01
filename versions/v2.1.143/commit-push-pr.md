---
type: feature-spec
feature: "commit-push-pr"
cc_version: "2.1.143"
updated: "2026-06-01"
tags: ["commit-push-pr", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.143 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/commit-push-pr`

> Analysis basis: CC v2.1.143 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.143

---

## Overview

`/commit-push-pr` is a `prompt`-type slash command that automates the full Git workflow: it stages and commits changes, pushes the branch to the remote, and opens (or updates) a GitHub Pull Request. The command constructs a prompt via `getPromptForCommand`, resolves environment context (current branch, default branch, existing PR number), then hands the assembled instruction to the agent for execution via Bash tools.

---

## Registration

| Field | Value |
|---|---|
| type | `prompt` |
| name | `commit-push-pr` |
| description | `Commit, push, and open a PR` |
| loc_byte | `10127996` |
| loc_byte_end | `10128737` |
| loc_line | `5720` |
| handler_method | `getPromptForCommand` |
| handler_method_start | `10128200` |
| handler_method_end | `10128736` |
| prompt_body.length | `203` |
| prompt_body.trace | `call→nHH(...) (1 literals)` |
| arbor_handler.name | `getPromptForCommand` |
| arbor_handler.fqn | `claude-2.1.143::getPromptForCommand` |
| arbor_handler.kind | `Method` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `4` |

Analysis basis: CC v2.1.143 bundle.js:+10127996

---

## Input Branching

The handler follows 4+ distinct branches based on shell environment, existing PR presence, default-branch resolution, and platform (bash vs. PowerShell). A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/commit-push-pr invoked"] --> B["getPromptForCommand called\n(bundle.js:+10128206)"]
    B --> C["Resolve tool permission context\n(_.getToolPermissionContext)\n(bundle.js:+10128442)"]
    B --> D["Resolve app state\n(_.getAppState)\n(bundle.js:+10128558)"]
    B --> E["Parallel environment resolution\nPromise.all\n(bundle.js:+10128246)"]

    E --> F["CV: resolve default branch\n(bundle.js:+10128259)"]
    E --> G["OAq: resolve git remote info\n(bundle.js:+10128264)"]
    E --> H["hKq: resolve PR metadata\n(bundle.js:+10128287)"]

    F --> F1["git symbolic-ref --short\nrefs/remotes/origin/HEAD\n(bundle.js:+1059626)"]
    F1 --> F2{Branch resolved?}
    F2 -- yes --> F3["Use resolved branch name"]
    F2 -- no --> F4["Fallback: check 'main'\n(bundle.js:+1059739)"]
    F4 --> F5{main exists?}
    F5 -- yes --> F3
    F5 -- no --> F6["Fallback: check 'master'\n(bundle.js:+1059746)"]

    G --> G1["fSH: list git remotes\n(bundle.js:+9819754)"]
    G --> G2["OAq pipeline: filter messages,\ncollect file stats, PR attribution\n(bundle.js:+9820204)"]

    H --> H1["YK: check for existing PR\ngh pr view --json number\n(bundle.js:+10125073)"]
    H1 --> H2{Platform?}
    H2 -- bash --> H3["gh pr view --json number 2>/dev/null || true\n(bundle.js:+10125073)"]
    H2 -- powershell --> H4["gh pr view --json number 2>$null; if (-not $?) { \"\" }\n(bundle.js:+10125120)"]
    H3 --> H5{PR number found?}
    H4 --> H5
    H5 -- yes --> H6["Instruct agent to update existing PR"]
    H5 -- no --> H7["Instruct agent to create new PR"]

    B --> I["nHH: assemble prompt\n(bundle.js:+10128397)"]
    I --> J{Shell environment valid?}
    J -- bash available --> K["Build full commit/push/PR prompt\nwith attribution suffix\n(bundle.js:+10126256)"]
    J -- bash missing on Windows --> L["Error: Git Bash not found\nInstruct user to install Git for Windows\nor switch to powershell shell\n(bundle.js:+10128397 via nHH)"]
    K --> M["Deliver prompt to agent"]
```

---

## Behavioral Spec

### 1. Handler Entry — `getPromptForCommand`

The registered `handler_method` is `getPromptForCommand`, resolved by Arbor as a `Method` directly within the registration byte range `(10127996, 10128737)`.

```
method getPromptForCommand(context):
    permissionCtx  = context.getToolPermissionContext()   // bundle.js:+10128442
    appState       = context.getAppState()                // bundle.js:+10128558

    [defaultBranch, remoteInfo, prMeta] = await Promise.all([
        resolveDefaultBranch(context),                    // CV, bundle.js:+10128259
        resolveRemoteAndMessages(context),                // OAq, bundle.js:+10128264
        resolvePRMetadata(context),                       // hKq, bundle.js:+10128287
    ])

    promptText = buildPrompt(                             // nHH, bundle.js:+10128397
        defaultBranch,
        remoteInfo,
        prMeta,
        appState,
        permissionCtx
    )
    return promptText
```

Analysis basis: CC v2.1.143 bundle.js:+10128200

---

### 2. Default Branch Resolution — `resolveDefaultBranch` (CV)

Uses `git symbolic-ref` to discover the remote HEAD, falling back through `main` and `master`.

```
async function resolveDefaultBranch(context):
    result = await runGitCommand(
        ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]
    )                                                     // bundle.js:+1059601, +1059616, +1059626

    if result.success:
        branch = result.stdout.trim()                     // bundle.js:+1059696
        store branch as "defaultBranch"                   // bundle.js:+1048845
        return branch

    // fallback 1
    if gitRefExists("refs/heads/main"):                   // bundle.js:+1059739
        return "main"

    // fallback 2
    if gitRefExists("refs/heads/master"):                 // bundle.js:+1059746
        return "master"

    // show-ref --verify --quiet used for existence check
    // bundle.js:+1059808, +1059819, +1059830
    return null
```

Analysis basis: CC v2.1.143 bundle.js:+1059550

---

### 3. Remote and Message Context Resolution — `resolveRemoteAndMessages` (OAq)

Gathers git remote name, conversation message history, and PR attribution hint.

```
async function resolveRemoteAndMessages(context):
    remoteName = await getGitRemote()                     // fSH, bundle.js:+9819754
    // literal "remote" used as git subcommand           // bundle.js:+9819762

    messages   = await filterMessages(context)            // z$6, bundle.js:+9819868
    // filters by type: "text","image","document"        // bundle.js:+9818632..9818744
    // excludes sidechain, meta, compact-summary messages // bundle.js:+9818831..9818899

    prAttribution = resolvePRAttribution(context)         // R_, bundle.js:+9819907
    // logs "PR Attribution: returning default (no data)" // bundle.js:+9820535
    //   when no attribution data available

    fileStats = await collectFileStats(context)           // Qf7, bundle.js:+9820334
    // walks staged/changed files via git diff --cached  // bundle.js:+6739476..6739483
    // uses --name-status flag                           // bundle.js:+6739494
    // timeout: 5000 ms                                  // bundle.js:+6739533
    // detects deletions via "D\t" prefix                // bundle.js:+6739598

    memoryContext = resolveMemory(context)                // x18, bundle.js:+9820347
    // keys: "memory", "memories"                        // bundle.js:+9820610, +9820619

    return { remoteName, messages, prAttribution, fileStats, memoryContext }
```

Analysis basis: CC v2.1.143 bundle.js:+9819754

---

### 4. PR Metadata Resolution — `resolvePRMetadata` (hKq)

Queries `gh` CLI for an existing PR number; chooses the correct shell-quoting variant.

```
async function resolvePRMetadata(context):
    shell = detectShell(context)                          // nHH→YK, bundle.js:+10125068

    if shell == "bash":
        cmd = "gh pr view --json number 2>/dev/null || true"
        //                                               bundle.js:+10125073
    else:  // powershell
        cmd = "gh pr view --json number 2>$null; if (-not $?) { \"\" }"
        //                                               bundle.js:+10125120

    result = await runShellCommand(cmd)                   // YK→d6, bundle.js:+3194158

    prNumber = parseJSONNumber(result.stdout)

    // RKq: sanitize branch name in PR title            // bundle.js:+10124206, +10127603
    sanitizedBranch = currentBranch.replace(regex, replacement)

    return { prNumber, sanitizedBranch }
```

Analysis basis: CC v2.1.143 bundle.js:+10128287

---

### 5. Prompt Assembly — `buildPrompt` (nHH)

Constructs the final agent instruction string from all resolved context.

```
async function buildPrompt(defaultBranch, remoteInfo, prMeta, appState, permissionCtx):
    // Validate shell availability
    shellType = resolveShellType(appState)               // nHH→YK, bundle.js:+9524748

    if shellType == "bash":
        pass
    elif shellType == "powershell":
        // powershell path supported                     // bundle.js:+9524985
        pass
    else:
        throw Error("shell not available")               // nHH→Error, bundle.js:+9524759

    // Check for bash requirement on Windows
    // If shell: bash required but Git Bash absent, raise error instructing:
    //   install Git for Windows (https://git-scm.com/downloads/win)
    //   or change skill frontmatter to shell: powershell
    // (prompt_body text, bundle.js:+10128397)

    // Scan existing messages for tool-use context       // nHH→H.matchAll, bundle.js:+9525026
    // Check for "!`" escape prefix in commands         // bundle.js:+9525055
    // If found, strip/replace                          // j68→H.replace, bundle.js:+4847453

    // Assemble prompt sections via ZHq helper:
    parts = []
    if prMeta.prNumber exists:
        parts.push(updateExistingPRInstruction(prMeta))
    else:
        parts.push(createNewPRInstruction(defaultBranch, remoteInfo))

    // Append attribution suffix when applicable:
    // ", ending with the attribution text shown in the example below"
    //                                                   bundle.js:+10126256
    parts.push(attributionInstruction)

    // Coerce tool results to text                       // BFH, bundle.js:+9525490
    // Generate random UUID for request tracking        // nHH→EHq.randomUUID, bundle.js:+9525498

    prompt = ZHq.join(parts)                             // ZHq→q.join, bundle.js:+9525810
    return prompt
```

Analysis basis: CC v2.1.143 bundle.js:+10128397

---

### 6. Shell Execution Infrastructure — `runGitCommand` / `runShellCommand` (KXH / $_)

Underlying command execution used by both `resolveDefaultBranch` and `resolvePRMetadata`.

```
async function runShellCommand(cmd, opts):
    // Platform detection: win32                        // bundle.js:+1036556
    // On Windows: wraps with cmd /q                   // bundle.js:+1036598, +1036614
    // Appends .exe suffix where needed                 // bundle.js:+1036588
    // Encoding: utf8                                   // bundle.js:+1036437

    // Spawn process via Bun.spawn / child_process      // $o_→Bun.spawn, bundle.js:+14483903
    // stdout/stderr captured as streams                // bundle.js:+1026015, +1026075

    // Timeout logic (WOA):
    //   setTimeout for deadline                        // bundle.js:+1024924
    //   Promise.race between result and timeout        // bundle.js:+1024999
    //   clearTimeout on completion                     // bundle.js:+1024974
    //   SIGTERM sent on timeout                        // bundle.js:+1024848

    // Output size limit: 1,000,000 bytes               // bundle.js:+1038694
    // Output lines limit: 10 lines (internal buffer)   // bundle.js:+1038552

    return { stdout, stderr, exitCode }
```

Analysis basis: CC v2.1.143 bundle.js:+1033906

---

### 7. Tool Permission Enforcement — `permissionCheck` (OJ / K$7)

Before the agent executes Bash commands, the permission subsystem is consulted.

```
async function checkBashPermission(cmd, permissionCtx):
    // Rules evaluated in order:
    // 1. "deny"  — hard block              // bundle.js:+9896109
    // 2. "rule"  — pattern match           // bundle.js:+9896137
    // 3. "ask"   — prompt user             // bundle.js:+9896363
    // 4. "allow" — proceed                 // bundle.js:+9897315

    if sandboxingEnabled(permissionCtx):    // c_.isSandboxingEnabled, bundle.js:+9888180
        if autoAllowBashIfSandboxed:        // bundle.js:+9896300
            return allow

    if autoModeActive:
        result = runAutoModeClassifier()    // NJ6, bundle.js:+9901894
        // Classifier stages: "fast" then "thinking"   // bundle.js:+8113328, +8113340
        // Timeout category: wall_clock_timeout         // bundle.js:+8114183
        // On unavailable (fail-closed in headless):
        //   emit tengu_iron_gate_closed               // bundle.js:+9904751
        return result

    // Dangerous operation guards:
    // "Dangerous rm operation"            // bundle.js:+9897078
    // "Dangerous rmdir operation"         // bundle.js:+9897125
    if isDangerousCommand(cmd):
        return deny

    return interactivePermissionPrompt()
```

Analysis basis: CC v2.1.143 bundle.js:+9896052

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_bg_spare_enable` | Background spare process enable event (bundle.js:+14502634) |
| Telemetry — `tengu_bg_low_mem_mb` | Low-memory warning for background process (bundle.js:+11972252) |
| Telemetry — `tengu_bg_spare_spawn` | Background spare process spawned (bundle.js:+14502994) |
| Telemetry — `tengu_daemon_config_reload` | Daemon configuration reloaded (bundle.js:+14517117) |
| Telemetry — `tengu_daemon_control` | Daemon control event (bundle.js:+14538273) |
| Telemetry — `tengu_cobalt_ridge` | Internal platform event (bundle.js:+3194116) |
| Telemetry — `tengu_auto_mode_fallback_to_ask` | Auto-mode classifier fell back to ask (bundle.js:+9900142) |
| Telemetry — `tengu_auto_mode_decision` | Auto-mode permission decision recorded (bundle.js:+9900934) |
| Telemetry — `tengu_auto_mode_config` | Auto-mode configuration snapshot (bundle.js:+8113136) |
| Telemetry — `tengu_auto_mode_malformed_tool_input` | Malformed tool input in auto mode (bundle.js:+8098720) |
| Telemetry — `tengu_auto_mode_outcome` | Final auto-mode outcome (bundle.js:+8113996) |
| Telemetry — `tengu_bash_allowlist_strip_all` | All bash allowlist entries stripped (bundle.js:+9902247) |
| Telemetry — `tengu_iron_gate_closed` | Classifier unavailable, fail-closed in headless mode (bundle.js:+9904751) |
| Telemetry — `tengu_auto_mode_denial_limit_exceeded` | Too many classifier denials in headless mode (bundle.js:+9894233) |
| Telemetry — `tengu_tool_empty_result` | Tool returned empty result (bundle.js:+4849201) |
| Telemetry — `tengu_tool_result_persisted` | Tool result written to conversation store (bundle.js:+4849441) |
| Shell invocation | Runs `git symbolic-ref`, `git show-ref`, `git remote`, `git diff --cached --name-status`, `gh pr view` via Bash or PowerShell subprocess |
| Permission context read | `_.getToolPermissionContext()` called at handler entry (bundle.js:+10128442) |
| App state read | `_.getAppState()` called at handler entry (bundle.js:+10128558) |
| File I/O | `git diff --cached` stat output written through logging pipeline (bundle.js:+6739476) |
| Background daemon | Spare process management potentially triggered (bundle.js:+14502634) |
| Conversation store | Tool results persisted via `tengu_tool_result_persisted` (bundle.js:+4849441) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.143 | Initial analysis |

---

## Common Mistakes

1. **Running on Windows without Git Bash**: The command's prompt body explicitly requires Bash (`shell: bash`) for certain operations. If Git Bash is not installed, the command will emit an error directing the user to install Git for Windows (`https://git-scm.com/downloads/win`) or switch to `shell: powershell` in the skill frontmatter. Analysis basis: CC v2.1.143 bundle.js:+10128397.

2. **No `gh` CLI installed**: The command calls `gh pr view --json number` to detect an existing PR. If `gh` is absent or not authenticated, this sub-command will return empty output and the agent will always attempt to create a new PR rather than update an existing one. Analysis basis: CC v2.1.143 bundle.js:+10125073.

3. **Untracked files not staged**: `/commit-push-pr` operates on Git-tracked and staged changes. Untracked files that have never been `git add`-ed will not appear in `git diff --cached` and will be silently omitted from the commit. Analysis basis: CC v2.1.143 bundle.js:+6739476.

4. **Detached HEAD state**: Default-branch resolution via `git symbolic-ref --short refs/remotes/origin/HEAD` requires a valid remote HEAD pointer. In a detached HEAD or a repo with no remote, all three fallback strategies (symbolic-ref → `main` → `master`) may fail, leaving `defaultBranch` as `null` and causing the PR creation instruction to be incomplete. Analysis basis: CC v2.1.143 bundle.js:+1059601.

5. **Auto-mode classifier denial loop**: In headless (non-interactive) sessions, repeated classifier denials trigger `tengu_auto_mode_denial_limit_exceeded` and abort the agent with `"Agent aborted: too many classifier denials in headless mode"`. Users should pre-authorize `git`, `gh`, and related commands via Bash permission rules. Analysis basis: CC v2.1.143 bundle.js:+9894233.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `__handler_commit-push-pr` | Synthetic BFS entry point for the command handler |
| `CV` | Default branch resolver (runs `git symbolic-ref` / fallback checks) |
| `Wu8` | Git branch cache getter (`defaultBranch` key lookup) |
| `$_` | Shell command runner wrapper (dispatches to `KXH`) |
| `KXH` | Core shell execution engine (spawn, streams, timeout) |
| `YzA` | Process stdio setup helper |
| `qu8` | Stdout stream collector |
| `Ku8` | Stderr stream collector |
| `fu8` | Combined output stream handler |
| `GOA` | Exit code validator (`Number.isFinite` guard) |
| `hA6` | Error formatter for shell failures |
| `Au8` | `Reflect.apply` wrapper for shell calls |
| `oOA` | Process event listener registrar (`exit`, `error`) |
| `WOA` | Shell command timeout manager (`setTimeout` / `Promise.race`) |
| `TOA` | Process kill handler (`H.kill`) |
| `POA` | Process spawn initializer |
| `XOA` | Force-kill helper |
| `iOA` | Parallel stream reader (`Promise.all`) |
| `xA6` | Output encoding handler (`mx8`) |
| `lOA` | Pipe setup for stdout |
| `nOA` | Pipe setup with `QOA.default` |
| `IOA` | Stream bind helper (`nx8.bind`) |
| `D` | Agent loop / conversation manager |
| `G6` | Conversation state machine |
| `$` | Dispose handler for conversation resources |
| `IG6` | Memory-aware conversation initializer |
| `$o_` | Background daemon spare process spawner |
| `d` | Internal utility / small helper |
| `NH` | Error logger (`Wc.logError`) |
| `_SK` | String coercion helper |
| `OAq` | Remote/message context resolver |
| `fSH` | Git remote lister |
| `z$6` | Message filtering utility |
| `rY` | Environment/URL resolver |
| `s_` | Module initialization helper |
| `dZ6` | Settings/config bind helper |
| `q` | File cleanup helper (`n8K.unlinkSync`) |
| `L$_` | Local URL resolver |
| `l84` | Local settings loader |
| `R_` | Settings loader from disk |
| `Lu` | Settings load orchestrator |
| `ah` | Settings validation helper |
| `P1` | Memory usage tracker |
| `nm8` | Settings load event emitter |
| `WB` | Settings subsystem initializer |
| `yV6` | Post-settings-load hook |
| `H` | General-purpose async utility / random/timer |
| `v` | Log/debug utility |
| `G5K` | Debug output formatter |
| `tt_` | Terminal color/locale helpers |
| `hH` | JSON stringifier |
| `P7` | Path/URL sanitizer (redacts sensitive strings) |
| `h6A` | Path map helper |
| `A` | Lowercase utility |
| `cSH` | Terminal write helper |
| `X6A` | Raw write emitter |
| `Z5K` | Transcript/log file writer |
| `PSH` | Buffered output flusher |
| `i8H` | Log entry formatter |
| `x6` | Log path helper |
| `gv8` | Log error handler (`EISDIR` guard) |
| `U6A` | Log file path joiner |
| `p6A` | Log file rotation handler |
| `E5K` | Log file append writer |
| `h9` | Signal/atexit handler registrar |
| `Qf7` | File stats collector |
| `EP_` | Per-file diff/stat analyzer |
| `SzH` | Shell runner used inside file-stat pipeline |
| `V6` | Encoding helper (`GV`) |
| `f` | Stream/file handle manager |
| `Y` | Supervisor session manager |
| `z` | Daemon stop/config handler |
| `qD1` | File extension / type classifier |
| `KG4` | Stat diff runner |
| `LD1` | Diff stat text parser |
| `L` | Promise queue manager |
| `lf7` | Message history trimmer |
| `g5` | Path joiner for message history |
| `CU` | Character encoding normalizer |
| `__` | Module export marker |
| `rh6` | File binary reader (BOM detection) |
| `DkK` | Buffer-from wrapper |
| `PkK` | Line parser (utf-8 content scanner) |
| `XkK` | Extended line parser |
| `WkK` | Buffer copy helper |
| `GkK` | Buffer allocator |
| `TkK` | BOM-aware chunk splitter |
| `YXH` | Message JSON parser |
| `pSK` | JSON stream initializer |
| `USK` | JSON token indexer |
| `FSK` | JSON field extractor |
| `BSK` | JSON buffer reader |
| `K` | Pad/map utility |
| `gf7` | Message role filter |
| `Ff7` | User message filter |
| `cf7` | Sidechain/meta message filter |
| `jR_` | Team-member file checker |
| `G1` | Model string normalizer |
| `BU6` | Model entry resolver |
| `Cw` | Model name canonicalizer |
| `WI8` | Model capability checker |
| `PP` | Model string replacer |
| `R1` | Git diff context builder |
| `Na` | Diff header formatter |
| `TV` | Diff type detector |
| `h8H` | Hunk formatter |
| `BB` | Diff line processor |
| `r1` | Model/tool string normalizer |
| `nG` | Warning emitter |
| `zAH` | Operator include-list checker |
| `oV` | BM/zM model pair selector |
| `yxH` | zM model selector |
| `rV` | BM/zM model pair initializer |
| `UtA` | rV wrapper |
| `BM` | Primary model accessor |
| `YF6` | q$L include-list checker |
| `SxH` | xH string wrapper |
| `rJ` | Diff context joiner |
| `nJ` | Diff context assembler |
| `$D1` | Model-string include checker |
| `hKq` | PR metadata resolver (wraps `mvH` + `RKq` + `YK`) |
| `mvH` | Pre-flight git/PR checks |
| `dfH` | File-extension / model-context checker |
| `oi8` | dfH wrapper |
| `RKq` | Branch name sanitizer (`H.replace`) |
| `YK` | Shell command dispatcher (bash vs. PowerShell) |
| `nHH` | Prompt assembly engine |
| `Qu` | Command string formatter |
| `xH` | String coercion (String constructor) |
| `Sq` | String coercion variant |
| `j68` | Command escape replacer |
| `OJ` | Bash tool permission orchestrator |
| `K$7` | Permission rule evaluator |
| `pP6` | Deny-rule checker |
| `SR_` | Rule-based allow checker |
| `mZ` | Sandbox permission resolver |
| `S7` | Permission result builder |
| `jD8` | Recursive permission dispatcher |
| `gQ` | Permission loop guard |
| `_9q` | Permission state tracker |
| `sAq` | Ask-rule handler |
| `eAq` | Fast-path permission checker |
| `Gz6` | Auto-mode state reader |
| `_oH` | App state setter |
| `L9q` | Permission context updater |
| `a1` | MCP tool prefix checker (`mcp__`) |
| `rA8` | Permission audit logger |
| `hx` | Interactive permission prompt |
| `yE_` | Auto-mode allow-list checker |
| `hK1` | Allow-list entry adder |
| `NJ6` | Auto-mode classifier orchestrator |
| `YR1` | Classifier result setter |
| `wR1` | Classifier DR1 dispatcher |
| `_R1` | Classifier G6/R1 router |
| `yQ4` | XML permission template builder |
| `DK` | Tool input filter |
| `zR1` | Tool result array builder |
| `VQ4` | Classifier result formatter |
| `DR1` | Auto-classifier API caller |
| `J` | Agent process manager |
| `Gj` | Classifier output truncator |
| `yi` | Classifier emit helper |
| `NE_` | Auto-mode event emitter |
| `pQ4` | XR1 prompt builder |
| `uQ4` | Two-stage classifier runner |
| `UQ4` | XR1 prompt builder variant |
| `HR1` | Classifier history reader |
| `PR1` | Classifier prompt assembler |
| `KKH` | Cache/ephemeral context builder |
| `IE_` | Stage-1 classifier invoker |
| `ZE_` | Stage-2 classifier invoker |
| `LH6` | Classifier log helper |
| `VE_` | Classifier verdict emitter |
| `ih1` | Tool-use block finder |
| `VQ` | Supervisor session stop/start |
| `If8` | Classifier transcript builder |
| `rh1` | Safe-parse schema validator |
| `GR1` | Cf_ result builder |
| `XH` | String coercion (String constructor) |
| `OR1` | Classifier output writer |
| `WR1` | Classifier timeout/error handler |
| `jzH` | Allow-list entry deleter |
| `OF6` | QfH permission-prompt tool dispatcher |
| `QfH` | Permission prompt tool handler |
| `ceH` | inputTokens counter |
| `tj` | outputTokens counter |
| `leH` | cacheReadInputTokens counter |
| `neH` | cacheCreationInputTokens counter |
| `xE` | G6 state-machine event emitter |
| `M9q` | Agent context window checker |
| `XK1` | Context-window abort handler |
| `q$7` | Tool permission context forker |
| `WK1` | Permission fork initializer |
| `f9q` | Agent fork handler |
| `A$7` | Bash tool executor |
| `pKH` | Permission request object builder |
| `eiH` | Executor inner helper |
| `VDH` | Bash tool pre-flight permission checker |
| `DC` | ft wrapper |
| `WI` | Ff wrapper |
| `v_` | Error/string coercion utility |
| `K9q` | Agent cleanup handler |
| `Sj` | Stop-sequence / message handler |
| `B9q` | Stop-sequence dispatcher |
| `M` | Conversation store reader |
| `BFH` | Tool result mapper |
| `Ur9` | Tool result to block-param converter |
| `t94` | Text-result validator |
| `gr9` | Array result checker |
| `Qr9` | Result reducer |
| `wOH` | Non-text result handler |
| `jOH` | Result type dispatcher |
| `JOH` | i1 result handler |
| `mr9` | Result size limiter (`Math.min`) |
| `ZHq` | Prompt parts joiner |
| `XL7` | Prompt section formatter |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.