---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.141"
updated: "2026-05-31"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.141 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.141 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.141

---

## Overview

The `/sandbox` command configures the sandboxing policy for Claude Code's tool execution environment. It inspects platform compatibility and policy lock status, then allows the user to add command-pattern exclusions that bypass sandboxing restrictions, persisting them to `.claude/settings.local.json`. When sandbox settings are locked by a higher-priority policy (enterprise or managed configuration), the command reports an error and refuses to make changes.

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
| module_id | `nWq` |
| load_inline | `true` |
| loc_byte | `11484503` |
| loc_byte_end | `11485152` |
| loc_line | `7174` |
| arbor_handler.name | `Xv7` |
| arbor_handler.fqn | `claude-2.1.141::Xv7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.141 bundle.js:+11484503

---

## Input Branching

The handler has five or more distinct branches depending on platform support, WSL version, policy lock status, subcommand presence, and argument validation. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/sandbox invoked"]) --> B{Check theme mode}
    B -->|light theme| C[Apply light-mode color rendering]
    B -->|dark/other| D[Apply default color rendering]
    C --> E{Check platform support\nisSupportedPlatform}
    D --> E
    E -->|macOS / Linux / WSL2| F{checkDependencies}
    E -->|WSL1 detected| G["Error: Sandboxing requires WSL2.\nWSL1 is not supported."]
    E -->|Other unsupported OS| H["Error: Sandboxing is currently only\nsupported on macOS, Linux, and WSL2."]
    G --> Z([Return error message])
    H --> Z
    F --> I{isPlatformInEnabledList}
    I -->|not enabled| J[Render configuration UI\nfor enabling sandbox]
    I -->|enabled| K{areSandboxSettingsLockedByPolicy}
    K -->|locked| L["Error: Sandbox settings are overridden\nby a higher-priority configuration\nand cannot be changed locally."]
    L --> Z
    K -->|not locked| M{Parse subcommand\nfrom arguments}
    M -->|no subcommand| N[Render sandbox status / toggle UI]
    N --> Z
    M -->|subcommand == 'exclude'| O{Argument present after 'exclude'?}
    O -->|argument missing| P["Error: Please provide a command pattern\nto exclude (e.g., /sandbox exclude\n\"npm run test:*\")"]
    P --> Z
    O -->|argument present| Q[Parse pattern\nslice args at offset 8]
    Q --> R[Replace surrounding quotes\nin pattern string]
    R --> S[Load local settings\nr5_ → localSettings]
    S --> T[Append pattern to addRules\nvia sandboxExcludeCommand]
    T --> U[Persist to\n.claude/settings.local.json]
    U --> V[Compute relative path\nvia cWq.relative]
    V --> W[Render confirmation UI\nvia Cd]
    W --> Z([Return])
```

Analysis basis: CC v2.1.141 bundle.js:+11483122 – +11484128

---

## Behavioral Spec

### Platform Compatibility Gate

The handler first resolves the current color theme (literal `"light"` at bundle.js:+11483134) to choose foreground rendering via `colorThemeResolver` (`YA`), then calls `isSupportedPlatform` (`U_.isSupportedPlatform`, bundle.js:+11483153) to determine whether the host OS can run sandboxing.

```
async function sandboxHandler(args, appState):
    theme = getColorTheme(appState)          // zA → c6 at +11483122/+11483144
    colorCtx = resolveColorTheme(theme)      // YA at +11483330
    platformInfo = isSupportedPlatform()     // U_.isSupportedPlatform at +11483153

    if platformInfo.isWsl and platformInfo.wslVersion == "wsl1":
        return renderError("Error: Sandboxing requires WSL2. WSL1 is not supported.")
        // literal at +11483195

    if not platformInfo.supported:
        return renderError(
            "Error: Sandboxing is currently only supported on macOS, Linux, and WSL2."
        )
        // literal at +11483253

    waitIndicator = startSpinner()           // H at +11483354
    depCheck = await checkDependencies()     // U_.checkDependencies at +11483370
```

Analysis basis: CC v2.1.141 bundle.js:+11483122

---

### Policy Lock Check

After the platform gate, the handler checks whether sandbox configuration is governed by an enterprise or managed-settings policy that prohibits local overrides.

