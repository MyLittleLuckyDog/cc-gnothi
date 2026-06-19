---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.183"
updated: "2026-06-19"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.183 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.183 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.183

---

## Overview

The `/sandbox` command configures the sandboxing behaviour of Claude Code's tool execution environment. It allows users to enable, disable, or tune sandbox settings, and supports an `exclude` sub-command for adding command-pattern exceptions that opt specific shell commands out of sandbox enforcement. Configuration is persisted to `.claude/settings.local.json` in the current project, unless sandbox settings have been locked by an enterprise policy.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `sandbox` |
| description | ` ...   ...  (⏎ to configure)` |
| argumentHint | `exclude "command pattern"` |
| immediate | `true` |
| isHidden | `null` (not hidden) |
| module_id | `Fwl` |
| load_inline | `true` |
| loc_byte | `12887932` |
| loc_byte_end | `12888581` |
| arbor_handler.name | `Glf` |
| arbor_handler.fqn | `claude-2.1.183::Glf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.183 bundle.js:+12887932

---

## Input Branching

The command has four or more distinct branches (platform check, policy lock, `exclude` sub-command with/without a pattern, and the interactive configure flow), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/sandbox [args]"] --> B{Platform supported?}
    B -- "No: not macOS/Linux/WSL2" --> C["Return error:\n'Sandboxing is currently only supported\non macOS, Linux, and WSL2.'"]
    B -- "WSL1 detected" --> D["Return error:\n'Sandboxing requires WSL2.\nWSL1 is not supported.'"]
    B -- "Yes" --> E{checkDependencies}
    E -- "Dependencies missing" --> F["Return dependency error"]
    E -- "OK" --> G{isPlatformInEnabledList?}
    G -- "Not in enabled list" --> H["Return platform-not-enabled error"]
    G -- "Yes" --> I{areSandboxSettingsLockedByPolicy?}
    I -- "Locked" --> J["Return error:\n'Sandbox settings are overridden by\na higher-priority configuration\nand cannot be changed locally.'"]
    I -- "Not locked" --> K{args present?}
    K -- "args start with 'exclude'" --> L{Command pattern provided?}
    L -- "No pattern (length ≤ 8 chars after split)" --> M["Return error:\n'Please provide a command pattern\nto exclude (e.g., /sandbox exclude\n\"npm run test:*\")'"]
    L -- "Pattern provided" --> N["Parse pattern, strip quotes via replace,\nappend to exclude list in settings,\npersist to .claude/settings.local.json,\nemit sandbox_exclude_command telemetry"]
    N --> O["Return success JSX (xV renderer)"]
    K -- "No args / interactive" --> P["Open interactive sandbox\nconfiguration UI (JSX)"]
    P --> O
```

Analysis basis: CC v2.1.183 bundle.js:+12886551, +12886582, +12886799, +12886826, +12886988, +12887274, +12887297, +12887314, +12887359, +12887507, +12887557

---

## Behavioral Spec

### 1. Platform Gate

The handler `Glf` immediately invokes the theme/color utility (`ts` at +12886551) and a platform detection utility (`zt` at +12886573), then calls `Ko.isSupportedPlatform` (+12886582).

- If the current platform is not macOS, Linux, or WSL2, the command returns an error string: `"Error: Sandboxing is currently only supported on macOS, Linux, and WSL2."` (bundle.js:+12886682).
- If a WSL variant is detected but is WSL1 (not WSL2), the specific error `"Error: Sandboxing requires WSL2. WSL1 is not supported."` is returned (bundle.js:+12886624). The WSL detection check compares a `"wsl"` literal (bundle.js:+12886618).

```
async function sandboxHandler(args, context):
    colorTheme = getColorTheme()           // ts
    platformInfo = getPlatformInfo()       // zt
    if not isSupportedPlatform(platformInfo):
        if platformInfo.type == "wsl" and platformInfo.version == 1:
            return error("Error: Sandboxing requires WSL2. WSL1 is not supported.")
        return error("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")
    ...
```

Analysis basis: CC v2.1.183 bundle.js:+12886551, +12886573, +12886582, +12886618, +12886624, +12886682

### 2. Dependency Check and Platform Enablement

After the platform gate passes, the handler calls `Ko.checkDependencies` (+12886799) to verify that required system binaries or sandbox infrastructure are available. If dependencies are absent, an error is returned early (the error content is logged under the `"error"` literal at +12886762).

Next, `Ko.isPlatformInEnabledList` (+12886826) verifies whether the detected platform is in the set of explicitly enabled sandbox targets.

