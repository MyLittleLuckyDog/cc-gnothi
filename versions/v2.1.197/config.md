---
type: feature-spec
feature: "config"
cc_version: "2.1.197"
updated: "2026-07-01"
tags: ["config", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.197 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/config`

> Analysis basis: CC v2.1.197 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.197

---

## Overview

The `/config` command (alias: `/settings`) opens the interactive settings panel for Claude Code, allowing users to inspect and modify a wide range of preferences—from model selection, thinking mode, and notification channels to UI behaviors, editor integration, and permission modes. When invoked with a `key=value` argument, it applies the setting directly as a shorthand without opening the full panel. The command's handler (`z$f`) is an async function resolved via module `B2l` that renders a JSX component and dispatches state changes through the app's settings system.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `config` |
| description | `Open settings` |
| aliases | `["settings"]` |
| argumentHint | `[key=value]` |
| module_id | `B2l` |
| load_inline | `true` |
| loc_byte | `11824054` |
| loc_byte_end | `11824332` |
| loc_line | `7541` |
| arbor_handler.name | `z$f` |
| arbor_handler.fqn | `claude-2.1.197::z$f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.197 bundle.js:+11824054

---

## Input Branching

The handler has 4+ distinct branches depending on the presence and content of the argument string and the current application state.

```mermaid
flowchart TD
    A(["/config called with optional argument]) --> B{Argument present?}
    B -- No --> C[Open full interactive settings panel\n(JSX component rendered)]
    B -- Yes --> D[Normalize argument: trim + toLowerCase]
    D --> E{Known shorthand key?}
    E -- "model=..." --> F[Parse model alias or shorthand\nCheck fable-consent requirement\nApply model change]
    F --> F1{Consent required?}
    F1 -- Yes --> F2[Emit config_shorthand_blocked\nReturn error: needs usage-credits consent]
    F1 -- No --> F3[Apply model, emit tengu_config_model_changed]
    E -- "thinking=..." --> G[Toggle thinking mode\nEmit tengu_thinking_toggled]
    E -- "verbose=..." --> H[Set verbose output\nPersist to user settings]
    E -- Other known key --> I[Apply corresponding boolean/enum setting\nPersist via settings writer]
    E -- Unknown key --> J[Parse as key=value pair\nAttempt generic settings patch\nor return usage hint]
    C --> K([Settings panel displayed])
    F3 --> L([Setting applied, confirmation rendered])
    F2 --> L
    G --> L
    H --> L
    I --> L
    J --> L
```

Analysis basis: CC v2.1.197 bundle.js:+11823126, +11823187, +11823206, +11823316, +11823358

---

## Behavioral Spec

### 1. Handler Entry Point — `configCommandHandler` (`z$f`)

```
async function configCommandHandler(argument, appContext):
    // Render the settings JSX component unconditionally as the return value
    jsxOutput = renderJSX(settingsPanelComponent)   // zFo.jsx @ +11823126

    if argument is null or empty:
        return jsxOutput   // opens full panel

    normalizedArg = argument.toLowerCase()           // +11823187

    // Check whether arg matches a known flag list
    if normalizedArg in knownFlagKeys:               // F5.includes @ +11823206
        // handled by flag processor path
    elif normalizedArg in knownLiteralKeys:          // lle.includes @ +11823222
        // handled by literal key path
    else:
        // treat as raw key=value shorthand
        parsedPair = parseKeyValuePair(normalizedArg)  // e() @ +11823239

    result = applySettingShorthand(parsedPair, appContext)  // eXt @ +11823316

    if shorthand includes model alias:
        result = resolveAndApplyModel(parsedPair, appContext)  // QJt @ +11823358

    return result
```

Analysis basis: CC v2.1.197 bundle.js:+11823126

---

### 2. Key=Value Pair Parser — `parseKeyValuePair`

```
function parseKeyValuePair(rawInput):
    trimmed = rawInput.trim()                    // QJt.e.trim @ +11620988
    if "=" in trimmed:                           // t.includes @ +11621005
        parts = trimmed.split("=")               // t.split @ +11621039
        key   = parts[0].trim()
        value = parts[1..].join("=")             // handles values containing "="
    else:
        key   = trimmed
        value = null

    // Normalize recognized aliases
    normalizedKey = resolveKeyAlias(key)         // Fn @ +11621057

    if "." in key:                               // o.includes @ +11621067
        // dotted path: find separator index
        dotIndex = key.indexOf(".")              // t.indexOf @ +11621095
        prefix   = key.slice(0, dotIndex)        // t.slice  @ +11621112
        suffix   = key.slice(dotIndex+1)
    ...

    return { key: normalizedKey, value, raw: trimmed }
```

Analysis basis: CC v2.1.197 bundle.js:+11620988

---

### 3. Settings Panel Component — `settingsPanelRenderer` (`uAt`)

The interactive panel is built by `uAt`, which assembles all visible setting rows. Each row is driven by a descriptor object containing a key identifier, a human-readable label, a control type (boolean toggle, enum selector, or free-text input), and an optional telemetry event name.

The following table lists all setting rows discovered via literals in the `uAt` call graph:

| Setting Key | Label | Control type |
|---|---|---|
| `model` | `Model` | enum (shorthand aliases + `/model` redirect) |
| `verbose` | `Verbose output` / `Verbose` | boolean |
| `thinking` | `Thinking mode` | boolean toggle |
| `autoCompact` / `autoCompactEnabled` | `Auto-compact` | boolean |
| `tips` | `Show tips` | boolean |
| `reduceMotion` | `Reduce motion` | boolean |
| `promptSuggestionEnabled` | `Prompt suggestions` | boolean |
| `recap` | `Session recap` | boolean |
| `checkpoints` / `fileCheckpointingEnabled` | `Rewind code (checkpoints)` | boolean |
| `workflows` / `workflowKeywordTriggerEnabled` | `Dynamic workflows` / `Ultracode keyword trigger` | boolean |
| `artifacts` | `Artifacts` | boolean |
| `progressBar` / `terminalProgressBarEnabled` | `Terminal progress bar` | boolean |
| `showStatusInTerminalTab` | `Show status in terminal tab` | boolean |
| `turnDuration` / `showTurnDuration` | `Show turn duration` | boolean |
| `precomputeCompactionEnabled` | `Precompute compaction` | boolean |
| `timestamps` / `showMessageTimestamps` | `Show message timestamps` | boolean |
| `permissionMode` | `Default permission mode` | enum (`default`, `plan`, `bypassPermissions`, `auto`) |
| `worktreeBaseRef` | `Worktree base ref` | enum (`fresh`, `head`) |
| `useAutoModeDuringPlan` | `Use auto mode during plan` | boolean |
| `gitignore` | `Respect .gitignore in file picker` | boolean |
| `copyFullResponse` | `Skip the /copy picker` | boolean |
| `copyOnSelect` | `Copy on select` | boolean |
| `autoScroll` / `autoScrollEnabled` | `Auto-scroll output` | boolean |
| `agentsView` / `defaultToAgentsView` | `Agents view` / `Open agents view by default` | boolean |
| `leftArrowOpensAgents` | *(UI navigation option)* | boolean |
| `autoUpdatesChannel` | `Auto-update channel` | enum (`rc`, `slow`, `latest`) |
| `theme` | `Theme` | enum (managed list; redirect to `/theme` for custom) |
| `notifChannel` / `preferredNotifChannel` | `Notifications` | enum (`terminal_bell`, `iterm2+bell`, `notifications_disabled`, …) |
| `inputNeededNotifEnabled` | `Push when actions required` | boolean |
| `agentPushNotifEnabled` | `Push when Claude decides` | boolean |
| `outputStyle` / `outputStyles` | `Output style` | enum (redirect to `/config` for custom) |
| `defaultView` | `Default view` | enum (`transcript`, `chat`) |
| `language` | `Language` | free-text (any language name or ISO code; `default` = English) |
| `editor` / `editorMode` | `Editor mode` | enum (`emacs`, `normal`, `vim`) |
| `externalEditorContext` | `Show last response in external editor` / `Show responses in IDE` | boolean |
| `prStatus` | `Show PR status footer` / `Show PR status` | boolean |
| `diffTool` | `Diff tool` | enum (includes `terminal`) |
| `autoConnectIde` | `Auto-connect to IDE (external terminal)` | boolean |
| `autoInstallIdeExtension` | `Auto-install IDE extension` | boolean |
| `chrome` | `Claude in Chrome` | boolean |
| `teammateMode` | `Teammate mode` | enum (`tmux`, `iterm2`, `in-process`) |
| `teammateDefaultModel` | `Default teammate model` | enum/free-text (redirect to `/config` for specific ID) |
| `remoteControl` / `remoteControlAtStartup` | `Enable Remote Control for all sessions` | boolean |
| `showExternalIncludesDialog` | `External CLAUDE.md includes` / `External CLAUDE.md files` | boolean |
| `apiKey` | `Use custom API key` | free-text (displays masked key) |
| `switchModelsOnFlag` | *(refusal fallback model switch)* | boolean |

Analysis basis: CC v2.1.197 bundle.js:+11604780 through +11619306

---

### 4. Model Shorthand Resolution — `settingsShorthandApplier` (`eXt`) and `modelSettingComponent` (`uAt`)

```
function applyModelShorthand(parsedPair, appState):
    // Recognized model aliases (via literal table in uAt/ENe):
    //   "fable"     → claude-fable-5 (usage-credits; consent required)
    //   "sonnet"    → current sonnet alias
    //   "haiku"     → current haiku alias
    //   "opus"      → current opus alias
    //   "best"      → best available alias
    //   "opusplan"  → opus plan alias
    //   "[1m]" suffix → 1M-context variant

    if parsedPair.key == "model":
        alias = parsedPair.value
        if alias contains "fable":
            // Check fable consent flag
            if not hasFableConsent(appState):
                emit("config_shorthand_blocked")      // +11616215
                return errorMessage("needs usage-credits consent — run /model first")
            // Else apply fable model

        resolvedModel = resolveModelAlias(alias)      // ENe / $o path
        persistModelToSettings(resolvedModel)
        emit("tengu_config_model_changed")            // +11604338
        return confirmationMessage(resolvedModel)
```

Analysis basis: CC v2.1.197 bundle.js:+11823316, +11604338, +11616193, +11616215

---

### 5. Settings Persistence Layer — `settingsWriter` (`no`) and Atomic File Save (`mRt`, `rtn`)

```
function saveUserSetting(key, value, settingsScope):
    // Scope options detected: "userSettings", "projectSettings",
    //   "localSettings", "policySettings", "flagSettings"
    //                                          (+1350448, +1350563, +1350586)

    targetPath = resolveSettingsPath(scope)
    // Path construction:
    //   global user settings → join(".claude", "settings.json")  (+1330165, +1330175)
    //   local project settings → join(".claude", "settings.local.json") (+1330237)

    currentConfig = readConfigWithLock(targetPath)
    updatedConfig = merge(currentConfig, { [key]: value })

    writeFileSyncAndFlush(targetPath, JSON.stringify(updatedConfig))
    // Atomic write sequence (mRt):
    //   1. Write to temp file with random hex suffix (6 bytes → hex)  (+1107509)
    //   2. Apply original file permissions to temp      (+1108040)
    //   3. fsync temp file descriptor                   (+1108166)
    //   4. Rename temp → target (atomic on POSIX)       (+1108512)
    //   5. On EACCES fallback: report preservation path (+1109468)

    // Lock contention guard (rtn):
    //   Lock acquisition > 100 ms → emit tengu_config_lock_contention  (+14161180)
    //   On stale write detected → emit tengu_config_stale_write        (+14161316)
    //   On parse error in re-read → auto-repair from cache, emit tengu_config_auto_repaired (+14161693)
    //   If auth fields would be lost → refuse write, emit tengu_config_auth_loss_prevented (+14162023)
    //   Fallback path → emit tengu_config_fallback_write               (+14160796)

    invalidateSettingsCache()
    emitSettingChangedEvent(key)
```

Analysis basis: CC v2.1.197 bundle.js:+1330165, +1350448, +14161180

---

### 6. Error Path — `cliErrorReporter` (`MYe`)

```
function reportCliError(message):
    console.error(It.red(message))   // red-colored terminal output  (+13493115)
    writeErrorToLog(message, "cli_error")                             // +13493156
    process.exit(1)                                                   // +13493182
```

Analysis basis: CC v2.1.197 bundle.js:+13493101

---

### 7. Notification Preference Patch — `notifPreferencesPatcher` (`h1f`)

When notification-related settings (`preferredNotifChannel`, `inputNeededNotifEnabled`, `agentPushNotifEnabled`) change, the handler issues an API PATCH call in addition to local persistence:

```
function patchNotifPreferences(prefKey, value, authContext):
    if not authenticated:
        emit("notif_prefs_patch")
        log("no_auth", level="info")                    // +11596921
        return

    response = apiClient.patch("/notification-prefs", { [prefKey]: value })

    if response.ok:
        emit("notif_prefs_patch_ok")                    // +11596949
        log("info")
    else:
        emit("notif_prefs_patch_failed")                // +11597037
        log("http_error")                               // +11597097

    emit("tengu_push_notif_pref_changed")               // +11605114
```

Analysis basis: CC v2.1.197 bundle.js:+11596835, +11596901

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: model | `tengu_config_model_changed` (+11604338) |
| Telemetry: feature flags | `tengu_feature_ok` (+1028779), `tengu_feature_sad` (+1028927), `tengu_feature_bad` (+1028846) |
| Telemetry: notifications | `tengu_push_notif_pref_changed` (+11605114) |
| Telemetry: auto-compact | `tengu_auto_compact_setting_changed` (+11605552) |
| Telemetry: refusal fallback | `tengu_refusal_fallback_setting_changed` (+11605790) |
| Telemetry: tips | `tengu_tips_setting_changed` (+11606021) |
| Telemetry: reduce motion | `tengu_reduce_motion_setting_changed` (+11606319) |
| Telemetry: thinking | `tengu_thinking_toggled` (+11606540) |
| Telemetry: fast mode | `tengu_penguins_off` (+2288643) |
| Telemetry: prompt suggestions | `tengu_chomp_inflection` (+11606981) |
| Telemetry: session recap | `tengu_sedge_lantern` (+11607215) |
| Telemetry: checkpoints | `tengu_file_history_snapshots_setting_changed` (+11607658) |
| Telemetry: checkpoints (SNe) | `tengu_maple_sundial` (+11602184) |
| Telemetry: progress bar | `tengu_terminal_progress_bar_setting_changed` (+11608950) |
| Telemetry: terminal sidebar | `tengu_terminal_sidebar` (+11609017) |
| Telemetry: terminal tab status | `tengu_terminal_tab_status_setting_changed` (+11609265) |
| Telemetry: turn duration | `tengu_show_turn_duration_setting_changed` (+11609489) |
| Telemetry: precompute compaction | `tengu_sepia_moth` (+11609553), `tengu_precompute_compaction_setting_changed` (+11609809) |
| Telemetry: timestamps | `tengu_silk_hinge` (+11609880), `tengu_show_message_timestamps_setting_changed` (+11610124) |
| Telemetry: gitignore | `tengu_respect_gitignore_setting_changed` (+11611815) |
| Telemetry: fullscreen | `tengu_amber_creek` (+3587999), `tengu_pewter_brook` (+3587906) |
| Telemetry: push notif (kairos) | `tengu_kairos_input_needed_push` (+5120139), `tengu_kairos_push_notifications` (+5120076) |
| Telemetry: default view | `tengu_default_view_setting_changed` (+11614710) |
| Telemetry: editor mode | `tengu_editor_mode_changed` (+11615299) |
| Telemetry: external editor ctx | `tengu_external_editor_context_changed` (+11615614) |
| Telemetry: PR status footer | `tengu_pr_status_footer_setting_changed` (+11615928) |
| Telemetry: diff tool | `tengu_diff_tool_changed` (+11616501) |
| Telemetry: IDE auto-connect | `tengu_auto_connect_ide_changed` (+11616773) |
| Telemetry: IDE extension | `tengu_auto_install_ide_extension_changed` (+11617077) |
| Telemetry: Chrome integration | `tengu_claude_in_chrome_setting_changed` (+11617413) |
| Telemetry: agent teams | `tengu_amber_flint` (+7279557) |
| Telemetry: teammate mode | `tengu_teammate_mode_changed` (+11617809) |
| Telemetry: remote control bridge | `tengu_ccr_bridge` (+14143114) |
| Telemetry: auto mode config | `tengu_auto_mode_config` (+14020072) |
| Telemetry: bg workers | `tengu_bg_retire_pinned_low_mem` (+18042075), `tengu_bg_prewarm_per_sweep` (+18042200) |
| Telemetry: daemon | `tengu_daemon_config_reload` (+18054237), `tengu_daemon_idle_exit` (+18059708), `tengu_daemon_yield` (+18058666) |
| Telemetry: config file integrity | `tengu_config_lock_contention` (+14161180), `tengu_config_stale_write` (+14161316), `tengu_config_auto_repaired` (+14161693), `tengu_config_auth_loss_prevented` (+14162023), `tengu_config_fallback_write` (+14160796) |
| Telemetry: cobalt/auto | `tengu_cobalt_plinth` (+5159379) |
| Settings files written | `~/.claude/settings.json` (global user), `.claude/settings.local.json` (local project) |
| appState changes | Active model, thinking mode, verbose flag, permission mode, UI preferences—via `e.setAppState` (+11625148) |
| Notification API | PATCH to remote notifications endpoint when notif prefs change (+11596863) |
| File I/O | Atomic write with fsync + rename via `mRt`; lock file coordination via `rtn` with 60 s timeout (+14162229) |
| Config backup | Up to 5 rolling backups (+14162484), backup prefix `.backup.` (+14162345) |
| Error output | `console.error` with red ANSI color on CLI error path; `process.exit(1)` (+13493182) |
| Sound | None detected |

---

## Version History

| Version | Change |
|---|---|
| v2.1.197 | Initial analysis |

---

## Common Mistakes

1. **Forgetting the `=` separator** in shorthand form: `/config verbose` without a value is not equivalent to `/config verbose=true`; the parser requires `key=value` syntax when applying settings inline.
2. **Using `/config model=fable` without prior `/model` consent**: The command will be blocked with a `config_shorthand_blocked` event and an error message until the usage-credits consent flow is completed via `/model`.
3. **Assuming `/config` immediately persists to disk**: The atomic write path involves a lock, a temp file, fsync, and rename; on heavily loaded systems or when another Claude instance holds the lock, the write may be delayed or fall back to a secondary path.
4. **Confusing `settings.json` vs `settings.local.json`**: Global user preferences go to `~/.claude/settings.json`; project-local overrides go to `.claude/settings.local.json` in the working directory. Editing the wrong file has no effect on the other scope.
5. **Expecting enum options to be case-sensitive**: The handler normalizes keys via `toLowerCase` before dispatch; however, enum values (e.g., `vim`, `emacs`, `normal` for editor mode) are stored as-is and may be compared case-sensitively downstream.
6. **Overlooking the `/theme` and `/model` redirects**: Several settings shown in the panel (theme, output style, specific model IDs for teammates) instruct users to use dedicated slash commands rather than `/config` for full configurability.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `z$f` | Main async handler for `/config` command (entry point) |
| `uAt` | Settings panel component renderer (builds all setting rows) |
| `eXt` | Settings shorthand applier (dispatches key=value pairs) |
| `X$o` | App-state-aware settings controller (reads/writes appState) |
| `QJt` | Key=value pair parser |
| `no` | Settings persistence orchestrator (multi-scope write coordinator) |
| `mRt` | Atomic file writer (temp → fsync → rename) |
| `rtn` | Config-with-lock saver (lock acquisition, stale-write guard, backup rotation) |
| `Hn` | Global config save with fallback (auth-loss prevention) |
| `vdr` | Variant save path (alternate config write) |
| `h1f` | Notification preferences remote patcher |
| `W$o` | Notification preferences coordinator |
| `QUl` | Notification prefs sub-component |
| `ENe` | Model alias resolver / model shorthand handler |
| `$o` | Model name normalization and tier mapping |
| `SZ` | Settings schema builder |
| `ab` | Settings schema entry constructor |
| `V9t` | Settings variant/tier descriptor |
| `P3` | Settings group builder (groups rows into sections) |
| `Ao` | Section header component |
| `Xbn` | Section body / row list renderer |
| `SH` | Row renderer combining label + control |
| `ig` | Toggle/boolean control renderer |
| `eV` | Enum control renderer |
| `y2` | Model-picker sub-component |
| `QEe` | Model availability checker |
| `bde` | Model display descriptor |
| `mh` | Control label formatter |
| `dT` | Setting row descriptor factory |
| `JHe` | Row descriptor (boolean type) |
| `QHe` | Row descriptor (enum/pro type) |
| `Hr` | Base row descriptor constructor |
| `Mi` | Composite row descriptor |
| `Iw` | Settings writer (wraps `no`) |
| `L` | Away-summary / session state manager |
| `vze` | State store accessor (getState) |
| `yKt` | Local workflow state tracker |
| `IRe` | Loop-wakeup guard |
| `pRm` | Away-summary parameter loader |
| `YOc` | Away-summary last-message accessor |
| `JOc` | Away-summary message builder |
| `HGt` | Away-summary generation trigger |
| `rmc` | Random UUID generator for session IDs |
| `w` | Session wakeup / focus transition handler |
| `MYe` | CLI error reporter (console.error + process.exit) |
| `dI` | Error log file writer |
| `vs` | CLI error dispatcher |
| `OMr` | Settings cache timestamp updater |
| `VBe` | Settings validator |
| `Me` | JSON serializer wrapper |
| `n_` | Settings cache invalidator |
| `zvs` | Gitignore / file tracking handler |
| `Q5` | Settings path resolver (joins `.claude` + filename) |
| `dr` | Settings disk reader |
| `xe` | Feature flag reader (ok path) |
| `wt` | Feature flag reader (sad path) |
| `Re` | Feature flag reader (bad path) |
| `O8` | Settings load-from-disk orchestrator |
| `ke` | Settings error logger |
| `Tae` | Settings panel title component |
| `I` | Scroll/layout input handler |
| `M` | OAuth / API gateway handler (large shared module) |
| `A` | OAuth userinfo fetcher |
| `x` | Cookie/session token splitter |
| `R` | File watcher / interval manager |
| `O` | Background worker sweep manager |
| `Lg` | Config directory resolver |
| `LDr` | Project config loader |
| `I3` | Config schema definitions |
| `nw` | Config watcher setup |
| `Sn` | ENOENT handler |
| `T` | Log-level / debug utility |
| `Fn` | Key alias resolver |
| `n$l` | Settings list filter / search |
| `Yle` | Setting row base component |
| `U$o` | Setting key includes-check (first variant) |
| `$$o` | Setting key includes-check (second variant) |
| `Fa` | Free-text / language input control |
| `ll` | Checkbox / toggle control |
| `l1p` | Toggle animation component |
| `IHo` | Inline help overlay |
| `CHo` | Help text component |
| `Ozt` | Output style picker |
| `drr` | Teammate default model picker |
| `Nzt` | Teammate model display |
| `Mv` | Remote control / CCR bridge handler |
| `_dr` | Remote control state reader |
| `Jen` | Remote control status component |
| `j2` | Remote control toggle control |
| `Bqe` | Remote control confirmation dialog |
| `lme` | Config daemon interface |
| `Cdr` | Config daemon reader |
| `eo` | Module initializer / ESM interop |
| `J$o` | JSON config file path builder |
| `lI` | Config lock file path builder |
| `_F` | API key masker (slices to 20 chars) |
| `cAt` | Config read-and-parse (cached) |
| `pc` | Project config path resolver |
| `iT` | Gitignore rule tracker |
| `Awe` | Config directory absolute resolver |
| `wkn` | Workflow policy writer |
| `t2i` | Workflow allow-list updater |
| `S9t` | Artifact setting handler |
| `wla` | Artifact panel renderer |
| `xla` | Artifact toggle row |
| `y9t` | Artifact display helper |
| `ANe` | Auto-mode config writer |
| `Z5` | Auto-mode enum descriptor |
| `l7e` | Auto-mode panel component |
| `AVo` | Auto-mode row renderer |
| `Hde` | Input-needed push setting handler |
| `zi` | Telemetry network filter |
| `qbs` | Network filter descriptor |
| `zS` | Settings section divider |
| `aje` | IDE connection status checker |
| `LAe` | Auto-updater settings handler |
| `Ket` | Auto-update channel descriptor |
| `cx` | Fullscreen mode detector |
| `Fit` | Fullscreen availability resolver |
| `C1e` | Fullscreen setting row |
| `_a` | Fullscreen state accessor |
| `fc` | Safe-mode / bare-mode flag reader |
| `kl` | Safe-mode flag descriptor |
| `yd` | Bare-mode flag descriptor |
| `U6` | Config key prefix stripper |
| `V$o` | Config value validator |
| `NUn` | Input-needed push notif row |
| `she` | Settings search/filter input |
| `Oe` | Settings panel footer |
| `Ltt` | Notification channel label formatter |
| `QL` | Notification channel options builder |
| `Hgn` | Notification channel descriptor |
| `pN` | Bubble notification checker |
| `_Wt` | Permission mode settings handler |
| `Lj` | Permission mode option builder |
| `CVo` | Permission mode descriptor |
| `s3` | Permission mode current value reader |
| `mIe` | Permission mode display mapper |
| `$s` | Fullscreen / display mode compositor |
| `DP` | Local-agent mode checker |
| `aD` | Background mode checker |
| `oXr` | Display mode control renderer |
| `qne` | Display mode descriptor builder |
| `rXr` | Display mode value coercer |
| `Rr` | Settings-load trigger |
| `S4d` | Settings-save trigger (it path) |
| `SNe` | Checkpoint/snapshot setting handler |
| `CYr` | File checkpoint setting row |
| `vYr` | File checkpoint descriptor |
| `jUn` | Function/feature flag applicator |
| `fn` | Feature flag registry reader |
| `E9t` | Feature flag display component |
| `lAt` | Snapshot feature setting |
| `Hn` | Global config save with auth-loss prevention |
| `rtn` | Locked config save with backup rotation |
| `pqo` | Config entry iterator |
| `ttn` | Config save timestamp |
| `etn` | Config entry type checker |
| `cIt` | Config integrity checker |
| `vdr` | Config fallback write path |
| `j` | Daemon write queue |
| `P` | Daemon write processor |
| `d` | Daemon transport writer |
| `U` | Rate-limit event dispatcher |
| `AYl` | Rate-limit descriptor |
| `HF` | Rate-limit notifier |
| `D` | Daemon enqueue writer |
| `Rt` | Daemon response handler |
| `Dt` | Config read (disk + cache merge) |
| `it` | React-style render tracker |
| `C$t` | Render entry constructor |
| `v$t` | Render value wrapper |
| `P6` | Render path descriptor |
| `akn` | Render deduplication tracker |
| `ct` | String converter utility |
| `uc` | Component base renderer |
| `rx` | Row container renderer |
| `Wle` | Setting row full renderer (label + control + hint) |
| `c6` | Hint text component |
| `OLe` | Option list renderer |
| `N3e` | Nested setting descriptor |
| `ll` | Toggle control (duplicate listed) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.