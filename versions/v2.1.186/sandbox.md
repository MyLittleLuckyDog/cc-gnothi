---
type: feature-spec
feature: "sandbox"
cc_version: "2.1.186"
updated: "2026-06-23"
tags: ["sandbox", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.186 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/sandbox`

> Analysis basis: CC v2.1.186 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.186

---

## Overview

The `/sandbox` command configures process-level sandboxing for Claude Code, controlling which shell commands are allowed to execute without restriction and which must be blocked or sandboxed. It supports an `exclude` sub-command that appends a glob-style command pattern to the local settings file (`.claude/settings.local.json`), preventing that pattern from being subjected to sandbox restrictions. The command performs platform compatibility checks before any configuration change is applied.

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
| module_id | `ZPl` |
| load_inline | `true` |
| loc_byte | `12759643` |
| loc_byte_end | `12760338` |
| loc_line | `8680` |
| arbor_handler.name | `q_f` |
| arbor_handler.fqn | `claude-2.1.186::q_f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.186 bundle.js:+12759643

---

## Input Branching

The command has 4+ distinct execution paths based on platform, policy lock state, and the presence of the `exclude` sub-command with a valid argument.

```mermaid
flowchart TD
    A["/sandbox invoked"] --> B{Platform check\nisSupportedPlatform}
    B -- "not supported\n(not macOS/Linux/WSL2)" --> C{WSL version check}
    C -- "WSL1 detected" --> D["Return error:\n'Sandboxing requires WSL2.\nWSL1 is not supported.'"]
    C -- "no WSL at all" --> E["Return error:\n'Sandboxing is currently only\nsupported on macOS, Linux, and WSL2.'"]
    B -- "supported" --> F{checkDependencies}
    F -- "dependency missing" --> G["Return error result\n(type: 'error')"]
    F -- "ok" --> H{isPlatformInEnabledList}
    H -- "not in list" --> I["Return UI component\n(JSX sandbox config panel)"]
    H -- "in list" --> J{areSandboxSettingsLockedByPolicy}
    J -- "locked" --> K["Return error:\n'Sandbox settings are overridden\nby a higher-priority configuration\nand cannot be changed locally.'"]
    J -- "not locked" --> L{Parse args:\nfirst token == 'exclude'?}
    L -- "no / empty args" --> M["Return JSX sandbox\nconfiguration panel"]
    L -- "yes, but no pattern\n(args length < 8)" --> N["Return error:\n'Please provide a command pattern\nto exclude (e.g., /sandbox exclude\n\"npm run test:*\")'"]
    L -- "yes + pattern present" --> O["Slice pattern from args\napply regex replacement\nwrite rule via settingsWriter\nsave to .claude/settings.local.json"]
    O --> P["Compute relative path\nwith QPl.relative\nReturn confirmation via YV"]
```

Analysis basis: CC v2.1.186 bundle.js:+12758280

---

## Behavioral Spec

### Platform Guard

The handler (`q_f`) first checks whether the current platform is within the supported set.

```
async function sandboxCommandHandler(args, context):
    themeKind = getThemeKind()          // returns "light" or "dark"
    wslVersion = getWslVersion()         // returns "wsl" or null

    if not isSupportedPlatform():
        if wslVersion == "wsl":
            return errorResult("Error: Sandboxing requires WSL2. WSL1 is not supported.")
        else:
            return errorResult("Error: Sandboxing is currently only supported on macOS, Linux, and WSL2.")
```

Supported platforms: macOS, Linux, WSL2.
WSL1 is explicitly rejected with a distinct message.

Analysis basis: CC v2.1.186 bundle.js:+12758311, +12758347, +12758353, +12758411

---

### Dependency and Feature-Flag Checks

After the platform guard passes, dependencies are verified and the platform must be present in the enabled list.

```
    depResult = await checkDependencies()
    if depResult.type == "error":
        return depResult

    if not isPlatformInEnabledList():
        return renderSandboxConfigPanel(context)   // JSX component via eOl.jsx
```

Analysis basis: CC v2.1.186 bundle.js:+12758488, +12758528, +12758555

---

### Policy Lock Check

If the user's environment has an enterprise or higher-priority policy that locks sandbox settings, any mutation attempt is blocked.

```
    if areSandboxSettingsLockedByPolicy():
        return errorResult(
            "Error: Sandbox settings are overridden by a higher-priority configuration " +
            "and cannot be changed locally."
        )
```

Analysis basis: CC v2.1.186 bundle.js:+12758717, +12758776

---

### Argument Parsing — `exclude` Sub-command

The raw argument string is split and the first token is compared against the literal `"exclude"`.

```
    tokens = args.split(...)
    subCommand = tokens[0]

    if subCommand != "exclude":
        return renderSandboxConfigPanel(context)   // no sub-command → show panel

    patternSlice = args.slice(8)     // skip past "exclude " prefix (8 chars)

    if patternSlice is empty:
        return errorResult(
            'Error: Please provide a command pattern to exclude ' +
            '(e.g., /sandbox exclude "npm run test:*")'
        )
```

The offset `8` corresponds to the length of the prefix string `"exclude "`.

Analysis basis: CC v2.1.186 bundle.js:+12758985, +12759008, +12759025, +12759033, +12759070

---

### Writing the Exclusion Rule

When a valid pattern is present, the handler:

1. Applies a regex replacement on the pattern string (`u.replace` — `eqr` call chain).
2. Invokes the settings-layer writer (`eqr`) which resolves the local settings path and appends an `addRules` entry of kind `"sandbox_exclude_command"` to `.claude/settings.local.json`.
3. Delegates config-layer logic through `jm` / `ro` / `Xss` to read, merge, and atomically write the file.
4. Computes a display-friendly relative path via `QPl.relative`.
5. Returns a confirmation result via `YV`.

```
    cleanPattern = applyPatternReplace(patternSlice)   // u.replace at +12759189
    await writeExcludeRule(cleanPattern)               // eqr at +12759218
        // internally:
        //   load localSettings from .claude/settings.local.json
        //   append { kind: "addRules", value: cleanPattern }
        //   atomic write via BTt (writeFileSyncAndFlush)
    relativePath = computeRelativePath(cwd, settingsPath)   // QPl.relative at +12759255
    return confirmResult(relativePath)                 // YV at +12759268
```

The target file is always `.claude/settings.local.json` (not the user-level or project-level settings).

Analysis basis: CC v2.1.186 bundle.js:+12759189, +12759218, +12759231, +12759255, +12759268, +12759276

---

### Settings Write Path (detailed)

The `eqr` function (settings-exclude writer) resolves the settings file via a multi-layer config stack:

```
function writeExcludeRule(pattern):
    settingsLayers = loadSettingsFromDisk()
        // layers: "localSettings", "userSettings", "projectSettings",
        //         "policySettings", "flagSettings"
    localLayer = settingsLayers["localSettings"]
    existing = localLayer["addRules"] or []
    existing.push({ command: pattern, kind: "sandbox_exclude_command" })
    localLayer["addRules"] = existing
    atomicWrite(localSettingsPath, localLayer)
        // uses BTt (writeFileSyncAndFlush):
        //   write to temp file → fchmod → fsync → rename
```

The `"sandbox_exclude_command"` literal is the telemetry/rule kind tag stored in the settings file.

Analysis basis: CC v2.1.186 bundle.js:+4755346, +4755437, +4755588, +4755641, +4755720, +4755723

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_ok` (bundle.js:+1024705), `tengu_feature_bad` (bundle.js:+1024772), `tengu_feature_sad` (bundle.js:+1024853) — emitted by the feature-flag check layer (`ke` / `xe` / `Mt`) |
| Telemetry | `tengu_daemon_config_reload` (bundle.js:+17173497) — emitted when daemon config is reloaded after settings change |
| Telemetry | `tengu_config_auth_loss_prevented` (bundle.js:+13847465) — emitted by global config save guard |
| Settings file written | `.claude/settings.local.json` — appends to `addRules` array |
| Rule kind stored | `"sandbox_exclude_command"` |
| Hook registration | `O5o.register` called by `Ai` (telemetry/hook subsystem initializer) |
| appState changes | None directly; sandbox config panel rendered as JSX via `eOl.jsx` when no sub-command is given |
| Platform guard | Checked via `Do.isSupportedPlatform`, `Do.checkDependencies`, `Do.isPlatformInEnabledList`, `Do.areSandboxSettingsLockedByPolicy` |
| Sound | None detected in depth-2 traversal |
| MCP side effects | `Z3e` and `q2o` (MCP server/config manager) are in the call graph via the `a` branch — MCP config layer is consulted during settings load but not directly modified by `/sandbox` |

---

## Version History

| Version | Change |
|---|---|
| v2.1.186 | Initial analysis |

---

## Common Mistakes

1. **Using WSL1 instead of WSL2.** The sandbox feature explicitly requires WSL2 on Windows. Running under WSL1 produces the error `"Sandboxing requires WSL2. WSL1 is not supported."` and the command will not proceed.

2. **Omitting the pattern after `exclude`.** Invoking `/sandbox exclude` without a quoted pattern triggers an immediate error with a usage example. The pattern must follow directly after the sub-command token.

3. **Expecting changes in `settings.json` instead of `settings.local.json`.** All exclusion rules written by `/sandbox exclude` go to `.claude/settings.local.json` — the local, non-shared settings layer. The user-level `~/.claude/settings.json` is not touched.

4. **Attempting to use `/sandbox` in an enterprise-managed environment.** When `areSandboxSettingsLockedByPolicy()` returns true, no local override is possible. The error message instructs that a higher-priority configuration is in effect.

5. **Running on an unsupported platform.** The command silently falls through to a UI panel (or errors) on platforms not in the enabled list. Only macOS, Linux, and WSL2 are confirmed supported.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `q_f` | Main async handler for `/sandbox` command (Arbor-resolved, `module_id` path) |
| `To` | Terminal color/theme formatter (foreground color dispatch) |
| `fCe` | ANSI color string parser and mapper (supports hex, ansi256, rgb) |
| `rj` | Theme rendering helper called after color resolution |
| `Z3e` | MCP server configuration manager / connector orchestrator |
| `TB` | MCP server slot applicator (applies config updates to server slots) |
| `Sst` | MCP slot state initializer |
| `m7` | MCP server connection builder / dependency resolver |
| `B4` | MCP entry enumerator (iterates over config entries) |
| `aRn` | MCP warning/error color formatter (red/yellow for errors) |
| `_st` | MCP SSE/HTTP transport slot synchronizer |
| `JU` | Object-with-null-prototype factory |
| `Xw` | MCP connection wrapper / state holder |
| `Jm` | MCP connection lifecycle manager |
| `SXr` | MCP connection subscriber |
| `Wn` | Async iterator / stream utility |
| `yUt` | MCP server filter predicate |
| `fca` | MCP cache-key / connection-result applicator |
| `kQr` | MCP needs-auth cache reader |
| `ELe` | Config entry hasher (sha256, hex output) |
| `Y_n` | Settings key enumerator / normalizer |
| `X_n` | Settings cross-reference resolver |
| `IT` | Config entry content hasher |
| `j_n` | Blob/buffer hash helper |
| `Bl` | Hash-normalization utility |
| `ln` | MCP debug logger (`VJ.logMCPDebug`) |
| `wRn` | MCP OAuth / remote connection runner |
| `Lr` | OAuth flow initiator |
| `Lqd` | MCP remote connection handler (OAuth, token exchange) |
| `kqd` | MCP OAuth callback processor |
| `SUt` | MCP connection result applicator |
| `Xs` | AsyncLocalStorage store reader |
| `Pxn` | MCP needs-auth cache path builder |
| `De` | JSON serializer wrapper |
| `PXr` | MCP server config persistence writer |
| `Ae` | String coercion utility |
| `Qw` | MCP skills/tools telemetry emitter |
| `it` | MCP tool-registration event handler |
| `EXr` | MCP exclusion-list checker |
| `_n` | Global config save/load handler |
| `L` | Background worker lifecycle manager (grace clocks, respawn, retire) |
| `hcc` | Background context selector (system/away_summary) |
| `gcc` | Background worker spawner |
| `Wc` | MCP error logger (`VJ.logMCPError`) |
| `_ca` | Async iterable / stream mapper |
| `ZW` | Async iterable mapper with error aggregation |
| `nit` | Integer parser (radix 10) |
| `Oxn` | Integer parser variant (radix 20) |
| `arr` | MCP update applicator (`applyMcpUpdate`) |
| `Q3e` | MCP result hasher |
| `WT` | MCP cleanup orchestrator |
| `eit` | MCP individual slot cleanup |
| `maa` | MCP auto-update trigger |
| `AJr` | MCP auto-refresh handler |
| `T` | Logging utility (debug/info level, redacts secrets) |
| `Pvc` | Log entry formatter |
| `U5o` | Log sink dispatcher |
| `Lc` | Log line path redactor |
| `SWo` | Path component mapper |
| `eze` | Console write wrapper |
| `cWo` | Raw stream writer |
| `Fvc` | File-based log writer (append, rotate, flush) |
| `wKe` | Buffered write scheduler (setTimeout/setImmediate) |
| `npe` | Log file path resolver |
| `Rre` | Log directory creator |
| `TWo` | Log file path joiner |
| `pcr` | Log rotation handler (stat, rename, unlink) |
| `Uvc` | Log append + rotate executor |
| `Ai` | Telemetry hook registrar (`O5o.register`) |
| `QNl` | Daemon status file reader (`daemon.status.json`) |
| `_Q` | Daemon config accessor |
| `zqt` | Daemon status path builder |
| `q2o` | MCP remote-server retry/reconnect manager |
| `fRn` | MCP transport type capability checker |
| `Bn` | Timeout-guarded promise wrapper |
| `u` | Background session / daemon control context |
| `ke` | Feature-flag OK reporter (`tengu_feature_ok`) |
| `W` | Base telemetry emitter |
| `Pe` | Telemetry payload builder |
| `KVe` | Telemetry event name constant holder |
| `xe` | Feature-flag BAD reporter (`tengu_feature_bad`) |
| `gU` | Background session daemon starter |
| `F9` | Daemon process factory |
| `T2` | Worker process creator |
| `o$e` | Daemon first-party flag setter |
| `Ok` | MCP tool event re-emitter |
| `x2r` | Daemon session bootstrap (UUID, random bytes, emit) |
| `qEn` | Daemon worker main entry (external session runner) |
| `_W` | Daemon session credential generator |
| `j6` | Daemon stop sequence (race, all, exit) |
| `wme` | Daemon shutdown initiator |
| `Nme` | Daemon stop cleanup (clearTimeout, post) |
| `AOo` | Daemon control HTTP poster |
| `eqr` | Sandbox exclusion rule writer (settings layer) |
| `In` | Settings loader entry point |
| `Qon` | Settings cache lookup |
| `J4o` | Settings cache get/has |
| `CEr` | Settings policy/flag layer loader |
| `Q4o` | Settings cache set |
| `Z$` | Settings object builder (all layers) |
| `gr` | Settings file locator |
| `aEt` | Settings layer: policy fields |
| `Mir` | Settings merge utility |
| `oEt` | Settings layer: flag fields |
| `NPe` | Settings field normalizer |
| `UPe` | Settings field validator |
| `cEt` | Settings layer: computed fields |
| `Aoe` | Settings access helper |
| `ebe` | Settings default applier |
| `ssn` | Settings serializer |
| `pls` | Settings path list builder |
| `ZJ` | Settings JSON schema validator |
| `UIt` | Settings integrity checker |
| `Z0d` | Pattern match extractor (`e.match`) |
| `ro` | Settings file reader/writer (main implementation) |
| `jm` | Settings store locator (`QAe` + `Z$`) |
| `QAe` | User settings path resolver |
| `MC` | Settings directory walker |
| `zJ` | Settings file synchronous reader |
| `kn` | File error handler (ENOENT soft-fail) |
| `mn` | Filesystem error classifier |
| `Nyr` | Settings write timestamp recorder |
| `z1e` | Settings directory path resolver |
| `Xon` | Settings path normalizer |
| `BTt` | Atomic file writer (writeFileSyncAndFlush — stat, fchmod, fsync, rename) |
| `Fd` | Realpath resolver |
| `l7e` | Extended attribute error handler (EINVAL/ENOTSUP/EPERM/ENOSYS) |
| `EH` | Settings cache invalidator (`xYt.clear`, `csr.clear`) |
| `Xss` | Gitignore-aware settings file writer |
| `Ot` | Gitignore checker (`hrn` + `gr`) |
| `yyr` | Gitignore lookup utility |
| `ron` | Git check-ignore runner |
| `Vsu` | Path absolutizer with homedir expansion |
| `jss` | Git ls-files tracker |
| `Yss` | Settings append helper |
| `p9` | Settings path joiner (`.claude/settings.json`) |
| `Mt` | Feature-flag SAD reporter (`tengu_feature_sad`) |
| `DG` | Settings load orchestrator (start/end span) |
| `BL` | Settings load bootstrap |
| `na` | Memory usage sampler (`process.memoryUsage`) |
| `vEr` | Settings load telemetry emitter (`settings_load_started` / `settings_load_completed`) |
| `MYt` | Settings load completion recorder |
| `Re` | Error reporter / logger (`VJ.logError`) |
| `ao` | Error serializer |
| `ot` | Error string coercer |
| `Ki` | Essential-traffic traffic classifier |
| `Pnu` | Error ring-buffer manager |
| `YV` | Sandbox confirmation result renderer |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.