```
    depCheck = checkDependencies(platformInfo)
    if depCheck.error:
        return error(depCheck.message)
    if not isPlatformInEnabledList(platformInfo):
        return error("platform not in enabled sandbox list")
```

Analysis basis: CC v2.1.183 bundle.js:+12886799, +12886826, +12886762

### 3. Policy Lock Check

`Ko.areSandboxSettingsLockedByPolicy` (+12886988) reads enterprise/policy-layer settings. When settings are locked, the handler returns a hard error:

> `"Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally."` (bundle.js:+12887047)

No further argument processing occurs when the policy lock is active.

```
    if areSandboxSettingsLockedByPolicy():
        return error("Error: Sandbox settings are overridden by a higher-priority configuration and cannot be changed locally.")
```

Analysis basis: CC v2.1.183 bundle.js:+12886988, +12887047

### 4. Argument Parsing: `exclude` Sub-Command

The raw argument string `a` is split (+12887274). The leading token is compared against the literal `"exclude"` (+12887297).

If the `exclude` token is present, the remainder of the argument string is sliced starting at offset 8 (+12887322), which strips `"exclude "` (7 chars + space). If the result is empty or only whitespace, the handler returns:

> `"Error: Please provide a command pattern to exclude (e.g., /sandbox exclude \"npm run test:*\")"` (bundle.js:+12887359)

Otherwise, the pattern string undergoes quote-stripping via `u.replace` (+12887478), is used to build a new sandbox exclude rule, and is appended to the local settings file `.claude/settings.local.json` (+12887565).

The internal settings reader `Z5r` (+12887507) loads the `"localSettings"` scope (+4745887), filters via `"addRules"` key (+4745978), and calls `QA` / `co` to apply the new rule. The telemetry event `sandbox_exclude_command` is emitted (+4746264) on success.

Finally, the updated path is computed via `Nwl.relative` (+12887544) and the result is rendered through the `xV` JSX renderer (+12887557).

```
    tokens = args.split(" ")
    if tokens[0] == "exclude":
        pattern = args.slice(8)           // strip "exclude "
        if pattern.trim() == "":
            return error("Error: Please provide a command pattern to exclude (e.g., /sandbox exclude \"npm run test:*\")")
        pattern = stripQuotes(pattern)    // u.replace
        localSettings = loadLocalSettings()   // Z5r → localSettings scope
        localSettings.addRules.push({ exclude: pattern })
        saveSettings(".claude/settings.local.json", localSettings)
        emit("sandbox_exclude_command")
        return renderJSX(xV, { path: relative(cwd, ".claude/settings.local.json") })
```

Analysis basis: CC v2.1.183 bundle.js:+12887274, +12887297, +12887314, +12887322, +12887359, +12887478, +12887507, +12887520, +12887544, +12887557, +12887565, +4745887, +4745978, +4746264

### 5. Interactive Configuration UI (No Args)

When no `exclude` argument is detected, the handler falls through to an interactive JSX configuration interface. The `e` function call at +12886783 triggers a React/Ink component that renders sandbox on/off toggles and the current rule list, allowing the user to navigate and submit with Enter (`⏎ to configure` as shown in the description). State changes from the UI ultimately invoke the same settings-persistence path as the `exclude` sub-command.

```
    else:
        return renderInteractiveSandboxConfigUI()   // e() → JSX component
```

Analysis basis: CC v2.1.183 bundle.js:+12886783

### 6. Settings Load Sub-Graph (`Z5r` / `localSettings` Scope)

`Z5r` (+12887507) is the settings loader for the `localSettings` scope. It calls `xn` (+4745884), which dispatches to `Mnn` (cache-aware settings reader using `i2o` with a `Szt` WeakMap cache) and `B2` (the full settings merge chain). The merge chain assembles configuration layers in priority order: `policySettings` → `flagSettings` → `userSettings` → `projectSettings` → `localSettings`.

`Z5r` also calls `QEd` (+4746129) to match patterns via `e.match` (+4735870), `r.includes` (+4746168), and `co` (+4746182) to traverse and validate the Claude configuration directory structure (`.claude/settings.json` at +1313114, `.claude/settings.local.json` at +1313176).