```
    platformEnabled = isPlatformInEnabledList()  // U_.isPlatformInEnabledList at +11483397

    if not platformEnabled:
        return renderSandboxEnableUI(colorCtx, depCheck)

    policyLocked = areSandboxSettingsLockedByPolicy()
    // U_.areSandboxSettingsLockedByPolicy at +11483559

    if policyLocked:
        return renderError(
            "Error: Sandbox settings are overridden by a higher-priority " +
            "configuration and cannot be changed locally."
        )
        // literal at +11483618
```

Analysis basis: CC v2.1.141 bundle.js:+11483397 and +11483559

---

### Subcommand Dispatch: `exclude`

Arguments are split on whitespace (`M.split` at bundle.js:+11483845). The handler checks whether the first token equals the literal `"exclude"` (bundle.js:+11483868).

```
    tokens = args.split(" ")                 // M.split at +11483845

    if tokens[0] != "exclude":
        return renderSandboxStatusUI(colorCtx, platformEnabled, depCheck)

    // "exclude" branch
    SUBCOMMAND_OFFSET = 8                    // numeric literal at +11483893
    rawPattern = args.slice(SUBCOMMAND_OFFSET)   // M.slice at +11483885

    if rawPattern is empty:
        return renderError(
            'Error: Please provide a command pattern to exclude ' +
            '(e.g., /sandbox exclude "npm run test:*")'
        )
        // literal at +11483930
```

The offset `8` (bundle.js:+11483893) equals the byte length of `"exclude "` (7 chars + 1 space), used to extract the pattern string directly.

Analysis basis: CC v2.1.141 bundle.js:+11483845

---

### Pattern Normalization and Settings Persistence

Once a valid pattern string is extracted, the handler strips surrounding quote characters and merges the new exclusion rule into local settings.

```
    pattern = rawPattern.replace(/(^["']|["']$)/g, "")
    // z.replace at +11484049

    localSettings = loadLocalSettings()     // r5_ at +11484078
    // r5_ resolves via I8 → $C6 → localSettings key at +4341907

    updatedSettings = appendExcludeRule(localSettings, pattern)
    // addRules key at +4341998, telemetry event "sandbox_exclude_command" at +4342284

    persistSettings(updatedSettings, ".claude/settings.local.json")
    // Jf at +11484091; literal ".claude/settings.local.json" at +11484136

    relativePath = cWq.relative(cwd, settingsPath)
    // cWq.relative at +11484115

    return renderConfirmation(relativePath, pattern, colorCtx)
    // Cd at +11484128
```

The constant `"sandbox_exclude_command"` (bundle.js:+4342284) is the telemetry label emitted when an exclusion rule is successfully added via `hH` (the telemetry dispatch helper).

Analysis basis: CC v2.1.141 bundle.js:+11484049

---

### MCP Infrastructure (Transitive Dependency)

The handler's module (`nWq`) is co-located with the MCP connection manager (`SvH`) and the MCP configuration layer (`M` / `XA5`). These are reached transitively through the settings-persistence path (`r5_` → `m_` → `Fm8` → MCP config watchers) and are not directly invoked by the `/sandbox` command itself. They appear in the call graph because the settings module is shared with MCP tooling.

