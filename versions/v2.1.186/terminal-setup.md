---
type: feature-spec
feature: "terminal-setup"
cc_version: 2.1.186
updated: "2026-06-19"
tags: ["terminal-setup", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.181
analysis_basis: "CC v2.1.181 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/terminal-setup`

> Analysis basis: CC v2.1.181 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.181

---

## Overview

`/terminal-setup` installs terminal key bindings and settings that make Claude Code's newline input workflow more ergonomic, specifically mapping **Shift+Enter** (or Option+Enter on macOS Apple Terminal) to emit a newline sequence. The command auto-detects the running terminal emulator and applies the appropriate configuration changes for each supported environment — Apple Terminal (via `com.apple.Terminal.plist`), iTerm2 (clipboard access setting), VSCode/Cursor/Windsurf integrated terminals (via `keybindings.json`/`settings.json`), Alacritty (via `alacritty.toml`), and Zed (via `keymap.json`).

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `terminal-setup` |
| description | `Install Shift+Enter key binding for newlines` |
| module_id | `Jwi` |
| load_inline | `true` |
| loc_byte | `12618096` |
| loc_byte_end | `12618728` |
| loc_line | `8257` |
| arbor_handler.name | `gdd` |
| arbor_handler.fqn | `claude-2.1.181::gdd` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.181 bundle.js:+12618096

---

## Input Branching

The command supports 6+ distinct terminal detection paths and multiple sub-actions per path, warranting a Mermaid flowchart.

```mermaid
flowchart TD
    A["/terminal-setup invoked"] --> B{Check RZ.platform}
    B -->|darwin| C{Detect terminal emulator}
    B -->|other OS| D[No macOS-specific steps; proceed to editor detection]

    C -->|TERM_PROGRAM=Apple_Terminal| E[Apple Terminal path: modify com.apple.Terminal.plist]
    C -->|TERM_PROGRAM=screen / iTerm.app detected| F[iTerm2 path: enable clipboard access via defaults write]
    C -->|TERM_PROGRAM=vscode / detected as vscode-server family| G[VSCode/Cursor/Windsurf path]
    C -->|TERM_PROGRAM=alacritty| H[Alacritty path: modify alacritty.toml]
    C -->|TERM_PROGRAM=zed| I[Zed path: modify keymap.json]
    C -->|other / unrecognized| J[Print informational note about natively-supported terminals]

    E --> E1{Backup plist}
    E1 -->|backup fails| E2[Abort: "Failed to create backup…"]
    E1 -->|backup ok| E3[Read default & startup profile via 'defaults export com.apple.Terminal']
    E3 --> E4{Profile read ok?}
    E4 -->|no| E5[Error: "Failed to read default/startup Terminal.app profile"]
    E4 -->|yes| E6[Apply PlistBuddy commands: Option-as-Meta key + visual bell]
    E6 --> E7{Any profile succeeded?}
    E7 -->|none succeeded| E8[Error: "Failed to enable Option as Meta key or disable audio bell…"]
    E7 -->|at least one| E9[killall cfprefsd to flush prefs cache]
    E9 --> E10[Display success: Shift+Return / Option+Enter note + restart prompt]

    F --> F1{AllowClipboardAccess already set?}
    F1 -->|yes| F2["iTerm2 clipboard access already enabled" — no-op]
    F1 -->|no| F3[defaults write com.googlecode.iterm2 AllowClipboardAccess -bool true]
    F3 --> F4{Write ok?}
    F4 -->|fail| F5["Couldn't update iTerm2 clipboard setting."]
    F4 -->|ok| F6[Display: "Enabled Applications in terminal may access clipboard in iTerm2" + restart note]

    G --> G1{Remote SSH / GPU-accel detection}
    G1 --> G2[Locate keybindings.json; create if missing]
    G2 --> G3{Backup keybindings.json}
    G3 -->|backup fails| G4[status: backup_failed]
    G3 -->|ok| G5[Inject shift+enter → workbench.action.terminal.sendSequence ESC+CR with terminalFocus when-clause]
    G5 --> G6[Locate settings.json; create if missing]
    G6 --> G7[Inject terminal_setup_gpu_accel setting if applicable]
    G7 --> G8[Display success]

    H --> H1{Find alacritty.toml path: ~/.config/alacritty.toml etc.}
    H1 -->|not found| H2[Error: "No valid config path found for Alacritty"]
    H1 -->|found| H3{Binding already present? check 'mods = "Shift"' + 'key = "Return"'}
    H3 -->|yes| H4["Alacritty Shift+Enter key binding already configured" — no-op]
    H3 -->|no| H5{Backup toml}
    H5 -->|backup fails| H6[Error: "Error backing up existing Alacritty config. Bailing out."]
    H5 -->|ok| H7[Append/merge Shift+Return binding]
    H7 --> H8{Write ok?}
    H8 -->|fail| H9[Error: "Failed to install Alacritty Shift+Enter key binding"]
    H8 -->|ok| H10["Installed Alacritty Shift+Enter key binding" + restart note]

    I --> I1{Find keymap.json path under homedir}
    I1 --> I2{Binding 'shift-enter' already present?}
    I2 -->|yes| I3["Zed Shift+Enter key binding already configured" — no-op]
    I2 -->|no| I4{Backup keymap.json}
    I4 -->|backup fails| I5[Error: "Error backing up existing Zed keymap. Bailing out."]
    I4 -->|ok| I6[Inject Terminal/terminal::SendText binding for shift-enter]
    I6 --> I7{Write ok?}
    I7 -->|fail| I8[Error: "Failed to install Zed Shift+Enter key binding"]
    I7 -->|ok| I9["Installed Zed Shift+Enter key binding"]

    J --> J1["Note: iTerm2, WezTerm, Ghostty, Kitty, Warp, and Windows Terminal support Shift+Enter natively."]
```

---

## Behavioral Spec

### Top-level Handler (`gdd`)

The async handler `gdd` is the entry point resolved via module `Jwi`.

```
async function terminalSetupHandler(context):
    platform = getPlatform()          // RZ.platform — bundle.js:+4132184

    terminalName = detectTerminalName(platform)   // Xwi — bundle.js:+4132380

    if platform == "darwin":
        case terminalName:
            "Apple_Terminal" → appleTerminalSetup()       // _dd — via uSn
            "iTerm.app" / "screen" → iterm2Setup()        // Xwi — bundle.js:+4131219
            "vscode" family → vscodeSetup()               // VBr or qBr or aSn
            "alacritty" → alacrittySetup()                // ydd
            "zed" → zedSetup()                            // Edd
            else → printNativeSupport note

    displaySummaryLines(collectedMessages)         // p.join — bundle.js:+4140858
    markOnboardingProjectComplete()               // qZe — bundle.js:+4131140
```

Analysis basis: CC v2.1.181 bundle.js:+4132184

---

### Terminal Emulator Detection (`Xwi`)

```
function detectTerminalEmulator(platform):
    // Reads TERM_PROGRAM and process ancestry, checks SSH env vars
    // Checks for .vscode-server, .cursor-server, .windsurf-server, .devin-server in HOME
    // bundle.js:+4131176

    run: Un(...)         // execute subprocess to read env
    trim result

    if result includes known identifier:
        return terminal name string
    else:
        return "your current terminal"    // bundle.js:+4132757
```

Supported terminal identifier strings checked (literals from bundle):

| Terminal | Identifier / env value |
|---|---|
| Apple Terminal | `Apple_Terminal` (bundle.js:+4130196) |
| VSCode | `vscode` (bundle.js:+4130228) |
| Cursor | `cursor` / `.cursor-server` (bundle.js:+4130252, +4129716) |
| Windsurf | `windsurf` / `.windsurf-server` (bundle.js:+4130276, +4129746) |
| Alacritty | `alacritty` (bundle.js:+4130302) |
| Zed | `zed` (bundle.js:+4130329) |

Analysis basis: CC v2.1.181 bundle.js:+4131176

---

### macOS Platform Check (`l$e`)

```
function checkMacOSPlatform():
    return RZ.platform() == "darwin"    // bundle.js:+4130156
```

Analysis basis: CC v2.1.181 bundle.js:+4130156

---

### Apple Terminal Setup (`_dd`)

```
async function appleTerminalSetup():
    // 1. Export current plist for backup via:
    //    "defaults export com.apple.Terminal <tempfile>"  bundle.js:+4127040–4127061
    backup = Wwi(plistPath)          // obtain backup — bundle.js:+4139801

    if backup failed:
        throw Error("Failed to create backup of Terminal.app preferences, bailing out")
        // bundle.js:+4139847

    // 2. Read default window profile name
    defaultProfile = Un("read", "Default Window Settings")   // bundle.js:+4139942,+4139985
    if defaultProfile.trim() fails:
        throw Error("Failed to read default Terminal.app profile")  // bundle.js:+4140045

    // 3. Read startup window profile name
    startupProfile = Un("read", "Startup Window Settings")   // bundle.js:+4140162
    if startupProfile.trim() fails:
        throw Error("Failed to read startup Terminal.app profile")  // bundle.js:+4140222

    // 4. Apply PlistBuddy commands via Vwi and Kwi for each profile
    //    - Enable "Use Option as Meta key"
    //    - Disable audio bell (switch to visual bell)
    successCount = 0
    for each profile in [defaultProfile, startupProfile]:
        result = applyPlistBuddyCommands(profile)    // Vwi — bundle.js:+4140302
                                                     // Kwi — bundle.js:+4140317
        if result ok: successCount++

    if successCount == 0:
        throw Error("Failed to enable Option as Meta key or disable audio bell…")
        // bundle.js:+4140432

    // 5. Flush macOS preferences daemon
    run("killall", "cfprefsd")   // bundle.js:+4140531,+4140542

    // 6. Collect success messages
    push("Configured Terminal.app settings:")                   // bundle.js:+4140584
    push("- Enabled \"Use Option as Meta key\"")               // bundle.js:+4140651
    push("- Switched to visual bell")                           // bundle.js:+4140713
    push("Shift+Return will now enter a newline.")              // bundle.js:+4140758
    push("Option+Enter will now enter a newline.")              // bundle.js:+4140807
    push("You must restart Terminal.app for changes to take effect.")  // bundle.js:+4140892
```

Analysis basis: CC v2.1.181 bundle.js:+4139801

---

### PlistBuddy Command Execution (`Vwi`, `Kwi`)

```
function applyPlistBuddyForProfile(plistPath, profileName):
    // Invokes /usr/libexec/PlistBuddy with -c flags   bundle.js:+4139074,+4139101
    // Sets UseOptionAsMetaKey = true
    // Sets VisualBell = true, AudibleBell = false
    exec("/usr/libexec/PlistBuddy", ["-c", command, plistPath])
    return success / failure
```

Analysis basis: CC v2.1.181 bundle.js:+4139074

---

### plist Path Resolution (`KZe`)

```
function getPlistPath():
    return path.join(
        os.homedir(),          // Gwi.homedir — bundle.js:+4126903
        "Library",             // bundle.js:+4126917
        "Preferences",         // bundle.js:+4126927
        "com.apple.Terminal.plist"   // bundle.js:+4126941
    )
```

Analysis basis: CC v2.1.181 bundle.js:+4126894

---

### Plist Backup via `defaults export` (`Wwi`)

```
async function backupAndExportTerminalPlist(plistPath):
    // Run: defaults export com.apple.Terminal <tempfile>
    // bundle.js:+4127040–4127061
    run(Un, ["defaults", "export", "com.apple.Terminal", tempPath])
    stat backup file via $Br.stat      // bundle.js:+4127117
    if stat fails: return failure
    run mdd to finalize backup         // bundle.js:+4127209
```

Analysis basis: CC v2.1.181 bundle.js:+4127037

---

### iTerm2 Setup (`Xwi` clipboard branch)

```
async function iterm2Setup():
    domain = "com.googlecode.iterm2"             // bundle.js:+4131241
    key = "AllowClipboardAccess"                  // bundle.js:+4131265

    current = run("defaults", "read", domain, key).trim()
    if current indicates already enabled:
        display("iTerm2 clipboard access already enabled")   // bundle.js:+4131340
        return

    result = run("defaults", "write", domain, key, "-bool", "true")
    // bundle.js:+4131428, +4131483

    if result fails:
        display("Couldn't update iTerm2 clipboard setting.")    // bundle.js:+4131534
        return

    display("Enabled \"Applications in terminal may access clipboard\" in iTerm2")
    // bundle.js:+4131625
    display("Restart iTerm2 for this to take effect. Undo: defaults write … -bool false")
    // bundle.js:+4131708
```

Analysis basis: CC v2.1.181 bundle.js:+4131219

---

### VSCode-family Setup (`VBr` — keybindings, `qBr` — settings, `aSn` — GPU/SSH variant)

```
async function vscodeKeybindingsSetup(terminalLabel):
    // terminalLabel is one of: "VSCode", "Cursor", "Devin Desktop"
    // bundle.js:+4137046, +4130546, +4130641

    // Detect remote SSH or vscode-server variants
    isRemote = cSn(env)   // checks .vscode-server / .cursor-server etc.

    keybindingsPath = path.join(configBase, "keybindings.json")  // bundle.js:+4137728

    mkdir(keybindingsDir)
    content = readFile(keybindingsPath) or default "[]"           // bundle.js:+4137801

    parsed = kSt(content)    // parse JSON with tolerance
    backup via zZe.randomBytes + Yv.copyFile                      // bundle.js:+4137919,+4137982

    // Construct keybinding entry:
    //   key:     "shift+enter"                                    // bundle.js:+4138187
    //   command: "workbench.action.terminal.sendSequence"         // bundle.js:+4138209
    //   args:    { text: "\u001b\r" }                             // bundle.js:+4138261
    //   when:    "terminalFocus"                                  // bundle.js:+4138276
    entry = buildKeybindingEntry()

    merge or append entry into parsed array via XZo
    write result to keybindingsPath                               // bundle.js:+4138687

    display success

async function vscodeSettingsSetup():
    settingsPath = path.join(configBase, "settings.json")         // bundle.js:+4134405
    content = readFile(settingsPath) or default "{}"              // bundle.js:+4134432

    parsed = kSt(content)
    if not a JSON object: status = "not_json_object"              // bundle.js:+4135827

    backup via zZe.randomBytes + Yv.copyFile
    inject "terminal_setup_gpu_accel" setting                     // bundle.js:+4135571
    if remote_ssh context: adjust setting                         // bundle.js:+4135598

    write result                                                   // bundle.js:+4136516
```

Analysis basis: CC v2.1.181 bundle.js:+4137061

---

### Alacritty Setup (`ydd`)

```
async function alacrittySetup():
    // Determine config path
    candidates = [
        path.join(home, ".config", "alacritty", "alacritty.toml"),   // bundle.js:+4141588
        ...
    ]
    // Platform guard: not win32                                       // bundle.js:+4141648
    configPath = candidates.find(existing) or null

    if not configPath:
        throw Error("No valid config path found for Alacritty")       // bundle.js:+4141897

    content = readFile(configPath)

    // Check if already configured
    if content.includes('mods = "Shift"') and content.includes('key = "Return"'):
        // bundle.js:+4141965, +4141995
        display("Alacritty Shift+Enter key binding already configured")  // bundle.js:+4142038
        return

    // Backup
    backup = copyFile via zZe.randomBytes                              // bundle.js:+4142137,+4142200
    if backup fails:
        throw Error("Error backing up existing Alacritty config. Bailing out.")  // bundle.js:+4142248

    // Append/merge binding and write
    if content.endsWith(...):    // bundle.js:+4142450
        newContent = appendSection(content, alacrittyBindingBlock)
    else:
        newContent = mergeSection(content, alacrittyBindingBlock)

    mkdir(path.dirname(configPath))                                    // bundle.js:+4142396,+4142405
    writeFile(configPath, newContent)                                  // bundle.js:+4142566

    display("Installed Alacritty Shift+Enter key binding")             // bundle.js:+4142622
    display("You may need to restart Alacritty for changes to take effect")  // bundle.js:+4142692
```

Analysis basis: CC v2.1.181 bundle.js:+4141507

---

### Zed Setup (`Edd`)

```
async function zedSetup():
    keymapPath = path.join(home, ..., "keymap.json")   // bundle.js:+4143051

    mkdir(keymapDir)
    content = readFile(keymapPath)

    parsed = JSON.parse(content) via Wt               // bundle.js:+4143607
    if not Array.isArray(parsed): parsed = []

    // Check for existing binding
    if parsed includes entry with "shift-enter":       // bundle.js:+4143217
        display("Zed Shift+Enter key binding already configured")   // bundle.js:+4143257
        return

    // Backup
    backup via zZe.randomBytes + Yv.copyFile           // bundle.js:+4143350,+4143413
    if backup fails:
        throw Error("Error backing up existing Zed keymap. Bailing out.")   // bundle.js:+4143461

    // Inject binding:
    //   context: "Terminal"                           // bundle.js:+4143670
    //   bindings: { "shift-enter": "terminal::SendText" }   // bundle.js:+4143706
    parsed.push(newZedBinding())                       // bundle.js:+4143654

    writeFile(keymapPath, Re(parsed))                  // bundle.js:+4143746,+4143761

    display("Installed Zed Shift+Enter key binding")   // bundle.js:+4143817
```

Analysis basis: CC v2.1.181 bundle.js:+4143001

---

### Backup Utility (`oSn`, `Add`)

```
function backupConfigFile(sourcePath):
    // Checks for existing plist stat via $Br.stat     bundle.js:+4127466
    if source does not exist: return status "no_backup"  // bundle.js:+4127403

    // Import current plist state via Un("import", …)  bundle.js:+4127549,+4127564
    result = attempt import
    if fails: return status "failed"                    // bundle.js:+4127621

    return status "restored"                            // bundle.js:+4127703
```

Analysis basis: CC v2.1.181 bundle.js:+4127377

---

### Onboarding Completion (`qZe`)

After all terminal configuration steps complete, the handler marks an onboarding milestone:

```
function markOnboardingComplete():
    emit event "onboarding_project_complete"   // bundle.js:+4126255
    M_(...)    // update project config
    xe(...)    // notify subscribers
```

Analysis basis: CC v2.1.181 bundle.js:+4131140

---

### Subprocess Execution (`Un` → `Vr`)

```
async function runSubprocess(args, options):
    // Spawns child process with timeout 10 (units inferred as seconds)
    // bundle.js:+1133423 (value: 10)
    // Uses 1,000,000 μs limit for some operations  bundle.js:+1134033
    // Error code "error" → log via ke                bundle.js:+1134468
    // Tracks exit code, stdout, stderr
    return { stdout, stderr, exitCode }
```

Analysis basis: CC v2.1.181 bundle.js:+1133478

---

### Informational Note for Unsupported Terminals

When the detected terminal is not in the supported list, the handler prints:

- `"Note: You can already use backslash (\\) + return to add newlines."` — bundle.js:+4133177
- `"Note: iTerm2, WezTerm, Ghostty, Kitty, Warp, and Windows Terminal support Shift+Enter natively."` — bundle.js:+4133517

Analysis basis: CC v2.1.181 bundle.js:+4132757

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_feature_ok` | Emitted on successful feature gate checks (bundle.js:+1019804) |
| Telemetry: `tengu_feature_bad` | Emitted on feature gate failure (bundle.js:+1019871) |
| Telemetry: `tengu_feature_sad` | Emitted on feature gate partial failure (bundle.js:+1019952) |
| Telemetry: `tengu_config_auth_loss_prevented` | Emitted when a stale-write safety check blocks a config write (bundle.js:+13936136) |
| Telemetry: `tengu_config_lock_contention` | Emitted when config lock acquisition exceeds expected duration (bundle.js:+13939228) |
| Telemetry: `tengu_config_stale_write` | Emitted when stale config write is detected (bundle.js:+13939364) |
| Telemetry: `tengu_config_parse_error` | Emitted when config file cannot be parsed (bundle.js:+13941803) |
| Telemetry: `tengu_config_fallback_write` | Emitted when config write falls back to alternate path (bundle.js:+13938844) |
| Telemetry: `tengu_daemon_control` | Emitted during daemon stop sequences triggered from subprocess management (bundle.js:+17138162) |
| File writes | Modifies `keybindings.json`, `settings.json`, `alacritty.toml`, `keymap.json`, or `com.apple.Terminal.plist` depending on terminal detected |
| Backup files | Creates atomic backups using `crypto.randomBytes` hex suffix before any destructive write (bundle.js:+4137919) |
| macOS `defaults` writes | Executes `defaults write com.googlecode.iterm2 AllowClipboardAccess -bool true` on iTerm2 path |
| macOS `killall cfprefsd` | Flushes macOS preferences cache after Apple Terminal plist modification (bundle.js:+4140531) |
| macOS `PlistBuddy` | Invoked at `/usr/libexec/PlistBuddy` to mutate Terminal.app plist entries (bundle.js:+4139074) |
| appState / onboarding | Sets `onboarding_project_complete` project config flag via `qZe` (bundle.js:+4126255) |
| Sound | None detected |

---

## Version History

| Version | Change |
|---|---|
| v2.1.181 | Initial analysis |

---

## Common Mistakes

1. **Running on an unsupported platform**: The command's macOS-specific paths (Apple Terminal, iTerm2) will only execute when `RZ.platform()` returns `"darwin"`. Running on Linux or Windows will skip those branches entirely; only the VSCode-family editor paths apply cross-platform.
2. **Backup failures treated as hard stops**: For Apple Terminal and Alacritty, a failed backup causes the command to abort rather than proceed. Ensure the relevant config directory is accessible and not locked by another process.
3. **Stale preferences cache on macOS**: Even after successful plist modification, changes may not appear until Terminal.app is restarted. The command issues `killall cfprefsd` automatically, but a manual restart is still required per the displayed message (bundle.js:+4140892).
4. **Already-configured detection**: For Alacritty (`mods = "Shift"` + `key = "Return"` substring check) and Zed (`shift-enter` key scan), the command will silently skip installation if the binding already exists. This may cause confusion if the existing binding is malformed.
5. **VSCode keybinding scope**: The injected `shift+enter` binding uses the `terminalFocus` when-clause (bundle.js:+4138276), meaning it only triggers inside the integrated terminal panel. It will not affect the editor itself.
6. **Remote SSH / vscode-server variants**: The `aSn` path applies additional GPU-acceleration settings (`terminal_setup_gpu_accel`) and `remote_ssh` flags; running this command in a local VS Code window vs. a remote SSH session may produce different `settings.json` mutations.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `gdd` | Main async handler for `/terminal-setup` (arbor_handler, AsyncFunction) |
| `l$e` | macOS platform check helper |
| `uSn` | Top-level terminal setup orchestrator / dispatcher |
| `_dd` | Apple Terminal plist setup implementation |
| `Wwi` | `defaults export` / plist backup orchestrator |
| `KZe` | Plist path resolver (home + Library/Preferences/com.apple.Terminal.plist) |
| `Un` | Subprocess executor (wraps `Vr`) |
| `Vr` | Low-level async process spawner |
| `Mt` | Process result handler |
| `mdd` | Backup file finalizer / stat verifier |
| `un` | Global config save helper |
| `ls` | Logger / status printer |
| `ln` | Low-level log emitter |
| `I` | File read/write utility |
| `xhc` | File read helper with encoding |
| `e` | Random delay / jitter utility |
| `Re` | JSON stringify wrapper |
| `qc` | String path component extractor |
| `nqe` | Config object accessor |
| `Rhc` | Config write-with-lock implementation |
| `ke` | Error logging / reporting helper |
| `Ho` | Error constructor wrapper |
| `rt` | String coercion utility |
| `ta` | Network traffic policy checker |
| `fVc` | Queue shift/push manager |
| `r` | IPC stream / data handler |
| `Ps` | Fatal error handler (console.error + writeFileSync + process.exit) |
| `eje` | Colored error console printer |
| `JT` | CLI error file writer |
| `s` | Set-based subscription/cleanup manager |
| `i` | Stream close/open orchestrator |
| `n` | Stream identity normalizer |
| `Vwi` | PlistBuddy command executor for default profile |
| `Kwi` | PlistBuddy command executor for startup profile |
| `VZe` | Global config reader |
| `$o` | ANSI color / style prefix parser |
| `IIe` | Full ANSI color mapper (all 16 named + hex + ansi256 + rgb) |
| `fz` | Fallback style renderer |
| `p` | Process exit / abort signal group |
| `BT` | Forced-shutdown broadcaster |
| `u` | AbortController-based cancellation manager |
| `xe` | OK feature gate subscriber |
| `Me` | Bad feature gate subscriber |
| `zU` | Daemon control signal router |
| `cG` | Promise race/all process exit coordinator |
| `oSn` | Config-file backup orchestrator (stat + import) |
| `Add` | Backup entry constructor |
| `It` | Config write timestamp recorder |
| `VBr` | VSCode keybindings.json setup |
| `cSn` | Remote server environment detector (.vscode-server etc.) |
| `kSt` | JSON config parser with tolerance |
| `x9` | String slice / prefix stripper |
| `fF` | File URL path builder |
| `zv` | Hyperlink / terminal capability detector |
| `b_` | Terminal environment base detector |
| `XZo` | JSON array edit/merge for keybindings |
| `Bmr` | Array edit applier |
| `GZo` | Array remove/insert editor |
| `Gmr` | Array overlapping-edit detector |
| `ttn` | Substring extractor for JSON edit |
| `qBr` | VSCode settings.json setup |
| `JBr` | Array isArray guard |
| `jmr` | JSON object merge for settings |
| `aSn` | VSCode GPU-accel / remote SSH settings variant |
| `Ut` | Sad feature gate subscriber |
| `j` | Event emitter |
| `$e` | Runtime feature flag lookup |
| `Rht` | Feature flag table root |
| `ydd` | Alacritty config setup |
| `Edd` | Zed keymap.json setup |
| `Wt` | Safe JSON.parse wrapper |
| `qZe` | Onboarding project completion marker |
| `M_` | Project config writer |
| `Fwi` | CLAUDE.md onboarding helper |
| `FBr` | CLAUDE.md path builder |
| `jt` | Path existence checker |
| `KXo` | CLAUDE.md directory reader |
| `II` | Project session config updater |
| `n7n` | Config lock-and-write implementation |
| `gBs` | Config merge utility |
| `w_e` | Config file read with lock |
| `qmt` | Config state notifier |
| `h0o` | Backup directory manager |
| `T` | Scroll/input event handler (UI layer) |
| `g` | Buffer stream chunker |
| `E` | Slice boundary calculator |
| `lSt` | Atomic file write (writeFileSyncAndFlush) |
| `dMe` | Config dirty-flag setter |
| `L8t` | Timestamp recorder |
| `t7n` | Config lock writer (per-project) |
| `QBr` | Backup restore helper |
| `Hdd` | Backup restore action |
| `XBr` | Backup entry for restore flow |
| `zBr` | Backup entry constructor variant A |
| `YBr` | Backup entry constructor variant B |
| `KBr` | Backup entry constructor variant C |
| `Xwi` | iTerm2 clipboard access setup / terminal emulator name detector |
| `sSn` | macOS terminal type string resolver |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.