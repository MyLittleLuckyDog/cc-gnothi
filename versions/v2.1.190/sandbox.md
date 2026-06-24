---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.190"
updated: "2026-06-24"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.190 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.190 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.190

---

## Overview

The `/sandbox` command configures the sandboxing policy for shell commands executed by Claude Code. It allows users to view the current sandbox state, add exclusion patterns (command globs that bypass sandboxing), and interactively configure sandbox behavior — subject to platform support checks, dependency validation, and policy-lock enforcement. The command renders a JSX component in the terminal and writes its output to `.claude/settings.local.json`.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `sandbox` |
| description | ` ...   ...  (⏎ to configure)` |
| argumentHint | `exclude "command pattern"` |
| immediate | `true` |
| isHidden | `null` |
| module_id | `oOl` |
| load_inline | `true` |
| loc_byte | `12652249` |
| loc_byte_end | `12652944` |
| loc_line | `8670` |
| arbor_handler.name | `e_f` |
| arbor_handler.fqn | `claude-2.1.190::e_f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.190 bundle.js:+12652249

---

## Input Branching

The handler exhibits 5+ distinct branches based on platform support, argument subcommand, policy locks, and dependency checks. A Mermaid flowchart is required.

```mermaid
flowchart TD
    A["/sandbox [args] invoked"] --> B{Check platform\nisSupportedPlatform}
    B -- "macOS / Linux / WSL2" --> C{Check WSL version\nif WSL detected}
    B -- "Unsupported platform" --> ERR1["Error: Sandboxing is currently only\nsupported on macOS, Linux, and WSL2.\nbundle.js:+12651017"]
    C -- "WSL2 OK" --> D{Check dependencies\ncheckDependencies}
    C -- "WSL1 detected" --> ERR2["Error: Sandboxing requires WSL2.\nWSL1 is not supported.\nbundle.js:+12650959"]
    D -- "Dependencies satisfied" --> E{Parse argument\nfirst token}
    D -- "Missing deps" --> ERR3["Dependency error rendered\nvia JSX component\nbundle.js:+12651094"]
    E -- "arg == 'exclude'" --> F{Validate pattern\nargument present}
    E -- "No arg / configure" --> G{Check policy lock\nareSandboxSettingsLockedByPolicy}
    F -- "Pattern present" --> H["Split args, strip 'exclude' prefix\n(offset 8 chars)\nbundle.js:+12651591,+12651631"]
    F -- "Pattern missing" --> ERR4["Error: Please provide a command\npattern to exclude (e.g.,\n/sandbox exclude \"npm run test:*\")\nbundle.js:+12651676"]
    H --> I{Check policy lock}
    I -- "Locked" --> ERR5["Error: Sandbox settings are overridden\nby a higher-priority configuration\nbundle.js:+12651382"]
    I -- "Not locked" --> J["Write exclusion rule to\n.claude/settings.local.json\nbundle.js:+12651882"]
    J --> K["Emit telemetry:\nsandbox_exclude_command\nbundle.js:+4766436"]
    K --> L["Render JSX confirmation\nbundle.js:+12651540"]
    G -- "Locked" --> ERR5
    G -- "Not locked" --> M["Render interactive JSX\nconfiguration panel\nbundle.js:+12651540"]