<!-- TODO: not found in depth-2 traversal; needs --depth 4 — full MCP reconnect path under SvH/Nh_/SQ -->

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_ok` (bundle.js:+945566) — emitted by the telemetry dispatch helper (`hH`) on successful rule addition |
| Telemetry (transitive) | `tengu_mcp_oauth_flow_start`, `tengu_mcp_oauth_flow_success`, `tengu_mcp_oauth_flow_error` — from shared MCP OAuth layer, not directly triggered by `/sandbox` |
| Telemetry (transitive) | `tengu_bg_spare_enable`, `tengu_bg_spare_spawn`, `tengu_daemon_config_reload`, `tengu_daemon_control`, `tengu_daemon_yield` — from shared daemon/session layer |
| Telemetry (transitive) | `tengu_config_auth_loss_prevented` — from config-write safety guard |
| Settings write | Appends an exclusion rule to `.claude/settings.local.json` (bundle.js:+11484136) under the `addRules` / `sandboxExclude` key |
| Policy enforcement | Reads managed-settings.json, enterprise policy, user settings, and project settings before allowing any write (via `areSandboxSettingsLockedByPolicy`) |
| Cache invalidation | Settings load clears `kV6` and `XZ8` caches via `ZY` (bundle.js:+24901/+24913) on write |
| appState changes | None directly; sandbox enable/disable state is reflected through settings layer |
| Sound | None observed |
| Hook registration | None directly registered by this command |
| Spinner / UI | A wait indicator (`H` spinner) is started while dependency check runs (bundle.js:+11483354) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.141 | Initial analysis |

---

## Common Mistakes

1. **Running `/sandbox exclude` without quotes around patterns containing spaces or wildcards.** The argument hint explicitly shows `exclude "command pattern"` — omitting quotes causes the pattern to be parsed incorrectly or truncated at the first space.
2. **Expecting `/sandbox` to work on WSL1.** The handler hard-gates on WSL version; only WSL2 is supported. Upgrading the WSL distribution is required before the command becomes functional.
3. **Attempting to add exclusions when managed/enterprise policy is active.** The policy lock check (`areSandboxSettingsLockedByPolicy`) runs unconditionally after the platform check; local changes are silently refused with an error message when locked.
4. **Editing `.claude/settings.local.json` manually and expecting `/sandbox` to reflect it immediately.** The handler reads settings fresh on each invocation but the cache (`kV6`) may serve stale data; restarting the session ensures a clean read.
5. **Confusing `/sandbox exclude` with a runtime firewall rule.** The exclusion affects which commands are allowed to bypass sandboxing — it is a static configuration entry, not a dynamic per-session override.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Xv7` | Main async handler for `/sandbox` (arbor_handler, AsyncFunction) |
| `YA` | Color theme resolver (maps theme string to foreground color context) |
| `H` | Spinner / wait indicator factory; also used as random-delay utility |
| `_3H` | ANSI color code parser / terminal color mapper |
| `PF` | Terminal color profile helper (called by color theme resolver) |
| `M` | MCP settings manager / config applier (shared module) |
| `SvH` | MCP connection orchestrator (shared module) |
| `$HH` | MCP server config loader (reads enterprise/user/project/local layers) |
| `cqH` | MCP configuration merger (handles enterprise, mcp, user, project, local scopes) |
| `MHH` | MCP SDK server-type collector |
| `Dw6` | MCP SSE/HTTP server dispatcher |
| `hI` | MCP server instance builder |
| `G3` | Terminal prompt helper |
| `YG_` | MCP server identity resolver |
| `K` | MCP connection map / connection tracker |
| `L` | MCP transport lifecycle manager |
| `f` | MCP session/daemon I/O stream |
| `__` | Generic async utility wrapper |
| `rX6` | MCP server filter predicate |
| `xL7` | MCP timestamp / reconnect-state checker |
| `rh_` | MCP reconnect state reader |
| `$78` | MCP server hash / fingerprint calculator |
| `wi` | MCP config reader |
| `Yj` | MCP server SHA-256 fingerprint builder |
| `M78` | MCP server base-config accessor |
| `aK` | Settings key accessor |
| `_8` | MCP debug logger (writes to `mcpDebug` log channel) |
| `Nh_` | MCP OAuth orchestrator |
| `nK7` | OAuth tool-description builder |
| `DB` | Transaction helper (tx/sL) |
| `q6H` | MCP OAuth flow runner (full PKCE + local callback server) |
| `FrH` | OAuth token cache manager (`Bz8` map) |
| `D` | Background spare session lifecycle manager |
| `nz8` | MCP needs-auth cache path resolver |
| `SQ` | MCP server reconnect handler |
| `tx` | Config transaction writer |
| `Y` | Daemon config reload handler |
| `_7` | MCP error logger (writes to `mcpError` log channel) |
| `TH` | String coercion / error-message formatter |
| `iK7` | OAuth race-condition resolver |
| `lK7` | SSH-session URL resolver for OAuth redirect |
| `kh_` | MCP complete-authentication tool handler |
| `BrH` | OAuth pending-auth token getter (`Uz8` map) |
| `grH` | OAuth pending-auth set getter (`Bz8` map) |
| `sHq` | MCP needs-auth cache persistence helper |
| `p7` | AsyncLocalStorage context getter |
| `LY8` | MCP needs-auth cache file path builder |
| `SH` | JSON serializer wrapper |
| `Ih_` | MCP tool-hash / auth-status checker |
| `fG_` | MCP feature-flag / transport-type filter |
| `e6` | Global config save function (with auth-loss guard) |
| `A` | Transport type list (lowercase comparison) |
| `J` | Process cleanup / SIGTERM dispatcher |
| `N` | Away-summary background worker |
| `y` | Transient daemon write-stream wrapper |
| `z` | Daemon stop/start controller |
| `Q` | Promise / async error boundary |
| `iHq` | MCP port-range validator (`U$H`) |
| `U$H` | Integer / port-range validation utility |
| `oX6` | Port lower-bound parser (`parseInt`, base 10) |
| `oh_` | Port upper-bound parser (`parseInt`, base 20) |
| `Eeq` | MCP update applier (`applyMcpUpdate`) |
| `fY8` | MCP update serializer |
| `sI` | MCP cleanup coordinator |
| `irH` | MCP server-state serializer |
| `v` | Config value formatter / debug renderer |
| `J7K` | Config key normalizer |
| `Qt_` | Config key validator (`jKK`/`PKK`) |
| `t7` | Config redaction / path sanitizer |
| `T6A` | Config key mapper |
| `q` | Temp-file unlink utility |
| `MSH` | Global config writer (`M6A`) |
| `M6A` | Atomic file write helper |
| `X7K` | Settings file writer (mkdir + appendFile + rename) |
| `bhH` | Debounced write scheduler |
| `A_H` | Settings file path resolver |
| `x6` | File existence checker |
| `Cv8` | File-write error classifier |
| `y6A` | Settings directory path builder |
| `k6A` | Atomic rename helper (stat + rename + unlink) |
| `P7K` | Settings file append-and-rotate writer |
| `b9` | Write-lock set manager (`jI8`) |
| `$` | MCP state snapshot serializer |
| `XTq` | Daemon status file writer |
| `Ia` | Daemon status formatter |
| `b06` | Daemon status file path builder |
| `XA5` | MCP full-sync function (entries filter + reconnect + applyMcpUpdate) |
| `z78` | MCP capability checker (`tx4`/`ex4` sets) |
| `a8` | Retry-with-timeout helper |
| `O` | Background session abort controller |
| `r5_` | Local settings loader (reads `localSettings` for the sandbox command) |
| `I8` | Settings cache lookup |
| `$C6` | Settings cache getter (`Pt_`) + loader (`Bm8`) |
| `Pt_` | Settings LRU cache accessor (`kV6`) |
| `Bm8` | Settings file reader (policySettings / flagSettings) |
| `Xt_` | Settings cache setter (`kV6.set`) |
| `SsL` | Settings path pattern matcher |
| `m_` | Settings writer / rule appender (core persist function) |
| `Jf` | Settings file locator (user + project paths) |
| `Xc` | Settings directory resolver |
| `ahK` | Settings path validator |
| `ky` | `.claude` directory path builder |
| `ohK` | Managed settings path resolver |
| `Oo` | Settings path normalizer |
| `hD` | Settings file reader |
| `MB` | Raw settings file reader (readFileSync + replaceAll) |
| `$8` | Atomic file write (M8) |
| `M8` | Low-level atomic write primitive |
| `Fu8` | Settings write timestamp recorder (`IR6.set`) |
| `$CH` | Atomic file write with fsync and rename |
| `ZY` | Settings cache clear (`kV6.clear` + `XZ8.clear`) |
| `jR6` | Per-file settings read/write manager |
| `N6` | Settings file schema validator |
| `vu8` | Settings version upgrader (`VL`) |
| `hu8` | Settings migration helper (`M_`) |
| `WyK` | User home `.config` path builder |
| `e8` | Error handler for settings load |
| `ex` | Full settings-load orchestrator (loadSettingsFromDisk) |
| `rS` | Settings load pre-flight check |
| `T1` | Settings load deduplication guard (`U6A` set) |
| `Fm8` | Settings load with telemetry (`settings_load_started` / `settings_load_completed`) |
| `yV6` | Settings post-load hook |
| `kH` | Error logger with rolling buffer (`aRH`, `Oc.logError`) |
| `k_` | Error message coercer |
| `RH` | String sanitizer |
| `Vq` | Essential-traffic policy checker (`cMA`) |
| `GvK` | Rolling error buffer manager (`kS6`) |
| `hH` | Telemetry event dispatcher (`tengu_feature_ok` etc.) |
| `Cd` | Sandbox confirmation UI renderer |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.