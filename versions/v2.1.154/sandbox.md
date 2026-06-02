---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.154"
updated: "2026-06-02"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.154 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.154 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.154

---

## Overview

The `/sandbox` command configures the sandboxing behavior for shell commands executed by Claude Code. It validates platform support, checks for policy lock-out, and enables the user to add exclusion patterns that exempt specific command patterns from sandbox restrictions. When invoked without arguments (or with `⏎`), it opens an interactive configuration UI.

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
| module_id | `Un1` |
| load_inline | `true` |
| loc_byte | `12321125` |
| loc_byte_end | `12321774` |
| loc_line | `9226` |
| arbor_handler.name | `qf5` |
| arbor_handler.fqn | `claude-2.1.154::qf5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.154 bundle.js:+12321125

---

## Input Branching

The handler `qf5` has five or more distinct execution paths depending on platform, policy state, argument presence, and sub-command value; a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/sandbox invoked"] --> B{Platform check\nisSupportedPlatform}
    B -- "not macOS/Linux/WSL2" --> C["Return error:\nSandboxing only supported on macOS, Linux, WSL2"]
    B -- "WSL detected" --> D{WSL version check}
    D -- "WSL1" --> E["Return error:\nSandboxing requires WSL2. WSL1 is not supported."]
    D -- "WSL2" --> F[checkDependencies]
    B -- "macOS or Linux" --> F
    F --> G{isPlatformInEnabledList?}
    G -- "No / unsupported platform" --> H["Show platform-not-enabled UI"]
    G -- "Yes" --> I{areSandboxSettingsLockedByPolicy?}
    I -- "Yes (policy locked)" --> J["Return error:\nSandbox settings overridden by higher-priority config"]
    I -- "No" --> K{Parse argument}
    K -- "No argument / interactive" --> L["Open interactive sandbox\nconfiguration UI (JSX)"]
    K -- "'exclude' sub-command" --> M{Exclusion pattern provided?}
    M -- "No pattern after 'exclude'" --> N["Return error:\nPlease provide a command pattern to exclude\n(e.g. /sandbox exclude \"npm run test:*\")"]
    M -- "Pattern supplied" --> O["Write exclusion rule to\n.claude/settings.local.json\ntelemetry: sandbox_exclude_command"]
    O --> P["Confirm rule added"]
```

Analysis basis: CC v2.1.154 bundle.js:+12319744

---

## Behavioral Spec

### Platform Validation

Handler `qf5` begins by resolving the current execution context using a `getTheme`-like utility (`JA`) and a platform normalizer (`n6`).

```
async function sandboxCommandHandler(args, appContext):
    theme   = resolveTheme()          // JA — "light" vs other themes
    platform = normalizePlatform()    // n6

    if not sandboxSupport.isSupportedPlatform(platform):
        if platform == "wsl":
            return errorResult("Error: Sandboxing requires WSL2. WSL1 is not supported.")
        return errorResult("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")
```

Supported platform strings confirmed by literals: `"wsl"` checked explicitly; the generic unsupported message covers all other platforms.

Analysis basis: CC v2.1.154 bundle.js:+12319775 (isSupportedPlatform call), +12319811 (wsl literal), +12319817 (WSL1 error string), +12319875 (generic error string)

---

### Dependency and Policy Checks

After platform validation, the handler verifies runtime dependencies and enterprise policy state.

```
    dependencyCheck = await sandboxSupport.checkDependencies()
    // Logs result category as "error" if dependencies missing
    // bundle.js:+12319955 ("error" literal)

    if not sandboxSupport.isPlatformInEnabledList(platform):
        return showPlatformNotEnabledUI()

    if sandboxSupport.areSandboxSettingsLockedByPolicy():
        return errorResult(
            "Error: Sandbox settings are overridden by a higher-priority " +
            "configuration and cannot be changed locally."
        )
```

Analysis basis: CC v2.1.154 bundle.js:+12319992 (checkDependencies), +12320019 (isPlatformInEnabledList), +12320181 (areSandboxSettingsLockedByPolicy), +12320240 (policy-locked error string)

---

### Argument Parsing and Sub-command Dispatch

The argument string is split and the first token is compared against known sub-commands.