```

Analysis basis: CC v2.1.190 bundle.js:+12650886, +12650917, +12650953, +12651094, +12651161, +12651323, +12651540, +12651591, +12651614, +12651631, +12651676, +12651795, +12651824, +12651861

---

## Behavioral Spec

### Main Handler — `sandboxCommandHandler` (`e_f`)

The handler is an `AsyncFunction` resolved by Arbor via `module_id` → `oOl`.

```
async function sandboxCommandHandler(args, context):
    # Step 1: Determine color theme
    theme = getTheme()   # "light" or dark variant
    # bundle.js:+12650898

    # Step 2: Platform support check
    if not sandboxUtils.isSupportedPlatform():
        # Check WSL sub-type first
        wslVersion = detectWsl()   # calls Bo, Yt
        if wslVersion == "wsl" AND wslVersion is WSL1:
            return renderError("Error: Sandboxing requires WSL2. WSL1 is not supported.")
            # bundle.js:+12650953, +12650959
        else:
            return renderError("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")
            # bundle.js:+12651017

    # Step 3: Dependency check
    depResult = sandboxUtils.checkDependencies()
    # bundle.js:+12651134
    if depResult.status == "error":
        return renderJsx(dependencyErrorComponent, depResult)
        # bundle.js:+12651094, +12651097

    # Step 4: Policy-platform check
    isEnabled = sandboxUtils.isPlatformInEnabledList()
    # bundle.js:+12651161

    # Step 5: Argument dispatch
    rawArg = args.trim()
    firstToken = rawArg.split(" ")[0]   # bundle.js:+12651591

    if firstToken == "exclude":
        # bundle.js:+12651614
        pattern = rawArg.slice(8).trim()   # strip "exclude " prefix (8 chars)
        # bundle.js:+12651639

        if pattern is empty:
            return renderError(
                'Error: Please provide a command pattern to exclude ' +
                '(e.g., /sandbox exclude "npm run test:*")'
            )
            # bundle.js:+12651676

        # Step 6: Policy lock check before writing
        if sandboxUtils.areSandboxSettingsLockedByPolicy():
            return renderError(
                "Error: Sandbox settings are overridden by a higher-priority " +
                "configuration and cannot be changed locally."
            )
            # bundle.js:+12651323, +12651382

        # Step 7: Apply exclusion rule
        processedPattern = applyPatternTransforms(pattern)
        # (u.replace call at bundle.js:+12651795)

        settingsManager = buildSettingsManager()   # Rqr, bundle.js:+12651824
        relPath = pathUtils.relative(...)           # bundle.js:+12651861
        writeExcludeRule(settingsManager, processedPattern)
        # writes to .claude/settings.local.json
        # bundle.js:+12651882

        emitTelemetry("sandbox_exclude_command")
        # bundle.js:+4766436

        return renderJsx(confirmationComponent)
        # bundle.js:+12651540

    else:
        # Configure mode — show interactive panel
        if sandboxUtils.areSandboxSettingsLockedByPolicy():
            return renderError(
                "Error: Sandbox settings are overridden by a higher-priority " +
                "configuration and cannot be changed locally."
            )
            # bundle.js:+12651323

        return renderJsx(sandboxConfigComponent, {isEnabled, depResult})
        # bundle.js:+12651540
```

Analysis basis: CC v2.1.190 bundle.js:+12650886

---

### Sub-feature: Platform Detection (`Bo`, `Yt`, `Ro.isSupportedPlatform`)

```
function checkPlatformAndWsl():
    # Bo: detects OS type (bundle.js:+12650886)
    # Yt: detects WSL presence/version (bundle.js:+12650908)
    # Ro.isSupportedPlatform: master gate (bundle.js:+12650917)
    os = detectOs()
    if os is WSL:
        version = detectWslVersion()
        if version == "wsl" (i.e. WSL1):
            return {supported: false, reason: "WSL1"}
            # literal "wsl" at bundle.js:+12650953
    if os not in [macOS, Linux, WSL2]:
        return {supported: false, reason: "unsupported_os"}
    return {supported: true}
```

Analysis basis: CC v2.1.190 bundle.js:+12650886, +12650908, +12650917, +12650953

---

### Sub-feature: Exclusion Pattern Writing (`Rqr`, `settingsWriter`)

```
function writeExclusionRule(settingsManager, pattern):
    # Rqr = settings manager builder (bundle.js:+12651824)
    # Reads localSettings from Tn (bundle.js:+4766056)
    # Filters existing addRules (bundle.js:+4766150)
    # Checks if pattern already included (bundle.js:+4766340)
    # Applies vRd pattern match (bundle.js:+4766301)
    existing = settingsManager.getLocalSettings()
    addRulesArray = existing.addRules ?? []
    if pattern not in addRulesArray:
        addRulesArray.push(pattern)
    settingsManager.writeLocalSettings({addRules: addRulesArray})
    # persists to .claude/settings.local.json (bundle.js:+12651882)
    emitTelemetry("sandbox_exclude_command")   # bundle.js:+4766436
    # Also calls Le to route the update (bundle.js:+4766433)