Analysis basis: CC v2.1.183 bundle.js:+4745884, +4745887, +4745978, +4746129, +4746168, +4746182, +1313114, +1313176

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_mcp_skills` (+6624971); `tengu_config_auth_loss_prevented` (+13963653); `tengu_bg_retire_pinned_low_mem` (+17279713); `tengu_bg_prewarm_per_sweep` (+17279834); `tengu_feature_ok` (+1021887); `tengu_feature_bad` (+1021954); `tengu_daemon_control` (+17311864); `tengu_feature_sad` (+1022035); `sandbox_exclude_command` (literal +4746264, via `Z5r`/`ke`) |
| Settings write | On successful `exclude` sub-command: appends new exclusion rule to `.claude/settings.local.json` (bundle.js:+12887565) |
| Policy read | Reads enterprise policy layer via `Ko.areSandboxSettingsLockedByPolicy` before any mutation (bundle.js:+12886988) |
| Platform check | Reads WSL version, macOS/Linux detection via `Ko.isSupportedPlatform` (bundle.js:+12886582) |
| Dependency check | Calls `Ko.checkDependencies` to verify sandbox infrastructure (bundle.js:+12886799) |
| Hook registration | `qi` → `B2o.register` (+69538): registers a process-exit / FinalizationRegistry hook as part of the settings-load chain |
| Sound | None detected in depth-2 traversal |
| appState changes | Interactive UI branch may update in-memory sandbox enabled/disabled state; persisted via settings write |
| MCP side-effects | `n3e` (MCP server manager) is reachable via the `a` / `B1o` call path (+16919733, +16920971), indicating that MCP server connections may be restarted or reconciled when sandbox settings change |

---

## Version History

| Version | Change |
|---|---|
| v2.1.183 | Initial analysis |

---

## Common Mistakes

1. **Running `/sandbox exclude` without a pattern.** Omitting the command pattern (e.g., typing `/sandbox exclude` with nothing after it) triggers the error `"Error: Please provide a command pattern to exclude (e.g., /sandbox exclude \"npm run test:*\")"`. Always wrap glob patterns in quotes.
2. **Attempting to change sandbox settings under an enterprise policy lock.** When an administrator has set sandbox configuration at the enterprise or project policy layer, all local modifications are blocked. The command returns the policy-lock error and writes nothing to disk.
3. **Running on an unsupported platform.** The command is a no-op on Windows (non-WSL) and on WSL1. Upgrade to WSL2 for Linux-on-Windows support.
4. **Expecting `/sandbox exclude` to affect user-level or project-level settings.** The exclusion rule is always written to `.claude/settings.local.json` (the local, gitignore-friendly settings file), not to the user or project settings files.
5. **Confusing the `exclude` keyword offset.** The slice offset is hard-coded to 8 characters (`"exclude "` including the trailing space). Passing extra spaces between `exclude` and the pattern may result in unintended leading whitespace in the stored pattern.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Glf` | Main handler (AsyncFunction) for `/sandbox`; Arbor-resolved entry point |
| `No` | Terminal/foreground color-string renderer (ANSI color dispatch) |
| `BIe` | Low-level ANSI color code mapper (maps color name strings to `Ht.*` chalk-like calls) |
| `Lz` | Color string fallback / passthrough formatter |
| `n3e` | MCP server manager — initialises/reconciles MCP server connections |
| `dW` | MCP server slot diff/apply utility |
| `Ort` | MCP connection orchestrator sub-function (`bP`/`Gpe`) |
| `W7` | MCP server worker bootstrap (handles `mcpAutoDiscovered`, `enterprise`, `mcp`, `user`, `project`, `local` scopes) |
| `k5` | MCP SDK-type server enumerator |
| `NLn` | MCP error/warning color formatter (`Ht.red`, `Ht.yellow`) |
| `Mrt` | MCP SSE/HTTP server connection state machine |
| `Nk` | MCP capability/skill set builder (`P_`, `EKr`) |
| `P_` | MCP tool schema serialiser (`zue`, `Ct`, `Fa`) |
| `EKr` | MCP tool schema secondary processor |
| `pra` | MCP server probe / hash computation (`w7r`, `Vwe`, `Phn`) |
| `w7r` | MCP config directory path builder (`ci`, `d0n`, `Gt`) |
| `Vwe` | MCP server config content hasher (`IQi.createHash`, `sha256`) |
| `Phn` | MCP tool definition hasher (`Rse`, `Az`) |
| `Ohn` | MCP tool schema outer hasher (`Phn`, `EI`) |
| `EI` | Inner hash helper (`Gni.createHash`) |
| `Mhn` | MCP server metadata builder (`dc`) |
| `dc` | Deep-clone / data normaliser (`D3s`) |
| `on` | MCP debug logger (`hKe.push`, `QJ.logMCPDebug`) |
| `oxn` | MCP OAuth connection orchestrator (`Lr`, `CBd`, `vBd`) |
| `Lr` | MCP connection lifecycle helper |
| `CBd` | MCP OAuth client-credentials flow runner (handles `authenticate`, `allow`, `complete_authentication`, `auth_url`) |
| `vBd` | MCP OAuth callback handler (`SBd`, `Brt`, `jrt`) |
| `Sra` | MCP server reconnect/retry scheduler (`a0n.then`, `w7r`, `ci`, `d0n`, `Pe`) |
| `ci` | AsyncLocalStorage store accessor (`L0u.getStore`) |
| `d0n` | MCP needs-auth cache path builder (`u0n.join`, `tr`) |
| `Pe` | JSON serialiser wrapper (`JSON.stringify`) |
| `OKr` | MCP connection result applier (`EI`, `dc`, `on`, `Ee`) |
| `Ee` | String coercion helper (`String`) |
| `Cu` | MCP error logger (`hKe.push`, `QJ.logMCPError`) |
| `gra` | Async task iterator / mapper (`U8`) |
| `U8` | Generic async mapper with AbortSignal support |
| `Hot` | Integer parser (radix 10) for MCP config fields |
| `p0n` | Secondary integer parser (radix 20) for MCP config fields |
| `uZn` | MCP connection result applier / slot reconciler |
| `t3e` | MCP config-change detector (`Vwe`) |
| `fw` | MCP server cleanup orchestrator (`hot`, `Uk`) |
| `hot` | MCP server instance cleanup helper (`Vwe`) |
| `mta` | MCP transport state machine (`Szr`) |
| `Szr` | MCP transport implementation dispatcher |
| `T` | Settings/config text formatter and file-path resolver |
| `QHc` | Config output formatter (`FO`, `ssr`, `j2o`) |
| `j2o` | Config string escaping helper (`ohc`, `shc`) |
| `Kc` | Path-component formatter / redactor (`g9o`, `e.replace`) |
| `g9o` | Home-directory abbreviator (`YHc.map`) |
| `Hqe` | stdout/stderr write helper (`s9o`) |
| `s9o` | Low-level stream write (`e.write`) |
| `n_c` | File-based logger / audit-log writer (`YWe`, `rpe`, `t_c`) |
| `YWe` | Batched log flush helper (uses `setTimeout`, `setImmediate`) |
| `rpe` | Log file path resolver (`Sqe`, `npe.join`, `tr`, `Lt`) |
| `jt` | Process working-directory resolver |
| `Pre` | Directory existence checker (`dn`) |
| `y9o` | Log sub-directory path builder (`npe.join`, `Lt`) |
| `csr` | Atomic file rename helper (`.txt` temp, `uU.rename`, `uU.unlink`) |
| `t_c` | Append-and-rotate log file writer (`uU.mkdir`, `uU.appendFile`) |
| `qi` | FinalizationRegistry / process-exit hook registrar (`B2o.register`) |
| `l` | Session-list / background-session tracker |
| `k0l` | Daemon status writer (`daemon.status.json`, `CQ`, `ci`, `Mjt`, `Pe`) |
| `CQ` | Daemon status store accessor (`vfe`) |
| `Mjt` | Daemon status file path builder (`x0l.join`, `tr`) |
| `B1o` | MCP remote-server retry loop orchestrator (`t.getClients`, `jLn`, `n3e`, `uZn`) |
| `jLn` | MCP server filter: checks `X2d`/`LKr` allow-sets |
| `Bn` | Promise timeout / deadline helper (`setTimeout`, `clearTimeout`, `s.unref`) |
| `c` | Timeout-node wrapper (`Tn`) |
| `u` | Daemon-stop orchestrator (`ke`, `Re`, `rF`, `SG`) |
| `ke` | Feature-flag OK reporter (`tengu_feature_ok`) |
| `j` | Low-level telemetry emitter |
| `Ue` | Telemetry payload builder (`ogt`) |
| `Re` | Feature-flag BAD reporter (`tengu_feature_bad`) |
| `rF` | Daemon stop command runner (`T4`, `yz.push`, `gFe`, `MNr`) |
| `T4` | Child-process spawner for daemon stop (`uB`) |
| `uB` | Process-spawn abstraction (`JYu`, `VH`, `OOe`) |
| `gFe` | Daemon stop result logger (`BR`) |
| `BR` | Log-entry builder (`ct`) |
| `MNr` | Daemon stop event emitter (`LHn`, `kNr.randomUUID`, `EJe`, `o8`, `e.emit`) |
| `LHn` | MCP/daemon log-line formatter (handles `external`/`firstParty` types) |
| `o8` | Session auth token generator (`Eko.randomBytes`, `pn`, `T`) |
| `SG` | Daemon graceful-shutdown orchestrator (`Promise.race`, `Lme`, `Nme`, `Bn`, `process.exit`) |
| `Lme` | MCP server shutdown caller (`wme.shutdown`) |
| `Nme` | Daemon stop notifier to main process (`clearTimeout`, `Cko`) |
| `Cko` | HTTP POST to daemon control endpoint (`NS.post`, `Content-Type: application/json`) |
| `Z5r` | Local-settings loader for sandbox rule application (`xn`, `QEd`, `co`, `ke`) |
| `xn` | Settings cache-aware reader entry (`Mnn`, `B2`) |
| `Mnn` | Cached settings fetch (`i2o`, `Thr`) |
| `i2o` | Settings WeakMap cache lookup (`Szt.has`, `Szt.get`) |
| `Thr` | Settings layer merger (`Vns`, `LSe`, `Hj`, `Wns`, `ZJ`) |
| `a2o` | Settings WeakMap cache setter (`Szt.set`) |
| `B2` | Full settings merge chain entry (`Ar`, `Qgt`, `Mnr`, `Ygt`, `ZRe`, `ePe`, `eHt`, `Ioe`, `kSe`, `$nn`, `lrs`, `iQ`, `kbt`) |
| `Ar` | Settings source loader (`gx`) |
| `QEd` | Pattern matcher for exclude rules (`e.match`) |
| `co` | Claude config directory reader and rule applier |
| `QA` | Settings scope resolver (`LSe`, `B2`) |
| `LSe` | Settings file reader (`o1.join`, `knn`, `IQc`, `J9`, `TQc`) |
| `bv` | Claude config file reader (`eQ`) |
| `eQ` | Raw settings file parser (`jt`, `jp`, `T`, `Zen`, `t.readFileSync`, `etn`, `s.slice`, `s.replaceAll`) |
| `Mn` | Error-safe directory/file existence helper (`dn`) |
| `dn` | Low-level fs stat wrapper |
| `RAr` | Settings write timestamp recorder (`Vtn.set`, `Date.now`) |
| `c1e` | Settings scope path resolver (`knn`, `B2`) |
| `knn` | `.claude` directory path resolver (`o1.resolve`, `tr`, `o1.dirname`) |
| `MSt` | Atomic file write utility (uses temp file, `fchmodSync`, `fsyncSync`, `renameSync`) |
| `jp` | Realpath resolver (`_d`, `YA`, `Yor`, `e.realpathSync`) |
| `vKe` | Extended-attribute error suppressor (`dn`) |
| `mH` | Settings cache invalidator (`Szt.clear`, `ctr.clear`) |
| `Ves` | Gitignore-aware settings file writer (`Mt`, `hAr`, `hSe.mkdir`, `hSe.readFile`, `hSe.appendFile`, `hSe.writeFile`) |
| `Mt` | Git ignore-check runner (`Qen`, `Ar`) |
| `hAr` | Gitignore rule applier (`Du`) |
| `Btn` | Gitignore rule formatter (`qr`) |
| `QXc` | Home-directory path expander (`EAr.homedir`, `Rpe.join`, `Rpe.isAbsolute`) |
| `Wes` | Gitignore-file line appender (`qr`) |
| `qes` | Gitignore write-ineffective warning emitter |
| `J9` | `.claude` settings directory path joiner (`o1.join`) |
| `Pt` | Feature-flag SAD reporter (`tengu_feature_sad`) |
| `_j` | Settings-load instrumentation wrapper (`hx`, `ha`, `Ihr`, `B2`, `bzt`) |
| `hx` | Settings load start marker |
| `ha` | Memory-usage sampler (`process.memoryUsage`, `Tsr.push`) |
| `Ihr` | Settings load span recorder (`Date.now`, `Ln`, `Tzt`, `ZJ`, `xbt`, `Vns`, `LSe`, `o1.resolve`, `Hj`, `Wns`) |
| `bzt` | Settings load end marker |
| `De` | Error logger / display formatter (`Ho`, `st`, `ra`, `Bzc`, `hKe.push`, `QJ.logError`) |
| `Ho` | Error message extractor (`Error`, `String`) |
| `st` | String cast helper (`String`) |
| `ra` | Error display emitter (`eJo`) |
| `Bzc` | Circular error buffer (`Ven.shift`, `Ven.push`) |
| `xV` | JSX result renderer for sandbox command output |

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.