```
    tokens = args.split(...)           // M.split — bundle.js:+12320467
    subCommand = tokens[0]

    if subCommand == "exclude":        // literal: bundle.js:+12320490
        pattern = tokens.slice(8)      // numeric offset 8 — bundle.js:+12320515

        if not pattern:
            return errorResult(
                "Error: Please provide a command pattern to exclude " +
                "(e.g., /sandbox exclude \"npm run test:*\")"
            )                          // bundle.js:+12320552

        addExcludeRule(pattern, settingsPath)
        // writes to .claude/settings.local.json — bundle.js:+12320758
        emitTelemetry("sandbox_exclude_command")  // bundle.js:+4616139
        return confirmationResult()

    else:
        return openInteractiveConfigUI()   // JSX component rendered inline
```

Analysis basis: CC v2.1.154 bundle.js:+12320467, +12320490, +12320507 (M.slice), +12320515, +12320552, +12320700 (SW_ — settings write helper), +12320758

---

### Exclusion Rule Persistence (`SW_` / settings write path)

The function responsible for applying the exclusion rule (`SW_`, described here as `writeExcludeRule`) performs the following steps:

```
function writeExcludeRule(pattern, localSettingsPath):
    localSettings = loadSettings("localSettings")  // h8 — bundle.js:+4615759

    filteredRules = localSettings.addRules.filter(...)  // SW_._.filter — bundle.js:+4615830
    // Deduplicates or normalises existing rules

    matcher = buildRuleMatcher(pattern)   // RZ7 — H.match — bundle.js:+4607649
    if not alreadyIncluded(filteredRules, pattern):  // SW_.q.includes — bundle.js:+4616043
        updatedSettings = applyExclusion(localSettings, pattern)  // U_ — bundle.js:+4616057

    persistSettings(updatedSettings, ".claude/settings.local.json")
    // path literal: bundle.js:+12320758

    computeRelativePath(pattern)  // mn1.relative — bundle.js:+12320737
    resolveSettingKey("kn")       // kn — bundle.js:+12320750
```

The settings object key `"addRules"` is confirmed by the literal at bundle.js:+4615853.

Analysis basis: CC v2.1.154 bundle.js:+4615759, +4615830, +4615853, +4616004, +4616043, +4616057, +4616136

---

### Interactive Configuration UI

When no recognised sub-command is supplied (or the command is invoked bare with `⏎`), `qf5` renders a JSX component. The `immediate: true` registration flag means the UI is launched without requiring a secondary Enter press.

```
function openInteractiveSandboxUI(appContext):
    // Renders local-jsx component from module Un1
    // Provides controls for toggling sandbox on/off
    // and managing exclude-pattern lists
    return <SandboxConfigPanel theme={theme} platform={platform} />
```

Analysis basis: CC v2.1.154 bundle.js:+12321125 (registration object), +12320713 (wO — config panel helper)

---

### MCP / Background Infrastructure (reachable via `M`)

The deep call graph from `M` (reached at bundle.js:+12320467) traverses the full MCP server management subsystem (`vSH`, `JGK`, `Gm5`, `pc_`). This infrastructure is shared across multiple commands. For `/sandbox` specifically, it is exercised when the sandbox configuration change requires re-evaluating active MCP server states (e.g., reloading settings propagates through the MCP layer). It is not a direct user-visible behaviour of `/sandbox` itself.

<!-- TODO: not found in depth-2 traversal; needs --depth 4 — precise trigger condition for MCP reload on sandbox change -->

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `sandbox_exclude_command` | Fired when an exclusion pattern is successfully written (bundle.js:+4616139) |
| Telemetry: `tengu_feature_ok` | Fired on successful feature path (bundle.js:+965176, via shared `yH`/`c` helpers) |
| Telemetry: `tengu_feature_bad` | Fired on bad feature path (bundle.js:+965234) |
| Telemetry: `tengu_feature_sad` | Fired on sad/degraded feature path (bundle.js:+965311) |
| Telemetry: `tengu_daemon_config_reload` | May fire if settings change triggers daemon config reload (bundle.js:+15493092, via `Y`) |
| Telemetry: `tengu_config_auth_loss_prevented` | Defensive check in global config save path (bundle.js:+3205485) |
| Settings write | Exclusion rules are persisted to `.claude/settings.local.json` (bundle.js:+12320758) |
| Policy enforcement | `areSandboxSettingsLockedByPolicy` blocks writes when enterprise policy is active (bundle.js:+12320181) |
| appState changes | Settings state updated via `vSH`/`Gm5` MCP management layer when config changes propagate |
| Sound | None detected |
| Hook registration | `_9` → `f$A.register` (bundle.js:+58450) is in the reachable graph; this is a shared settings-change hook, not sandbox-specific |