```

Analysis basis: CC v2.1.190 bundle.js:+12651824, +4766056, +4766127, +4766150, +4766301, +4766340, +4766433, +4766436

---

### Sub-feature: Policy Lock Guard (`Ro.areSandboxSettingsLockedByPolicy`)

```
function checkPolicyLock():
    # bundle.js:+12651323
    # When true, all write operations are blocked
    if policySettings.sandboxLocked == true:
        return true
    return false
```

Error message literal: `"Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally."` (bundle.js:+12651382)

Analysis basis: CC v2.1.190 bundle.js:+12651323, +12651382

---

### Sub-feature: Dependency Check (`Ro.checkDependencies`)

```
function checkDependencies():
    # bundle.js:+12651134
    result = sandboxUtils.checkDependencies()
    if result.status == "error":
        # bundle.js:+12651097
        return {ok: false, detail: result}
    return {ok: true}
```

Analysis basis: CC v2.1.190 bundle.js:+12651094, +12651097, +12651134

---

### Sub-feature: JSX Rendering (`sOl.jsx`)

The command uses type `local-jsx` and `immediate: true`, meaning the JSX component is rendered inline without waiting for a separate async trigger.

```
function renderSandboxComponent(mode, props):
    # sOl.jsx called at bundle.js:+12651540
    # Renders one of:
    #   - Error message panel
    #   - Dependency error panel
    #   - Interactive configuration panel (configure mode)
    #   - Exclusion confirmation panel (exclude mode)
    return <SandboxComponent mode={mode} {...props} />
```

Analysis basis: CC v2.1.190 bundle.js:+12651540

---

### Sub-feature: Argument Parsing Detail

The "exclude" subcommand is detected by splitting the argument string and comparing the first token to the literal `"exclude"` (bundle.js:+12651614). The pattern is then extracted by slicing 8 characters from the raw argument string (bundle.js:+12651639), corresponding to the length of `"exclude "`. A `u.replace` transformation is applied to the pattern string before storage (bundle.js:+12651795), likely normalizing quotes or whitespace.

Analysis basis: CC v2.1.190 bundle.js:+12651591, +12651614, +12651631, +12651639, +12651795

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_ok` (bundle.js:+1025122), `tengu_feature_bad` (bundle.js:+1025189), `tengu_feature_sad` (bundle.js:+1025270), `tengu_daemon_control` (bundle.js:+17235957), `tengu_mcp_skills` (bundle.js:+6653418), `tengu_config_auth_loss_prevented` (bundle.js:+13748929), `tengu_bg_retire_pinned_low_mem` (bundle.js:+17202918), `tengu_bg_prewarm_per_sweep` (bundle.js:+17203039), `tengu_daemon_config_reload` (bundle.js:+17214348), `tengu_daemon_yield` (bundle.js:+17218760). Within this command's direct call graph: `sandbox_exclude_command` via `Rqr`/`Le` (bundle.js:+4766436). |
| Settings file written | `.claude/settings.local.json` (bundle.js:+12651882) — exclusion rules are appended to the `addRules` array under the local settings scope. |
| appState changes | Sandbox enable/disable state is reflected via `Ro.isPlatformInEnabledList` (bundle.js:+12651161); policy lock state surfaces from `Ro.areSandboxSettingsLockedByPolicy` (bundle.js:+12651323). |
| Hook registration | `immediate: true` — the JSX component is rendered immediately on command invocation without deferred scheduling. |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| MCP side effects | The call graph reaches `d9e` (MCP server manager), `fBo`, `brr`, `zRn`/`aKd` (MCP connection logic). These are invoked as part of the broader settings-reload path triggered when `.claude/settings.local.json` is updated, not directly by the sandbox command itself. |

---

## Version History

| Version | Change |
|---|---|
| v2.1.190 | Initial analysis |

---

## Common Mistakes

