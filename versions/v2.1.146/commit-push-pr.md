---
type: feature-spec
feature: "commit-push-pr"
cc_version: "2.1.146"
updated: "2026-06-01"
tags: ["commit-push-pr", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.146 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/commit-push-pr`

> Analysis basis: CC v2.1.146 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.146

---

## Overview

`/commit-push-pr` is a `prompt`-type slash command that automates the end-to-end Git workflow of staging and committing local changes, pushing the current branch to the remote, and opening (or updating) a pull request via the GitHub CLI (`gh`). The command delegates all work to the agent by injecting a structured instruction prompt, which is assembled at runtime by `getPromptForCommand` and includes shell-specific variant instructions depending on the active shell environment.

---

## Registration

| Field | Value |
|---|---|
| type | `prompt` |
| name | `commit-push-pr` |
| description | Commit, push, and open a PR |
| loc_byte | `10516976` |
| loc_byte_end | `10517588` |
| loc_line | `8442` |
| handler_method | `getPromptForCommand` |
| handler_method_start | `10517180` |
| handler_method_end | `10517587` |
| prompt_body.length | `203` |
| prompt_body.trace | `call→H8H(...) (1 literals)` |
| arbor_handler.name | `getPromptForCommand` |
| arbor_handler.fqn | `claude-2.1.146::getPromptForCommand` |
| arbor_handler.kind | `Method` |
| arbor_handler.resolution_path | `direct` |
| arbor_handler.n_hits | `3` |

Analysis basis: CC v2.1.146 bundle.js:+10516976

---

## Input Branching

The handler exhibits 3+ distinct branches depending on shell environment, PR existence state, and the presence of a `gh` CLI. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/commit-push-pr invoked"] --> B["getPromptForCommand\nassembles prompt"]
    B --> C["Gather context\n(git state, current branch, default branch)"]
    C --> D{"Shell environment?"}
    D -->|"bash"| E["Resolve git default branch\nvia symbolic-ref + show-ref fallback"]
    D -->|"powershell"| F["Use PowerShell-compatible\ngit and gh commands"]
    E --> G["Check for existing PR\ngh pr view --json number 2>/dev/null || true"]
    F --> G2["Check for existing PR\ngh pr view --json number 2>$null; if (-not $?) { \"\" }"]
    G --> H{"PR already exists?"}
    G2 --> H
    H -->|"Yes"| I["Push branch only\n(no new PR created)"]
    H -->|"No"| J["Push branch AND\ncreate new PR with gh pr create"]
    I --> K["Agent appends PR attribution\ntext to commit/PR body"]
    J --> K
    K --> L["Prompt delivered to agent\n(203 chars, includes shell error guidance)"]
    L --> M{"Git Bash available?\n(Windows only)"}
    M -->|"No (win32)"| N["Error: Install Git for Windows\nor switch to powershell shell"]
    M -->|"Yes / non-Windows"| O["Agent executes git + gh workflow"]
```

Analysis basis: CC v2.1.146 bundle.js:+10517180, +10514048, +10514053, +10514100, +10517377

---

## Behavioral Spec

### 1. Handler Entry — Prompt Assembly

The `getPromptForCommand` method (Arbor: `direct` resolution, `n_hits: 3`) serves as the inline handler for this command. It is an `ObjectMethod` on the registration object and is the sole entry point.

Analysis basis: CC v2.1.146 bundle.js:+10517186

```
function getPromptForCommand(context):
    shellType = context.shell  # "bash" or "powershell"
    
    prCheckCommand = selectPrCheckCommand(shellType)
    attributionSuffix = buildAttributionSuffix(context)
    
    promptText = assemblePromptBody(
        shellType,
        prCheckCommand,
        attributionSuffix
    )
    return promptText
```

### 2. Shell Detection and PR Check Command Selection

Two shell-specific literal commands are embedded in the bundle to check whether a pull request already exists for the current branch.

- **bash variant** (bundle.js:+10514053):
  `gh pr view --json number 2>/dev/null || true`
- **powershell variant** (bundle.js:+10514100):
  `gh pr view --json number 2>$null; if (-not $?) { "" }`

```
function selectPrCheckCommand(shellType):
    if shellType == "bash":
        return "gh pr view --json number 2>/dev/null || true"
    else if shellType == "powershell":
        return "gh pr view --json number 2>$null; if (-not $?) { \"\" }"
    else:
        return defaultBashCommand
```

Analysis basis: CC v2.1.146 bundle.js:+10514053, +10514100

### 3. Default Branch Resolution

The handler calls `sV` (the git-context resolver) concurrently via `Promise.all` with the PR-state lookup. `sV` determines the repository's default branch using the following priority:

```
function resolveDefaultBranch(repoRoot):
    # Step 1: Try git symbolic-ref
    result = runGit(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"])
    # literals: "symbolic-ref" (+1060646), "--short" (+1060661),
    #           "refs/remotes/origin/HEAD" (+1060671)
    
    if result.ok:
        return result.stdout.trim()
    
    # Step 2: Probe known defaults
    for candidate in ["main", "master"]:
        # literals: "main" (+1060784), "master" (+1060791)
        ref = runGit(["show-ref", "--verify", "--quiet",
                      "refs/remotes/origin/" + candidate])
        # literals: "show-ref" (+1060853), "--verify" (+1060864),
        #           "--quiet" (+1060875)
        if ref.ok:
            return candidate
    
    # Step 3: Fall back to cached "defaultBranch" in app state
    return appState.get("defaultBranch")  # literal: "defaultBranch" (+1049890)
```

Analysis basis: CC v2.1.146 bundle.js:+1060604, +1060637, +1049890

### 4. PR Attribution Text

The prompt instructs the agent to append a specific attribution text to the PR body. The literal fragment `, ending with the attribution text shown in the example below` (bundle.js:+10515236) confirms that the prompt body contains an inline attribution example. The string `"PR Attribution: returning default (no data)"` (bundle.js:+10066792) is a diagnostic log emitted when the attribution lookup has no data to provide.

```
function buildAttributionSuffix(context):
    attribution = lookupPRAttribution(context)
    if attribution == null:
        log("PR Attribution: returning default (no data)")
        return defaultAttributionText
    return attribution
```

Analysis basis: CC v2.1.146 bundle.js:+10515236, +10066792

### 5. Context Gathering (i41 / ew7 pipeline)

Before prompt assembly, the handler calls `i41` (the git/tool-context collector) via `Promise.all`. This collector:

- Reads the current git remote configuration (literal `"remote"`, bundle.js:+10066019)
- Collects file change statistics from `git diff --cached --name-status` (literals bundle.js:+5318272, +5318279, +5318290)
- Computes file count and changed-line stats using `git diff --stat` (literal `"--stat"`, bundle.js:+5317869)
- Reads memory context entries (literals `"memory"`, `"memories"`, bundle.js:+10066867, +10066876)

```
async function gatherContext(workingDir, appState):
    [gitState, prState] = await Promise.all([
        collectGitContext(workingDir),   # i41
        resolvePRState(workingDir)       # sV
    ])
    return mergeContext(gitState, prState, appState)
```

Analysis basis: CC v2.1.146 bundle.js:+10517226, +10517239, +10517244, +10066019

### 6. Prompt Body Delivery (H8H)

The prompt body is assembled by `H8H` (the prompt builder function, called at bundle.js:+10517377). It:

1. Receives the shell type (`"bash"` at +9632563 or `"powershell"` at +9632809)
2. Performs a `matchAll` scan on a template string (bundle.js:+9632850)
3. Checks for the `!`` ` escape sequence (literal `"!\`"` at +9632879) to handle inline tool-use escaping
4. Calls `CA1` (text trimmer/joiner) to clean whitespace and join prompt segments
5. Resolves tool-permission state via `B2` → `CrH` (the tool-permission resolver chain)
6. Generates a `randomUUID` for the prompt invocation (bundle.js:+9633322)

```
function buildPromptText(shellType, prCheckCmd, context):
    template = selectTemplate(shellType)
    segments = template.matchAll(TEMPLATE_PATTERN)
    
    parts = []
    for segment in segments:
        if segment.isEscape:       # "!`" escape
            parts.append(segment.raw)
        else:
            parts.append(resolveSegment(segment, context))
    
    return joinAndTrim(parts)      # CA1
```

Analysis basis: CC v2.1.146 bundle.js:+10517377, +9632850, +9632879, +9633322

### 7. Windows / Git Bash Error Path

The extracted prompt body (203 characters, `call→H8H(...) (1 literals)`) contains the following error-guidance text for Windows environments where Git Bash is not found:

> "Skill … requires bash (`shell: bash` in frontmatter) but Git Bash was not found. Install Git for Windows (https://git-scm.com/downloads/win), or change the skill's frontmatter to `shell: powershell`."

This message is surfaced when:
- The host platform is `"win32"` (literal, bundle.js:+1037506)
- The shell is configured as `"bash"` but no Git Bash executable is detected

```
function validateShellAvailability(platform, shellType):
    if platform == "win32" and shellType == "bash":
        if not gitBashFound():
            raise ShellNotAvailableError(
                "Skill requires bash but Git Bash was not found. " +
                "Install Git for Windows or switch to powershell."
            )
```

Analysis basis: CC v2.1.146 bundle.js:+1037506, prompt_body (length 203)

### 8. Tool Permission Resolution (B2 → CrH → JJ7)

Before the agent begins executing git/gh commands, the permission pipeline checks whether `bash`-tool calls are allowed:

- `JJ7` checks `OA.isSandboxingEnabled` and `OA.isAutoAllowBashIfSandboxedEnabled` (bundle.js:+10144038, +10144064)
- Permission outcomes: `"allow"` (+10145056), `"ask"` (+10144127), `"deny"` (+10143896), `"passthrough"` (+10144205)
- Dangerous operations (`"Dangerous rm operation"` +10144819, `"Dangerous rmdir operation"` +10144866) are blocked regardless

```
function resolveToolPermission(toolCall, appState):
    if sandboxingEnabled():
        if autoAllowBashInSandbox():
            return "allow"
    
    decision = runAutoModeClassifier(toolCall)
    
    match decision:
        "allow"       -> return "allow"
        "ask"         -> return promptUser(toolCall)
        "deny"        -> return "deny"
        "passthrough" -> return checkPermissionRules(toolCall)
```

Analysis basis: CC v2.1.146 bundle.js:+10144038, +10144064, +10143896, +10144127, +10145056

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_bg_spare_enable` (+15059830), `tengu_bg_low_mem_mb` (+12414219), `tengu_bg_spare_spawn` (+15060190), `tengu_daemon_config_reload` (+15074596), `tengu_daemon_control` (+15095752), `tengu_cobalt_ridge` (+3200527), `tengu_auto_mode_fallback_to_ask` (+10147850), `tengu_auto_mode_decision` (+10148558), `tengu_bash_allowlist_strip_all` (+10149802), `tengu_iron_gate_closed` (+10152306), `tengu_auto_mode_denial_limit_exceeded` (+10142064), `tengu_tool_empty_result` (+4891684), `tengu_tool_result_persisted` (+4891924) |
| Hook registration | `pjA` registers `"exit"` and `"error"` event listeners on the spawned process handle (literals +1032974, +1033021) |
| appState changes | `paH` calls `H.setAppState` (+10141630) to update tool-permission context; `b_` reads `H.getAppState` (+10415379) for `allowed_tools`, `avoid_prompts`, `effort`, `model` fields (+10415487, +10415542, +10415644, +10415657) |
| Git subprocess | `_HA` spawns background PTY host via `Bun.spawn` (+15040303) with `--bg-pty-host` (+15040321) flag; process `unref`-ed after launch (+15040462) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| PR attribution log | Logs `"PR Attribution: returning default (no data)"` (+10066792) when attribution data unavailable |
| Slash command path literal | `/commit-push-pr` recorded at +10517566 |

---

## Version History

| Version | Change |
|---|---|
| v2.1.146 | Initial analysis |

---

## Common Mistakes

1. **Missing `gh` CLI**: The command requires the GitHub CLI (`gh`) to be installed and authenticated. If `gh` is absent, all `gh pr view` and `gh pr create` calls will fail silently or with error output that the agent cannot recover from automatically.

2. **Git Bash not found on Windows**: When Claude Code is configured with `shell: bash` on a Windows host but Git Bash is not installed, the command emits the error message embedded in the prompt body (203 chars) and refuses to proceed. The fix is to either install Git for Windows or change the skill frontmatter to `shell: powershell`.

3. **No remote configured**: The PR push step requires a configured `origin` remote. Repositories that were initialized locally without a remote will cause the `git push` step to fail; the command does not create remotes automatically.

4. **Uncommitted merge conflicts**: The command assumes a clean or stageable working tree. Unresolved merge conflicts will cause `git commit` to fail; the agent will report the error but cannot resolve conflicts autonomously without further instruction.

5. **Auto-mode permission denials**: If the auto-mode classifier blocks `bash` tool calls (e.g., `tengu_auto_mode_denial_limit_exceeded`), the agent will be unable to execute git/gh commands and will abort. Ensure `bash` permissions are configured appropriately in Claude Code settings.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `__handler_commit-push-pr` | Synthetic BFS entry node for the command handler |
| `sV` | Git context resolver (default branch + remote state) |
| `QU8` | App-state cache getter (reads `defaultBranch`) |
| `V_` | Git subprocess executor / runner |
| `v2H` | Core process-spawn abstraction |
| `ejA` | Platform executable suffix resolver (`.exe` on win32) |
| `kU8` | stdout stream collector |
| `yU8` | stderr stream collector |
| `SU8` | Combined stream output handler |
| `MjA` | Numeric timeout validator |
| `Rq6` | Process error handler / exit-code checker |
| `IU8` | Reflect-based property definer for process handle |
| `pjA` | Process event listener registrar (exit/error) |
| `fjA` | Timeout-race wrapper for subprocess |
| `$jA` | Process kill / cleanup handler |
| `KjA` | Process kill initiator (bound) |
| `LjA` | SIGTERM sender (bound) |
| `ujA` | Parallel subprocess launcher |
| `uq6` | File-descriptor utility |
| `bjA` | Pipe/stream connector |
| `xjA` | Stream adder |
| `DjA` | Bound process cleanup wrapper |
| `D` | Background daemon manager |
| `N6` | Shared module/service registry |
| `$` | Disposable resource manager |
| `rE6` | Low-memory background process handler |
| `_HA` | Background PTY host spawner (Bun.spawn) |
| `c` | Generic utility / constants object |
| `SH` | Error logger / diagnostic reporter |
| `lpK` | String coercion utility |
| `JI` | Module initializer |
| `N` | API request builder / HTTP client |
| `$wK` | HTTP request dispatcher |
| `H` | Random/timer utility (Math.random + setTimeout) |
| `CH` | JSON serializer wrapper |
| `_` | Underscore/lodash-style utility |
| `O4` | Path/string redactor (replaces sensitive segments with `[REDACTED]`) |
| `NRH` | Response normalizer |
| `YwK` | Model file / CLAUDE.md loader |
| `L8` | Line-limit / truncation helper |
| `i41` | Git/tool context collector (remote, diff, memory) |
| `gSH` | Git status helper |
| `TO6` | Git remote URL resolver |
| `SD` | Shell/environment detector |
| `l_` | Module loader bootstrap |
| `TN6` | Module name transformer (bound) |
| `q` | File-system cleanup helper (unlinkSync) |
| `qY_` | Shell-type resolver (staging/local/production URL selector) |
| `J5L` | URL builder |
| `e_` | Settings loader |
| `gu` | Settings-from-disk orchestrator |
| `xR` | Settings schema validator |
| `Wq` | Memory-usage sampler |
| `jF8` | Settings file reader (policy + flag settings) |
| `KF` | Settings merger |
| `LI6` | Settings post-processor |
| `ew7` | Tool/MCP server config enumerator |
| `A` | Case-normalizer (toLowerCase) |
| `f` | Stream close manager |
| `jP_` | MCP server config loader and diff-stat gatherer |
| `WYH` | Working-directory resolver |
| `S6` | Universal value unwrapper |
| `Y` | MCP server lifecycle manager |
| `z` | Daemon stop controller |
| `M7q` | File extension / MIME type checker |
| `yPL` | Staged diff runner (`git diff --cached --name-status`) |
| `O7q` | Git diff stat parser (`git diff --stat`) |
| `L` | Promise-queue / concurrency limiter |
| `Aj7` | Conversation message formatter / context trimmer |
| `Df` | Working-directory joiner |
| `gy` | Value unwrapper (uV) |
| `D_` | Value unwrapper variant |
| `hb6` | File binary reader (BOM detection) |
| `AmK` | Buffer.from wrapper |
| `fmK` | UTF-8 BOM scanner |
| `MmK` | Multi-byte sequence parser |
| `$mK` | Buffer copy allocator |
| `OmK` | Unsafe buffer allocator |
| `zmK` | Byte-range extractor |
| `R2H` | NDJSON / multi-line JSON parser |
| `IUK` | JSON stream initializer |
| `kUK` | NDJSON line splitter |
| `hUK` | JSON object extractor from stream |
| `yUK` | JSON array line parser |
| `K` | Padded-column formatter |
| `tw7` | Message-type filter (user/system/assistant) |
| `sw7` | Message content-type filter (text/image/document) |
| `_j7` | Tool-use block extractor |
| `Lu_` | Team-member file checker |
| `Eq` | Model-ID normalizer |
| `Vg6` | Model-settings entry enumerator |
| `Gj` | Model-name canonicalizer (toLowerCase + includes) |
| `Bk8` | Application-inference-profile detector |
| `lP` | Model display-name formatter |
| `mq` | Token/context builder |
| `ys` | Context assembly orchestrator |
| `mV` | Context segment builder |
| `Q_H` | Context header formatter |
| `IF` | Full context assembler (tools, memory, model) |
| `rq` | Model-tier router (opus/sonnet/haiku/best) |
| `ET` | External model validator |
| `T9H` | Tier inclusion checker |
| `Jv` | Model object builder (z3 + pM) |
| `OmH` | Model fallback builder |
| `jv` | Model object factory |
| `v_9` | Model alias expander |
| `z3` | Model base constructor |
| `aQ6` | Restricted-model filter |
| `zmH` | mH-based model string builder |
| `yJ` | Extended model descriptor builder |
| `M2` | Full model descriptor (ZA, kF, eMH, YmH, jv, cP, z3, hA, pM, Jv) |
| `D7q` | Model-ID inclusion checker |
| `P$1` | Prompt context pre-processor |
| `$kH` | Prompt template selector |
| `tMH` | Shell-aware template suffix builder |
| `Xs8` | Template variant dispatcher |
| `X$1` | Prompt variable replacer (H.replace) |
| `aK` | App-state reader for prompt context |
| `H8H` | Prompt body assembler (main prompt builder) |
| `Im` | Prompt segment formatter |
| `mH` | String coercer (String()) |
| `fK` | String coercer variant |
| `DA8` | String replacement utility |
| `B2` | Tool-execution dispatcher |
| `CrH` | Tool-permission resolver (main) |
| `JJ7` | Bash tool permission evaluator |
| `b_` | App-state accessor (getAppState) |
| `V06` | Permission context reader |
| `paH` | App-state writer (setAppState) |
| `lL1` | Permission rule loader |
| `hd` | Recursive permission decision walker |
| `tj8` | Permission decision self-recursion guard |
| `gL1` | Permission grant recorder |
| `lq` | MCP tool prefix checker (`mcp__`) |
| `aj8` | Permission audit logger |
| `Du` | Deny-with-guidance emitter |
| `aX_` | Auto-mode allowlist checker |
| `pCq` | Permission set adder |
| `WD6` | Auto-mode classifier runner |
| `QDH` | Permission set deleter |
| `rQ6` | Bash-allowlist strip helper |
| `d66` | inputTokens counter |
| `Mw` | outputTokens counter |
| `c66` | cacheReadInputTokens counter |
| `l66` | cacheCreationInputTokens counter |
| `$k` | N6-backed service resolver |
| `iL1` | Iron-gate closed handler |
| `SL1` | Classifier-unavailable handler |
| `jJ7` | Permission denial limit tracker |
| `nL1` | Headless abort handler |
| `wJ7` | Hook-based permission rewriter |
| `cL1` | Final permission-unavailable emitter |
| `LP` | Agent loop stop handler |
| `S71` | Stop-sequence / message stop handler |
| `M` | Model-state reader (L.get, L.values) |
| `yQH` | Tool-result mapper |
| `$Hq` | Tool-result content processor |
| `I3L` | Text-only result validator |
| `YHq` | Array tool-result checker |
| `DHq` | Tool-result reducer |
| `VzH` | Tool-result block formatter |
| `NzH` | Non-text result handler |
| `vzH` | O1-based result builder |
| `fHq` | Token-count estimator for tool results |
| `CA1` | Prompt segment trimmer/joiner |
| `U37` | Final prompt assembler (CA1 + ZH) |
| `ZH` | String coercer (String()) for prompt output |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.