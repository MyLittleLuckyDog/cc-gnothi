---
type: feature-spec
feature: "config"
cc_version: "2.1.193"
updated: "2026-06-26"
tags: ["config", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.193 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/config`

> Analysis basis: CC v2.1.193 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.193

---

## Overview

`/config` (also accessible as `/settings`) opens an interactive settings panel that allows users to inspect and modify Claude Code's configuration at multiple scopes (user, project, local). It supports both a full interactive UI mode and a shorthand `key=value` syntax for programmatic or quick edits from the command line. Internally, the handler (`a_f`) dispatches to a large JSX-based settings component and a dedicated argument-parsing subsystem.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `config` |
| description | `Open settings` |
| aliases | `["settings"]` |
| argumentHint | `[key=value]` |
| module_id | `aLl` |
| load_inline | `true` |
| loc_byte | `11656393` |
| loc_byte_end | `11656671` |
| loc_line | `7337` |
| arbor_handler.name | `a_f` |
| arbor_handler.fqn | `claude-2.1.193::a_f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.193 bundle.js:+11656393

---

## Input Branching

The command has four distinct input paths based on the argument string and runtime state, requiring a Mermaid flowchart.

```mermaid
flowchart TD
    A(["/config invoked"]) --> B{Argument string present?}

    B -- No --> C[Open full interactive settings UI\nRender Oko.jsx config panel]

    B -- Yes --> D[Normalize argument:\ntrim + toLowerCase]

    D --> E{Argument matches\nshorthand key=value\nformat?}

    E -- No / Unrecognized --> F[Display error or\nopen UI with context]

    E -- Yes --> G{Parse key and value\nvia sKt}

    G --> H{Key is a\nknown setting key?}

    H -- No --> I[Emit config_shorthand_blocked\ntelemetry; return error message]

    H -- model key --> J{Model value requires\nfable/usage-credits consent?}

    J -- Consent missing --> K[Emit model_fable_consent\ntelemetry; block write;\nreturn error: "needs usage-credits consent — run /model first"]
    J -- Consent OK --> L[Write setting via\nsaveConfig pipeline]

    H -- Other known key --> L

    L --> M{Write succeeded?}
    M -- Yes --> N[Emit per-setting telemetry\ne.g. tengu_config_model_changed\nReturn updated value confirmation]
    M -- No --> O[Emit write failure telemetry;\nlog error]
```

Analysis basis: CC v2.1.193 bundle.js:+11655465, +11655526, +11655545, +11655697, +11449520, +11449498

---

## Behavioral Spec

### 1. Handler Entry — `configCommandHandler` (`a_f`)

```
async function configCommandHandler(context, argumentString):
    // Render the interactive UI component when no argument is given
    if argumentString is empty or whitespace:
        return renderJSX(ConfigPanelComponent)   // Oko.jsx

    // Normalize the raw argument
    normalized = argumentString.trim().toLowerCase()

    // Check if this is a key-check-only probe (no "=" separator)
    if normalized does not include "=":
        // May still be a valid read probe; falls through to panel
        return renderJSX(ConfigPanelComponent)

    // Delegate to shorthand argument parser
    result = parseConfigShorthand(normalized, context)
    return result
```

Analysis basis: CC v2.1.193 bundle.js:+11655465, +11655526, +11655545, +11655578

### 2. Shorthand Argument Parser — `parseConfigShorthand` (`sKt`)

```
function parseConfigShorthand(rawArg, context):
    trimmed = rawArg.trim()

    if trimmed does not include "=":
        return errorResult("expected key=value format")

    // Split on first "=" only
    eqIndex   = trimmed.indexOf("=")
    key       = trimmed.slice(0, eqIndex)
    remainder = trimmed.slice(eqIndex + 1)

    // Validate known keys list
    if key not in knownSettingKeys:
        emitTelemetry("config_shorthand_blocked")
        return errorResult("unknown setting key: " + key)

    // Split multi-value (comma-separated) remainder
    values = remainder.split(",") filtered/trimmed

    // Look up the value position in the ordered options list
    valueIndex = options.indexOf(remainder)
    if valueIndex < 0:
        // Try positional fallback via o.indexOf
        valueIndex = positionalOptions.indexOf(remainder)

    result = applySettingWrite(key, remainder, context)
    return result
```

Analysis basis: CC v2.1.193 bundle.js:+11454288, +11454305, +11454339, +11454357, +11454367, +11454395, +11454412, +11454521, +11454556

### 3. Settings Config Panel — `configPanelRenderer` (`b_t`)

The large JSX component `b_t` (resolved via `aKt` → `b_t`) builds the full interactive settings list. It enumerates all setting entries as objects with `key`, `label`, display type (`enum`, `managedEnum`, `boolean`, `string`), and available values. Notable settings registered in this component (Analysis basis: CC v2.1.193 bundle.js:+11437943 through +11453546):

| Setting Key | Label | Type | Known Values |
|---|---|---|---|
| `model` | `Model` | enum | `Default (recommended)`, shorthand aliases (`fable`, `sonnet`, `haiku`, `opus`, `best`, `opusplan`) |
| `verbose` | `Verbose output` | boolean | `on`/`off` |
| `thinking` | `Thinking mode` | boolean | `on`/`off` |
| `autoCompact` | `Auto-compact` | boolean | — |
| `tips` | `Show tips` | boolean | — |
| `reduceMotion` | `Reduce motion` | boolean | — |
| `preferredNotifChannel` | `Notifications` | enum | `terminal_bell`, `iterm2_with_bell`, `notifications_disabled`, `none` |
| `theme` | `Theme` | enum | (via `/theme` for custom) |
| `editor` / `editorMode` | `Editor mode` | enum | `emacs`, `normal`, `vim` |
| `language` | `Language` | string | ISO code or `default` |
| `outputStyle` | `Output style` | managedEnum | (via `/config` for custom) |
| `defaultView` | `Default view` | enum | `transcript`, `chat` |
| `permissionMode` | `Default permission mode` | enum | `default`, `plan`, `bypassPermissions`, `auto` |
| `autoCompactEnabled` | (auto-compact toggle) | boolean | — |
| `autoScroll` / `autoScrollEnabled` | `Auto-scroll` | boolean | — |
| `checkpoints` / `fileCheckpointingEnabled` | `Rewind code (checkpoints)` | boolean | — |
| `recap` | `Session recap` | boolean | — |
| `workflows` / `workflowKeywordTriggerEnabled` | `Dynamic workflows` / `Ultracode keyword trigger` | boolean | — |
| `progressBar` / `terminalProgressBarEnabled` | `Terminal progress bar` | boolean | — |
| `timestamps` / `showMessageTimestamps` | `Show message timestamps` | boolean | — |
| `turnDuration` / `showTurnDuration` | `Show turn duration` | boolean | — |
| `prStatus` | `Show PR status footer` | boolean | — |
| `diffTool` | `Diff tool` | enum | `terminal`, … |
| `autoConnectIde` | `Auto-connect to IDE (external terminal)` | boolean | — |
| `autoInstallIdeExtension` | `Auto-install IDE extension` | boolean | — |
| `chrome` | `Claude in Chrome` | boolean | — |
| `teammateMode` | `Teammate mode` | enum | `tmux`, `iterm2`, `in-process` |
| `teammateDefaultModel` | `Default teammate model` | string | — |
| `remoteControl` / `remoteControlAtStartup` | `Enable Remote Control for all sessions` | boolean | — |
| `agentsView` / `defaultToAgentsView` | `Agents view` | managedEnum | — |
| `autoUpdatesChannel` | `Auto-update channel` | enum | `rc`, `slow`, `latest` |
| `gitignore` | `Respect .gitignore in file picker` | boolean | — |
| `copyFullResponse` | `Skip the /copy picker` | boolean | — |
| `copyOnSelect` | `Copy on select` | boolean | — |
| `externalEditorContext` | `Show last response in external editor` | boolean | — |
| `apiKey` | `Use custom API key` | string | — |
| `worktreeBaseRef` | `Worktree base ref` | enum | `fresh`, `head` |
| `useAutoModeDuringPlan` | `Use auto mode during plan` | boolean | — |
| `showExternalIncludesDialog` | `External CLAUDE.md includes` | boolean | — |
| `precomputeCompactionEnabled` | `Precompute compaction` | boolean | — |
| `fast` | `Fast mode` | boolean (constrained) | `ON`/`OFF` |
| `switchModelsOnFlag` | — | boolean | — |
| `promptSuggestionEnabled` | `Prompt suggestions` | boolean | — |
| `showStatusInTerminalTab` | `Show status in terminal tab` | boolean | — |

Analysis basis: CC v2.1.193 bundle.js:+11438132 through +11453546

### 4. Settings Persistence — `settingsSaveCoordinator` (`co`) and `saveConfigWithLock` (`dXt`)

```
function settingsSaveCoordinator(key, value, scope):
    // Load current settings from disk for the relevant scope
    // Scopes: "userSettings", "projectSettings", "localSettings", "policySettings", "flagSettings"
    existing = loadSettingsFromDisk(scope)

    // Validate: refuse to write if auth data would be lost
    if existing has auth AND newValue is missing auth:
        logError("refusing to write to avoid wiping ~/.claude.json")
        emitTelemetry("tengu_config_auth_loss_prevented")
        return failure

    // Acquire file lock (max wait ~60000 ms)
    acquireLock(configPath)

    // Re-read under lock to detect stale writes
    reRead = readConfigFromDisk(configPath)
    if reRead differs from cached:
        emitTelemetry("tengu_config_stale_write")

    // Auto-repair if re-read has parse error
    if reRead parse error:
        emitTelemetry("tengu_config_auto_repaired")
        reRead = cachedConfig

    // Apply patch
    merged = merge(reRead, {[key]: value})

    // Atomic write: temp file → fsync → rename
    writeTempFile(merged)
    fsync(tempFd)
    rename(tempFile, configPath)

    // Manage backup rotation (keep ≤5 backups, suffix ".backup.")
    rotateBackups(configPath, maxBackups=5)

    releaseLock()
```

Lock contention warning threshold: 100 ms (Analysis basis: CC v2.1.193 bundle.js:+13973556).
Lock timeout: 60000 ms (Analysis basis: CC v2.1.193 bundle.js:+13974700).
Backup count limit: 5 (Analysis basis: CC v2.1.193 bundle.js:+13974955).
Backup file permission bits: 384 (0o600) (Analysis basis: CC v2.1.193 bundle.js:+13975237).

### 5. Model Shorthand Resolution — `modelAliasResolver` (`qo`)

```
function modelAliasResolver(rawAlias):
    alias = rawAlias.trim().toLowerCase()

    switch alias:
        case "fable":         → "claude-fable-5"      // requires usage-credits consent
        case "opus":          → claude-opus-4 series
        case "sonnet":        → claude-sonnet-4 series
        case "haiku":         → claude-haiku series
        case "best":          → highest capability model
        case "opusplan":      → opus planning variant
        case alias with "[1m]" suffix → extended context variant

    // Replace non-standard separators
    normalized = alias.replace(separator patterns)
    return resolvedModelId
```

The `fable` alias is special: the handler checks for usage-credits consent before applying it. If consent is absent, it emits `tengu_model_fable_consent` and blocks the write with message: `"needs usage-credits consent — run /model first"`.
Analysis basis: CC v2.1.193 bundle.js:+2306383, +2306398, +2306495, +2306538, +2306580, +2306618, +11449498, +11449520, +11449561

### 6. Notification Preference Patch — `notifPrefPatcher` (`Lmf`)

```
async function notifPrefPatcher(prefKey, value, authContext):
    if authContext is missing or "no_auth":
        emitTelemetry("notif_prefs_patch")  // with status "no_auth"
        return noOp

    // PATCH to remote notification preference endpoint
    response = await httpPatch(notifPrefsEndpoint, {[prefKey]: value})

    if response.ok:
        emitTelemetry("notif_prefs_patch_ok")
        logInfo("notif_prefs_patch_ok")
    else:
        emitTelemetry("notif_prefs_patch_failed")
        logError("http_error", response)
```

Analysis basis: CC v2.1.193 bundle.js:+11430463, +11430491, +11430529, +11430549, +11430570, +11430577, +11430665, +11430725

### 7. Fast Mode Toggle — `fastModeToggler` (`Uie`)

```
function fastModeToggler(requested, context):
    if context.provider != "anthropic-direct":
        emitTelemetry("tengu_penguins_off")
        return error("Fast mode is only available when using the Anthropic API directly")

    if context.provider == "agentSdk":
        return error("Fast mode is not available in the Agent SDK")

    orgStatus = fetchOrgStatus()
    switch orgStatus:
        case "pending":
            return info("Checking fast mode availability (org status pending)")
        case "disabled":
            return error("Fast mode is not available")
        case "network_error" | "unknown":
            return error(orgStatus)
        case "active":
            applyFastModeSetting(requested)
            emitTelemetry("tengu_thinking_toggled")
```

Analysis basis: CC v2.1.193 bundle.js:+2273047, +2273115, +2273462, +2273532, +2273593, +2273624, +2273624, +2273703, +2273752, +2273787, +2273816, +11440147

### 8. Settings Load from Disk — `settingsLoader` (`dW`)

```
function settingsLoader():
    emitTelemetry("loadSettingsFromDisk_start")  // internal log marker

    // Resolve paths
    userSettingsPath    = join(HOME, ".claude", "settings.json")
    localSettingsPath   = join(HOME, ".claude", "settings.local.json")

    // Load each scope with parse error tolerance
    for each scope in [userSettings, projectSettings, localSettings, policySettings, flagSettings]:
        try:
            raw = readFileSync(scopePath, "utf-8")
            parsed = JSON.parse(raw)
        catch ENOENT:
            parsed = {}
        catch parseError:
            logError(parseError)

    emitTelemetry("loadSettingsFromDisk_end")
    return mergedSettings
```

Settings file paths observed: `.claude/settings.json`, `.claude/settings.local.json`
Analysis basis: CC v2.1.193 bundle.js:+1324227, +1324237, +1324299, +1341423, +1341479

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — model change | `tengu_config_model_changed` (bundle.js:+11437945) |
| Telemetry — feature flags | `tengu_feature_ok`, `tengu_feature_sad`, `tengu_feature_bad` (bundle.js:+1026754, +1026902, +1026821) |
| Telemetry — push notif pref | `tengu_push_notif_pref_changed` (bundle.js:+11438721) |
| Telemetry — auto-compact | `tengu_auto_compact_setting_changed` (bundle.js:+11439159) |
| Telemetry — refusal fallback | `tengu_refusal_fallback_setting_changed` (bundle.js:+11439397) |
| Telemetry — tips | `tengu_tips_setting_changed` (bundle.js:+11439628) |
| Telemetry — reduce motion | `tengu_reduce_motion_setting_changed` (bundle.js:+11439926) |
| Telemetry — thinking toggle | `tengu_thinking_toggled` (bundle.js:+11440147) |
| Telemetry — fast mode consent | `tengu_penguins_off` (bundle.js:+2273153) |
| Telemetry — prompt suggestions | `tengu_chomp_inflection` (bundle.js:+11440588) |
| Telemetry — session recap | `tengu_sedge_lantern` (bundle.js:+11440822) |
| Telemetry — checkpoints | `tengu_file_history_snapshots_setting_changed` (bundle.js:+11441265) |
| Telemetry — verbose mode | `tengu_maple_sundial` (bundle.js:+11435812) |
| Telemetry — terminal progress bar | `tengu_terminal_progress_bar_setting_changed` (bundle.js:+11442255) |
| Telemetry — terminal sidebar | `tengu_terminal_sidebar` (bundle.js:+11442322) |
| Telemetry — config lock | `tengu_config_lock_contention` (bundle.js:+13973651) |
| Telemetry — stale write | `tengu_config_stale_write` (bundle.js:+13973787) |
| Telemetry — auto repair | `tengu_config_auto_repaired` (bundle.js:+13974164) |
| Telemetry — auth loss prevented | `tengu_config_auth_loss_prevented` (bundle.js:+13974494) |
| Telemetry — fallback write | `tengu_config_fallback_write` (bundle.js:+13973267) |
| Telemetry — terminal tab status | `tengu_terminal_tab_status_setting_changed` (bundle.js:+11442570) |
| Telemetry — turn duration | `tengu_show_turn_duration_setting_changed` (bundle.js:+11442794) |
| Telemetry — precompute compaction | `tengu_precompute_compaction_setting_changed` (bundle.js:+11443114) |
| Telemetry — timestamps | `tengu_show_message_timestamps_setting_changed` (bundle.js:+11443429) |
| Telemetry — gitignore | `tengu_respect_gitignore_setting_changed` (bundle.js:+11445120) |
| Telemetry — fullscreen (amber/pewter) | `tengu_amber_creek`, `tengu_pewter_brook` (bundle.js:+3549303, +3549210) |
| Telemetry — push notif kairos | `tengu_kairos_input_needed_push`, `tengu_kairos_push_notifications` (bundle.js:+5061781, +5061718) |
| Telemetry — default view | `tengu_default_view_setting_changed` (bundle.js:+11448015) |
| Telemetry — editor mode | `tengu_editor_mode_changed` (bundle.js:+11448604) |
| Telemetry — external editor | `tengu_external_editor_context_changed` (bundle.js:+11448919) |
| Telemetry — PR status footer | `tengu_pr_status_footer_setting_changed` (bundle.js:+11449233) |
| Telemetry — diff tool | `tengu_diff_tool_changed` (bundle.js:+11449806) |
| Telemetry — auto-connect IDE | `tengu_auto_connect_ide_changed` (bundle.js:+11450078) |
| Telemetry — auto-install IDE ext | `tengu_auto_install_ide_extension_changed` (bundle.js:+11450382) |
| Telemetry — chrome | `tengu_claude_in_chrome_setting_changed` (bundle.js:+11450718) |
| Telemetry — teammate mode | `tengu_teammate_mode_changed` (bundle.js:+11451114) |
| Telemetry — CCR bridge | `tengu_ccr_bridge` (bundle.js:+13956133) |
| Telemetry — auto mode config | `tengu_auto_mode_config` (bundle.js:+13834789) |
| Telemetry — sepia/silk/amber | `tengu_sepia_moth`, `tengu_silk_hinge`, `tengu_amber_flint` (bundle.js:+11442858, +11443185, +7216877) |
| Telemetry — daemon | `tengu_daemon_config_reload`, `tengu_daemon_idle_exit` (bundle.js:+17498707, +17504149) |
| Telemetry — bg worker | `tengu_bg_retire_pinned_low_mem`, `tengu_bg_prewarm_per_sweep` (bundle.js:+17487013, +17487134) |
| Config file writes | Atomic write (temp → fsync → rename) to `~/.claude/settings.json`, `~/.claude/settings.local.json`, and project-scoped equivalents |
| Backup rotation | Up to 5 backups with `.backup.` suffix; old backups removed via `unlinkSync` |
| Cache invalidation | `Den.clear()`, `Xdr.clear()` called on settings write (bundle.js:+29196, +29208) |
| Notification prefs remote sync | HTTP PATCH to remote notifications endpoint when `preferredNotifChannel` or `inputNeededNotifEnabled` changes |
| appState changes | `e.setAppState` called after certain settings changes (bundle.js:+11458342); `e.getAppState` read before (bundle.js:+11457429) |
| Sound | No sound side-effects found in depth-2 traversal |
| Config panel telemetry event | `config_panel` string literal present (bundle.js:+11448650); likely emitted on panel open |

---

## Version History

| Version | Change |
|---|---|
| v2.1.193 | Initial analysis. Panel includes: fast mode, teammate mode, remote control, Chrome integration, precompute compaction, worktree base ref, auto mode during plan, external CLAUDE.md includes, show PR status, diff tool, auto-connect/install IDE, output style, default view, language, editor mode, external editor context. |

---

## Common Mistakes

1. **Using `/config key=value` for model shorthand without consent**: Setting `model=fable` requires usage-credits consent obtained through `/model` first. The command will block and emit `config_shorthand_blocked` / `model_fable_consent` if consent is absent.
2. **Expecting immediate remote propagation of notification preferences**: The `preferredNotifChannel` setting is both written to local disk and PATCHed to a remote endpoint; network failure only affects the remote sync, not local persistence.
3. **Assuming all settings are writable in all contexts**: Settings like `fast` (Fast Mode) are restricted to the direct Anthropic API provider. Attempting to toggle them under Bedrock, Vertex, or the Agent SDK will return an error without modifying state.
4. **Concurrent Claude instances and lock contention**: If two Claude Code instances write config simultaneously, the second instance will observe lock contention (warning logged after 100 ms). The atomic rename strategy prevents partial writes but contention is still observable in logs as `tengu_config_lock_contention`.
5. **Expecting `/config` and `/settings` to behave differently**: They are exact aliases — `aliases: ["settings"]` in the registration means both names invoke the identical handler.
6. **Providing a key without `=` expecting a read**: The current argument parser interprets a bare key (no `=`) the same as an empty argument and opens the full interactive panel rather than printing the current value of a specific key.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `a_f` | Main async handler for `/config` command (`configCommandHandler`) |
| `aKt` | Settings panel orchestrator; builds panel + flatMap of entries |
| `b_t` | Large JSX settings panel renderer; enumerates all setting entries |
| `sKt` | Shorthand argument parser (`key=value` splitter and validator) |
| `co` | Settings loader/writer coordinator (multi-scope settings management) |
| `dW` | Settings loader from disk (`loadSettingsFromDisk`) |
| `dXt` | Atomic config writer with lock (`saveConfigWithLock`) |
| `mn` | Global config save orchestrator (`saveGlobalConfig`) |
| `Qor` | Config write helper (fallback write path) |
| `qo` | Model alias resolver |
| `NPe` | Model option list builder (opus/sonnet aliases etc.) |
| `Uie` | Fast mode toggle logic with provider/org checks |
| `mL` | Fast mode UI setting wrapper |
| `Lmf` | Notification preference remote patcher |
| `RRo` | Config panel entry dispatch / section router |
| `_Cl` | Config panel section resolver |
| `$Ro` | App-state-aware settings applier (reads/sets appState) |
| `bc` | Project/legacy config boundary checker |
| `wCn` | Workflow enable/disable toggle handler |
| `ixi` | Workflow permission writer |
| `oC` | Permission set mutation helper |
| `tQe` | Project directory resolver |
| `B$e` | Settings schema runner/validator |
| `yB` | Settings object constructor (merges scopes) |
| `Svr` | Settings file directory initializer |
| `PH` | Settings cache clearer (`Den.clear`, `Xdr.clear`) |
| `wCr` | Settings cache writer (`gcn.set`) |
| `U4` | Settings file path builder (`g1.join`) |
| `Qwt` | Atomic file write with fsync (`writeFileSyncAndFlush`) |
| `wgs` | Git-ignore-aware settings writer |
| `In` | File error handler (ENOENT etc.) |
| `T` | Debug-level logging utility |
| `ke` | JSON serializer (`JSON.stringify` wrapper) |
| `we` | Feature flag OK reporter (`tengu_feature_ok`) |
| `vt` | Feature flag sad reporter (`tengu_feature_sad`) |
| `Re` | Feature flag bad reporter (`tengu_feature_bad`) |
| `VJ` | Settings merge/patch applier |
| `kA` | Model ID constructor (fable model builder) |
| `So` | Model family classifier |
| `m_n` | Model metadata builder |
| `oH` | Model option helper |
| `Fm` | Model filter/display helper |
| `vW` | Fable model variant builder |
| `pF` | Model tier resolver (`firstParty`, `default_claude_zero`) |
| `F_e` | Model capability probe |
| `Ece` | Model selection UI builder |
| `rH` | Model rendering helper |
| `$b` | Model render entry builder |
| `qge` | Model entry component |
| `zge` | Model section component |
| `_r` | Provider/context resolver (bedrock, vertex, foundry, etc.) |
| `Ci` | Model UI component |
| `Ds` | Fullscreen/display settings section builder |
| `cB` | Local-agent capability checker |
| `cM` | Feature flag enabled checker (`tHi.isEnabled`) |
| `NWr` | Fullscreen entry builder |
| `Zee` | Display section entry builder |
| `OWr` | Windows/SSH flicker guard |
| `kr` | Config panel full-screen section connector |
| `aId` | Fullscreen setting applier |
| `SL` | Notification settings section builder |
| `nrt` | Notification channel resolver |
| `WDe` | Notification settings wrapper |
| `cc` | Theme-related section builder |
| `El` | Safe-mode entry builder |
| `cd` | Bare-mode entry builder |
| `S5` | Output style prefix parser |
| `IMn` | Push-notification-input-needed setting handler |
| `ACl` | Model shorthand option list builder |
| `qie` | Model shorthand option resolver |
| `CRo` | Model option filter (includes check, lowercase) |
| `vRo` | Extended model option filter |
| `wa` | Per-setting write dispatcher (routes key to correct write fn) |
| `A9t` | Permission rules settings section builder |
| `lj` | Permission rules list builder |
| `qAe` | Permission rules add-rules renderer |
| `A3o` | Permission section component ($4, II, Fvr) |
| `Ja` | Teammate mode setting handler |
| `jlo` | Teammate model entry builder |
| `NXn` | Teammate config entry builder |
| `VWt` | Teammate default model option builder |
| `QC` | Remote control settings section builder |
| `AWe` | Remote control entry builder |
| `upe` | Auto-update channel section builder |
| `Jor` | Update channel entry builder |
| `lo` | Module ESM initializer helper |
| `A_t` | Config panel entry type dispatch (kt/kr) |
| `mEe` | Auto-updater environment check |
| `nJe` | Update disable env checker |
| `V5e` | IDE connection state checker (`e.some`) |
| `Bi` | IDE connection entry builder |
| `Rds` | IDE connection component |
| `yS` | Model provider component |
| `$Pe` | Permission $4 accessor |
| `BVe` | Auto-mode config entry builder |
| `fce` | Push notification enabled setting handler |
| `wCn` | Workflow enable/disable handler |
| `ixi` | Workflow permission record writer |
| `S_t` | Verbose output setting handler |
| `UPe` | Verbose toggle applier |
| `mn` | Global config save pipeline |
| `dXt` | Save-config-with-lock (atomic write) |
| `cXt` | Lock timestamp helper |
| `lXt` | Lock state bootstrapper |
| `TSt` | Config temp-file path builder |
| `Nn` | Generic value unwrapper |
| `l9o` | Config entry object-entries iterator |
| `l$` | API key display truncator (slice to 20 chars) |
| `it` | Telemetry event emitter |
| `kt` | Telemetry event emitter (alternate form with timestamp) |
| `lCn` | Telemetry deduplication helper |
| `ljr` | Config section list builder |
| `cjr` | Config section item builder |
| `Glo` | Teammate section group builder |
| `WWt` | Teammate option label builder |
| `BJe` | Permission mode entry builder |
| `lL` | Bubble notification helper |
| `p1` | Notification channel filter |
| `_n` | Environment-based display context helper |
| `sun` | Settings path environment router |
| `MFe` | Fast mode wrapper/gate |
| `z4` | Fast mode status display builder |
| `lve` | Fast mode availability label |
| `ic` | Config item component renderer |
| `at` | Base component renderer |
| `Oe` | Unset label renderer |
| `Ve` | Section group component |
| `Zze` | Base layout element |
| `dDn` | Config section divider |
| `jY` | Divider component |
| `mr` | Log/event relay (`Rx`) |
| `hv` | Terminal size helper (`MZ`) |
| `v` | Worker state map |
| `w` | Background worker sweep scheduler |
| `L` | Background worker lifecycle manager |
| `KAc` | Worker entry accessor |
| `zAc` | Worker yield helper |
| `xB` | Model options loader |
| `m_n` | Model metadata object builder |
| `Fm` | Model filter/format helper |
| `O` | Output writer with debounce |
| `d` | Daemon message writer |
| `F` | Output flush function |
| `B` | Worker/process set |
| `x` | Process kill/cleanup handler |
| `hR` | Process kill executor |
| `Yge` | Process output trimmer |
| `MRo` | Config section model separator |
| `MT` | Config panel container |
| `URo` | Config panel footer |
| `eme` | Unknown-setting fallback entry |
| `sa` | Remote control session helper |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.