---

## Version History

| Version | Change |
|---|---|
| v2.1.154 | Initial analysis |

---

## Common Mistakes

1. **Running `/sandbox exclude` without a quoted pattern.** The sub-command requires a pattern argument (e.g., `/sandbox exclude "npm run test:*"`). Omitting it returns an error and writes nothing.
2. **Using `/sandbox` on WSL1.** Only WSL2 is supported. The command will return a clear error; upgrading the WSL distro to WSL2 resolves it.
3. **Expecting `/sandbox` to work under enterprise policy lock.** When an administrator has locked sandbox settings via a higher-priority configuration layer, all local changes are blocked. The error message explicitly states this condition.
4. **Assuming exclusion patterns are global.** Patterns are written to `.claude/settings.local.json` (project-local scope), not to user-level settings.
5. **Invoking on unsupported platforms (Windows native, non-WSL).** The platform guard rejects the command on any OS that is not macOS, Linux, or WSL2.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `qf5` | Main async handler for `/sandbox` command (Arbor-resolved, `claude-2.1.154::qf5`) |
| `PA` | Terminal color / foreground style resolver |
| `lzH` | ANSI/RGB/hex color mapper (chalk-like) |
| `Hd` | Color helper utility |
| `M` | MCP settings manager / config split dispatcher |
| `vSH` | MCP server registry update function |
| `v8H` | MCP server slot resolver |
| `hP6` | MCP server config initializer |
| `U7H` | MCP server connection builder |
| `vc` | MCP SDK-type server collector |
| `hM8` | MCP config warning/error colorizer |
| `q` | MCP server cache / file cleanup set |
| `yP6` | SSE/HTTP MCP server manager |
| `Pk` | MCP config normalizer |
| `GO` | Config persistence helper |
| `Mk_` | Config mutation helper |
| `K` | MCP server list / pad formatter |
| `L` | MCP active-connection tracker |
| `f` | MCP server client wrapper |
| `H_` | Passthrough utility |
| `nV6` | MCP filter utility |
| `BpL` | MCP needs-auth cache builder |
| `pl_` | MCP auth-cache path resolver |
| `kM8` | MCP server key hash builder |
| `IM8` | MCP server identity hasher |
| `CX` | SHA-256 content hasher |
| `NM8` | MCP storage key resolver |
| `oK` | Config store accessor |
| `L8` | MCP debug logger |
| `pc_` | MCP connection lifecycle manager |
| `yuL` | MCP OAuth URL builder |
| `lg` | MCP logger dispatcher |
| `jAH` | MCP OAuth flow handler (full OAuth lifecycle) |
| `hH6` | MCP pending-auth request tracker |
| `D` | Background spare session enabler |
| `gT8` | MCP auth-cache getter |
| `Tl` | MCP reconnect orchestrator |
| `Vp` | Logger sink |
| `Y` | MCP daemon config reload trigger |
| `dL` | MCP error logger |
| `ZH` | String coercion utility |
| `huL` | MCP connection race helper |
| `IuL` | SSH/URL connection type detector |
| `Uc_` | MCP complete-authentication tool handler |
| `yH6` | Pending-auth CT8 cache lookup |
| `SH6` | bT8 cache getter |
| `j21` | MCP server start orchestrator |
| `o9` | Async-local-storage store getter |
| `DZ8` | MCP cache path builder |
| `RH` | JSON stringifier |
| `mc_` | MCP server reconnect helper |
| `Ak_` | MCP tool-availability checker |
| `O8` | Global config save (with auth-loss guard) |
| `A` | Tool/platform list checker |
| `j` | Background worker kill dispatcher |
| `y` | Background worker process wrapper |
| `O21` | Promise iteration mapper |
| `zo` | Async iterator / event-listener utility |
| `iV6` | parseInt wrapper (radix 10) |
| `Ul_` | parseInt wrapper (radix 20 / alternate) |
| `JGK` | MCP connection result applier |
| `wZ8` | MCP update applicator |
| `OrH` | MCP config hash/diff checker |
| `ok` | MCP server cleanup dispatcher |
| `dH6` | MCP server diff/hash helper |
| `N` | Config writer with git-integration |
| `URK` | Settings write dispatcher |
| `$$A` | Settings persistence helpers |
| `v4` | Path redaction / formatter |
| `FzA` | CRK map formatter |
| `HuH` | Config write wrapper |
| `yzA` | Raw config file writer |
| `gRK` | Settings file write orchestrator (with append/rotate logic) |
| `kxH` | File-write debounce/buffer manager |
| `cMH` | Settings path join helper |
| `B6` | File-existence checker |
| `B16` | J8 wrapper (error classifier) |
| `rzA` | Config file path joiner |
| `izA` | Config file rename/rotate helper |
| `FRK` | Config mkdir + appendFile writer |
| `_9` | Settings-change hook registrar |
| `$` | Session/daemon disposal tracker |
| `bo1` | Daemon status file writer |
| `Si` | Session ID generator |
| `MI6` | Daemon status path builder |
| `Gm5` | MCP server group refresh function |
| `SM8` | MCP tool suppression checker |
| `Q8` | Connection abort/timeout wrapper |
| `O` | Background session descriptor |
| `z` | Main daemon process controller |
| `yH` | Feature-ok telemetry emitter |
| `c` | Core telemetry dispatcher |
| `uH` | Feature-bad telemetry emitter |
| `vy` | MCP/OAuth client session builder |
| `fx` | OAuth transport factory |
| `wR` | OAuth request builder |
| `yEH` | OAuth event emitter wrapper |
| `Vy` | OAuth event sink |
| `Mz_` | MCP session initiator (with UUID) |
| `Z88` | MCP client constructor |
| `KU` | OAuth PKCE/random-bytes generator |
| `km` | Daemon shutdown race handler |
| `nQ` | MCP server shutdown caller |
| `aQ` | OAuth cleanup / clearTimeout |
| `uz_` | OAuth HTTP post helper |
| `SW_` | Sandbox local-settings exclude-rule writer |
| `h8` | Settings loader (localSettings) |
| `iF6` | Settings cache lookup |
| `x3A` | Settings cache read (lR6) |
| `Uo8` | Settings object builder (policySettings/flagSettings) |
| `u3A` | Settings cache write (lR6.set) |
| `ig` | Settings aggregator |
| `$_` | Settings override helper |
| `x96` | Settings field accessor |
| `Dm8` | Settings diff helper |
| `S96` | Settings scope resolver |
| `QWH` | Settings query helper |
| `dWH` | Settings default applier |
| `u96` | Settings utility |
| `H$H` | Settings hash helper |
| `_$H` | Settings field normalizer |
| `Ro8` | Settings reader |
| `lIA` | Settings list aggregator |
| `Di` | Settings item dispatcher |
| `aL6` | Settings async loader |
| `RZ7` | Exclude-pattern regex matcher |
| `U_` | Settings write + gitignore integration |
| `wO` | Config panel renderer |
| `K$H` | Settings path resolver |
| `zP` | Settings path helper |
| `Mi` | Settings file reader (readFileSync) |
| `P8` | Error classifier (J8 wrapper) |
| `J8` | ENOENT/EISDIR error classifier |
| `mr8` | Settings write timestamp recorder |
| `mGH` | Settings aggregator helper |
| `nF6` | Settings resolve/dirname helper |
| `$L6` | Atomic file writer (rename+fchmod+fsync) |
| `Xz` | Settings cache clearer |
| `tB6` | Settings append/write orchestrator |
| `C6` | Settings YB6 helper |
| `Tr8` | Settings I4 helper |
| `sB6` | git check-ignore runner |
| `Pq4` | git config / home-dir path expander |
| `oNA` | git ls-files runner |
| `aNA` | Settings append helper |
| `hb` | PN.join path helper |
| `t6` | Feature-sad telemetry emitter |
| `vp` | Settings load orchestrator |
| `gE` | Settings load start marker |
| `T9` | Memory-usage / dedup tracker |
| `Bo8` | Settings load executor |
| `nR6` | Settings load finalizer |
| `hH` | Error logging helper (with logError) |
| `F_` | Error/String formatter |
| `xH` | String coercion (String()) |
| `q1` | Error classification helper |
| `D84` | Rolling error log buffer manager |
| `kn` | Settings key resolver (final step in exclude flow) |