1. **Using `/sandbox exclude` without quoting glob patterns.** Patterns containing `*`, `?`, or spaces must be quoted (e.g., `/sandbox exclude "npm run test:*"`), or the shell will expand them before CC processes the argument. The error message at bundle.js:+12651676 is shown when the pattern is empty after stripping the prefix.

2. **Expecting `/sandbox` to work on unsupported platforms.** The command performs a hard platform gate at startup (bundle.js:+12650917). Windows without WSL2, and WSL1 environments, will receive an immediate error and no configuration UI will be shown.

3. **Attempting to change sandbox settings when policy lock is active.** If an enterprise or project-level policy has locked sandbox configuration (`areSandboxSettingsLockedByPolicy` returns true), the command will display the policy error (bundle.js:+12651382) for both the `exclude` subcommand and the interactive configure path.

4. **Assuming exclusion rules apply globally.** Exclusion patterns written by `/sandbox exclude` are saved to `.claude/settings.local.json` (bundle.js:+12651882), which is project-local and git-ignored by default. They do not propagate to user-level or enterprise settings.

5. **Expecting immediate tool behavior change.** The `immediate: true` flag means the UI renders immediately, but the underlying sandbox enforcement engine reads settings on the next invocation; commands already queued may not reflect the new exclusion rule.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `e_f` | Main handler — `sandboxCommandHandler` (AsyncFunction, module `oOl`) |
| `vo` | Terminal color/theme resolver (parses `foreground`, `rgb(`, `ansi256(`, `ansi:` prefixes) |
| `vCe` | ANSI color code mapper (maps color names to chalk-style `St.*` methods) |
| `sj` | Color theme fallback selector |
| `a` | MCP server manager / settings orchestrator |
| `d9e` | MCP server connection and lifecycle manager |
| `RB` | MCP server registry builder |
| `Ust` | Registry entry initializer |
| `E7` | MCP server state machine (approval/pending/rejected transitions) |
| `K4` | SDK-type MCP server entry builder |
| `CRn` | MCP config error colorizer (red/yellow terminal output) |
| `Pst` | SSE/HTTP server slot manager |
| `aF` | Prototype-clean object creator for MCP entries |
| `Qw` | MCP client factory |
| `eh` | MCP transport connector |
| `nJr` | MCP JSON-RPC negotiator |
| `zn` | Async iterator / observable adapter |
| `FUt` | MCP server filter predicate |
| `Hua` | MCP needs-auth cache reader (`mcp-needs-auth-cache.json`) |
| `dZr` | Cache path resolver |
| `PLe` | Settings content hasher (SHA-256) |
| `myn` | Settings schema deserializer |
| `hyn` | Settings hash comparator |
| `wT` | Settings hash generator (Nli.createHash) |
| `fyn` | Settings file path resolver (`Gl`) |
| `Gl` | Base settings directory resolver (`vWs`) |
| `ln` | MCP debug logger (`YJ.logMCPDebug`) |
| `zRn` | MCP OAuth/connection runner |
| `wr` | OAuth flow coordinator |
| `aKd` | MCP connection attempt handler (OAuth, auth-URL, tool-result flow) |
| `lKd` | MCP server retry / failure-cache logic |
| `BUt` | MCP connection result applicator |
| `Xs` | AsyncLocalStorage store accessor (`KFu.getStore`) |
| `tMn` | Cache file path joiner (`eMn.join`) |
| `Me` | JSON serializer (`JSON.stringify`) |
| `gJr` | MCP server config writer |
| `be` | Error-to-string converter (`String`) |
| `m` | MCP process supervisor (SIGTERM, `x.kill`) |
| `eL` | MCP skills/tool list emitter (`tengu_mcp_skills`) |
| `it` | MCP tool registry (IW.has/get, ZRt.add) |
| `tJr` | MCP include-list checker |
| `hn` | Global config save helper (auth-loss guard, `tengu_config_auth_loss_prevented`) |
| `w` | Background worker pool (blur/focus, 3600000 ms idle, 0.8 memory threshold) |
| `ij` | Background worker constructor |
| `L` | Background worker sweep loop (respawn/retire/prewarm, `tengu_bg_*`) |
| `v` | Background worker state |
| `ycc` | Away-summary message extractor |
| `Ecc` | Background notification handler (`xnr`) |
| `Vc` | MCP error logger (`YJ.logMCPError`) |
| `Aua` | MCP async mapper (ZW — validates integers, handles abort/addEventListener) |
| `ZW` | Generic async iterator mapper |
| `yit` | Integer parser for MCP port (parseInt, radix 10) |
| `nMn` | Integer parser variant (parseInt, radix 20) |
| `brr` | MCP connection result applicator (`applyMcpUpdate`, cleanup) |
| `u9e` | Orphan connection disposer |
| `zT` | MCP slot cleanup runner (`Hit`, `eL`) |
| `Hit` | MCP slot content hasher (`PLe`) |
| `_la` | Settings reload trigger (`rQr`) |
| `T` | Settings writer / log dispatcher (debug/info routing) |
| `nLc` | Log entry formatter (`QP`, `Mcr`, `w6o`) |
| `w6o` | ANSI log colorizer (`aCc`, `lCc`) |
| `wc` | Path redactor (`[REDACTED]` literal, `p8o`) |
| `p8o` | Redact-pattern mapper (`Zwc.map`) |
| `hze` | Log output writer (`e8o`) |
| `e8o` | Raw write wrapper (`e.write`) |
| `iLc` | File-write-and-flush implementation (append, rename, fsync cycle) |
| `WKe` | Buffered write scheduler (clearTimeout/setTimeout/setImmediate, 1000/100 ms thresholds) |
| `dpe` | Write path resolver (`yze`, `upe.join`) |
| `xre` | Directory existence check (`cn`) |
| `h8o` | Temp-file path builder (`upe.join`, `kt`) |
| `Ncr` | Atomic rename handler (stat → rename → unlink, `.txt` suffix detection) |
| `sLc` | Full flush writer (mkdir, appendFile, rename, fsync) |
| `Ei` | Signal handler registrar (`C6o.register`) |
| `l` | MCP daemon status checker (`rUl`, `daemon.status.json`) |
| `rUl` | Daemon status file reader (`AQ`, `Date.now`, `Xs`) |
| `AQ` | Daemon status parser (`Ofe`) |
| `nVt` | Daemon status path builder (`nUl.join`) |
| `fBo` | MCP server reconnection orchestrator (retry, `[MCP] Retry: all remote servers recovered`) |
| `xRn` | MCP server suppression checker (`kVd.has`, `cJr.has`) |
| `Kn` | Promise-with-timeout helper (setTimeout/clearTimeout, `aborted`) |
| `c` | Timer/clock helper (`En`) |
| `u` | Background session manager (`Le`, `Re`, `CU`, `X6`, stopped/daemon_stop telemetry) |
| `Le` | Feature-flag OK gate (`tengu_feature_ok`, `W`, `Pe`) |
| `Re` | Feature-flag BAD gate (`tengu_feature_bad`, `W`, `Pe`) |
| `Pe` | Feature-flag payload builder (`aKe`) |
| `CU` | Background session starter (`q9`, `qz.push`, `m$e`, `aBr`) |
| `q9` | Session config resolver (`M2`) |
| `M2` | Model/config builder (`Hid`, `zH`, `L1e`) |
| `m$e` | Session state initializer (`xw`) |
| `xw` | Tool registry initializer (`it`) |
| `aBr` | Background session launcher (`cSn`, `sBr.randomUUID`, `yZe`, `yW`, `e.emit`) |
| `cSn` | Conversation runner (Promise.all, `aad`, `Hon`, `lad`, `iUe`, `A_`, `gXt`, `kt`) |
| `yW` | Auth token generator (`FOo.randomBytes`, 32 bytes, `hn`, `T`) |
| `X6` | Graceful shutdown orchestrator (Promise.race/all, `Ume`, `zme`, `Kn`, `process.exit`) |
| `Ume` | MCP server shutdown invoker (`Nme.shutdown`) |
| `zme` | Post-shutdown cleanup (`clearTimeout`, `VOo`) |
| `VOo` | Telemetry flush on shutdown (`BS.post`, `T`, `tengu_daemon_control`) |
| `Rqr` | Settings manager for exclusion rules (`Tn`, `localSettings`, `addRules`, `sandbox_exclude_command`) |
| `Tn` | Local settings loader (`gsn`, `l2`) |
| `gsn` | Settings cache accessor (`B5o`, `ZEr`, `G5o`) |
| `B5o` | Settings LRU cache get/has (`XYt.has`, `XYt.get`) |
| `ZEr` | Settings file parser (`$ls`, `dbe`, `DG`, `Uls`, `XJ`) |
| `G5o` | Settings LRU cache setter (`XYt.set`) |
| `l2` | Settings layer merger (`gr`, `CEt`, `oar`, `bEt`, `YPe`, `XPe`, `wEt`, `boe`, `fbe`, `bsn`, `ncs`, `rQ`, `oCt`) |
| `gr` | Settings validator (`VL`) |
| `oCt` | Settings merge finalizer (`Yt`, `nCt`, `UC`) |
| `vRd` | Pattern matcher for sandbox rules (`e.match`) |
| `ao` | Settings write orchestrator (full write path: `Jm`, `ZEr`, `l2`, `DC`, `kn`, `Sa`, `T`, `bH`, `Gis`, `g9`, `PG`, `ke`, `uYe.emit`) |
| `Jm` | Settings entry composer (`dbe`, `l2`) |
| `dbe` | User-settings file path builder (`HO.join`, `msn`, `Blu`, `g9`, `$lu`) |
| `DC` | Config file writer dispatcher (`JJ`) |
| `JJ` | Config file read-modify-write (readFileSync, 4096 buffer, replaceAll, `Drn`, `Prn`) |
| `kn` | Safe file write (`cn`) |
| `cn` | Filesystem error handler (`EISDIR`, `ENOENT`) |
| `cEr` | Write-timestamp recorder (`Con.set`, `Date.now`) |
| `nNe` | Nested settings path resolver (`msn`, `l2`) |
| `msn` | Settings path builder (`HO.resolve`, `HO.dirname`) |
| `sIt` | Atomic file writer (lstatSync, renameSync, unlinkSync, fchmodSync, fsyncSync, `ELOOP`/`ENOTDIR`/`EACCES` handling) |
| `Nd` | Real-path resolver (`lu`, `bm`, `bcr`, `e.realpathSync`) |
| `T7e` | Extended attr error handler (`EINVAL`, `ENOTSUP`, `EPERM`, `ENOSYS`) |
| `bH` | Settings cache invalidator (`XYt.clear`, `xsr.clear`) |
| `Gis` | Gitignore manager (`git check-ignore`, `core.excludesfile`, `ls-files --error-unmatch`, `JAe.*`) |
| `Pt` | Permission-check helper (`Mrn`, `gr`) |
| `Vyr` | Path canonicalizer (`cu`) |
| `Son` | Gitignore rule writer (`Wr`) |
| `mau` | Home-dir-relative path expander (`~/`, `Xyr.homedir`, `Bpe.isAbsolute`) |
| `$is` | Gitignore file reader (`Wr`) |
| `g9` | Claude settings directory path builder (`HO.join`, `.claude`) |
| `Mt` | Feature sad gate (`tengu_feature_sad`, `W`, `Pe`) |
| `PG` | Settings disk loader (`qL`, `ta`, `eSr`, `l2`, `JYt`, `loadSettingsFromDisk_start/end`) |
| `qL` | Settings load logger |
| `ta` | Memory usage sampler (`process.memoryUsage`, `C8o.has/add`, `K3`, `Qcr.push`) |
| `eSr` | Settings file reader (info/settings_load_started/completed, `DG`, `Uls`, `HO.resolve`, `dbe`) |
| `ke` | Command executor with error logging (`fo`, `nt`, `Vi`, `oou`, `f7e.push`, `YJ.logError`, `essential-traffic`) |
| `fo` | Error factory (`Error`, `String`) |
| `nt` | String normalizer (`String`, `yes`/`on` literals) |
| `Vi` | Command validator (`Jns`) |
| `oou` | Command queue manager (`vrn.shift`, `vrn.push`) |
| `JV` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.