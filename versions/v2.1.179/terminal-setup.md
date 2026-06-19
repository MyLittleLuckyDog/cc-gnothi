---
type: feature-spec
feature: "terminal-setup"
cc_version: 2.1.179
updated: "2026-06-16"
tags: ["terminal-setup", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.178
analysis_basis: "CC v2.1.178 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/terminal-setup`

> Analysis basis: CC v2.1.178 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.178

---

## Overview

`/terminal-setup` is a local JSX command that configures the user's terminal emulator to support `Shift+Enter` as a newline input key binding. It detects the active terminal environment (platform, emulator type), then applies the appropriate configuration change — modifying preferences files, keybinding JSON files, or system preference stores — so that Claude Code can receive multi-line input without submitting the current prompt.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `terminal-setup` |
| description | `Install Shift+Enter key binding for newlines` |
| loc_byte | `12765001` |
| loc_byte_end | `12765633` |
| loc_line | `8770` |
| module_id | `e29` |
| load_inline | `true` |
| arbor_handler.name | `NK7` |
| arbor_handler.fqn | `claude-2.1.178::NK7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.178 bundle.js:+12765001 – +12765633

---

## Input Branching

The command has 5+ distinct terminal-target branches, requiring a Mermaid flowchart.

```mermaid
flowchart TD
    START(["/terminal-setup invoked"]) --> PLATFORM{Detect platform\nke.platform}

    PLATFORM -->|"not darwin"| WIN32{Is win32?}
    WIN32 -->|yes| UNSUPPORTED[Display native-support note\nfor Windows Terminal]
    WIN32 -->|no| LINUX_DETECT{Detect terminal\nenvironment}
    LINUX_DETECT -->|vscode/cursor/windsurf server detected| VSCODE_FLOW[VSCode-family keybindings.json path]
    LINUX_DETECT -->|other / unknown| NATIVE_NOTE[Display Shift+Enter native-support note]

    PLATFORM -->|"darwin"| TERMINAL_DETECT{Detect active\nmacOS terminal\nt29 / CRH}

    TERMINAL_DETECT -->|"Apple_Terminal"| APPLE_TERMINAL[Terminal.app plist path\nn29 / yK7]
    TERMINAL_DETECT -->|"vscode / cursor / windsurf"| VSCODE_FLOW
    TERMINAL_DETECT -->|"alacritty"| ALACRITTY_FLOW[alacritty.toml path\nkK7]
    TERMINAL_DETECT -->|"zed"| ZED_FLOW[keymap.json path\nIK7]
    TERMINAL_DETECT -->|"iTerm.app / screen"| ITERM_FLOW[iTerm2 clipboard + note\nt29 / LD8]
    TERMINAL_DETECT -->|"unknown / other"| GENERIC_NOTE[Display generic note]

    VSCODE_FLOW --> VSCODE_READ[Read keybindings.json\ndefault '[]'\ndb_ / Qb_ / $D8]
    VSCODE_READ --> VSCODE_CHECK{shift+enter binding\nalready present?}
    VSCODE_CHECK -->|yes| ALREADY_DONE[Report already configured]
    VSCODE_CHECK -->|no| VSCODE_BACKUP[Backup + write new binding\nMeH.randomBytes + nW.copyFile]
    VSCODE_BACKUP --> VSCODE_WRITE[Write updated keybindings.json\nnW.writeFile]
    VSCODE_WRITE --> SUCCESS_VSCODE[Report success\nN / String]

    APPLE_TERMINAL --> AT_BACKUP[Read plist, create backup\nyK7 / g8]
    AT_BACKUP --> AT_BACKUP_CHECK{Backup created\nsuccessfully?}
    AT_BACKUP_CHECK -->|no| AT_BAIL[Error: failed to backup\nbail out]
    AT_BACKUP_CHECK -->|yes| AT_PROFILES[Enumerate Default + Startup profiles\nr29 / o29]
    AT_PROFILES --> AT_PLIST[Run PlistBuddy commands\nn29 / ZK7 / W8]
    AT_PLIST --> AT_CHECK{Any profile\nconfigured?}
    AT_CHECK -->|no| AT_FAIL[Error: failed to enable\nfor any profile]
    AT_CHECK -->|yes| AT_KILL[killall cfprefsd\ng8 / feH]
    AT_KILL --> AT_RESULT[Report: Shift+Return / Option+Enter\nrestart required\nyK7]

    ALACRITTY_FLOW --> ALAC_PATH[Resolve config path\nhome/.config/alacritty.toml\nkK7]
    ALAC_PATH --> ALAC_EXISTS{Config exists?}
    ALAC_EXISTS -->|no path found| ALAC_ERROR[Error: no valid config path]
    ALAC_EXISTS -->|yes| ALAC_CHECK{Shift+Enter already\nin config?}
    ALAC_CHECK -->|yes| ALAC_SKIP[Report already configured]
    ALAC_CHECK -->|no| ALAC_BACKUP[Backup + append binding\nnW.copyFile + nW.writeFile]
    ALAC_BACKUP --> ALAC_SUCCESS[Report installed\nrestart note]

    ZED_FLOW --> ZED_PATH[Resolve ~/.zed/keymap.json\nIK7]
    ZED_PATH --> ZED_READ[Read or create keymap\nnW.readFile / nW.mkdir]
    ZED_READ --> ZED_CHECK{shift-enter already\nin keymap?}
    ZED_CHECK -->|yes| ZED_SKIP[Report already configured]
    ZED_CHECK -->|no| ZED_BACKUP[Backup + insert binding\nnW.copyFile + nW.writeFile]
    ZED_BACKUP --> ZED_SUCCESS[Report installed\nIK7 / N]

    ITERM_FLOW --> ITERM_CLIPBOARD[Enable iTerm2 clipboard access\ndefaults write com.googlecode.iterm2\nt29 / LD8]
    ITERM_CLIPBOARD --> ITERM_NOTE[Display Shift+Enter native-support note]
```

Analysis basis: CC v2.1.178 bundle.js:+4130339 (platform detection), +4128311 (terminal-type detection), +4131814 (handler dispatch to per-terminal routines)

---

## Behavioral Spec

### Main Handler (asyncTerminalSetup / NK7)

The Arbor-resolved handler is `NK7` (AsyncFunction), reached via `module_id` resolution from module `e29`.

```
async function asyncTerminalSetup(context):
    platform = detectPlatform()               // ke.platform  @ +4130339

    terminalType = detectActiveTerminal(platform)  // t29 / CRH @ +4130535

    if terminalType is "iterm" or "screen":
        runITermSetup()                        // LD8 @ +4130666
        displayNativeSupportNote()             // H  @ +4130681
        return

    if terminalType is unknown / generic:
        displayGenericNote()                   // CRH / a6 @ +4130886, +4130938
        return

    // Platform-specific dispatch
    results = dispatchTerminalConfig(platform, terminalType)  // YD8 @ +4131814

    displayResults(results)                    // J6.dim @ +4131180
```

Analysis basis: CC v2.1.178 bundle.js:+4130339

---

### Terminal Detection (detectActiveTerminal / t29)

```
function detectActiveTerminal(platform):
    // Reads environment variables and process ancestry
    // to identify the enclosing terminal emulator
    emitter = runSubprocess()              // g8 @ +4129374
    rawOutput = emitter.trim()            // A.trim @ +4129455
    styled = applyColorStyling(rawOutput) // mA @ +4129479

    if platform == "darwin":
        // Checks TERM_PROGRAM, process name, known identifiers:
        //   "Apple_Terminal", "vscode", "cursor", "windsurf",
        //   "alacritty", "zed", "iTerm.app", "screen"
        ...

    emit telemetry on outcome              // RH @ +4130010
    return terminalIdentifier
```

Analysis basis: CC v2.1.178 bundle.js:+4129331

Detected terminal identifiers (literals):
- `"Apple_Terminal"` (+4128351)
- `"vscode"` (+4128383)
- `"cursor"` (+4128407)
- `"windsurf"` (+4128431)
- `"alacritty"` (+4128457)
- `"zed"` (+4128484)
- `"iTerm.app"` (+4130440)
- `"screen"` (+4130489)

---

### Apple Terminal.app Configuration (appleTerminalSetup / yK7 + n29)

The setup flow for Apple Terminal consists of two phases: backup (via `n29`) and profile modification (via `yK7`).

**Backup phase (configReaderAppleTerminal / n29):**

```
async function configReaderAppleTerminal():
    prefPath = path.join(homedir(), "Library", "Preferences",
                         "com.apple.Terminal.plist")
    // @ +4125072, +4125082, +4125096

    // Export current plist to temp path via:
    //   defaults export com.apple.Terminal <tmpfile>
    // @ +4125195, +4125207, +4125216

    runSubprocess("defaults", "export", "com.apple.Terminal", tmpPath)
    // g8 @ +4125192

    backupResult = createBackup(tmpPath)   // ZK7 @ +4125364

    if backup failed:
        throw Error("Failed to create backup of Terminal.app preferences, bailing out")
        // @ +4138002

    return { prefPath, backupPath }
```

Analysis basis: CC v2.1.178 bundle.js:+4125151

**Profile modification phase (appleTerminalModify / yK7):**

```
async function appleTerminalModify(prefPath, backupPath):
    // Read default profile name
    defaultProfile = plistRead("Default Window Settings")
    // @ +4138140

    if read fails:
        throw Error("Failed to read default Terminal.app profile")
        // @ +4138200

    startupProfile = plistRead("Startup Window Settings")
    // @ +4138317

    if read fails:
        throw Error("Failed to read startup Terminal.app profile")
        // @ +4138377

    // For each profile in {defaultProfile, startupProfile}:
    //   Run PlistBuddy to enable "Use Option as Meta key"
    //   Run PlistBuddy to disable audio bell (switch to visual bell)
    //   @ PlistBuddy path: "/usr/libexec/PlistBuddy" @ +4137229
    //   Command flag "-c" @ +4137256

    profilesConfigured = 0
    for profile in [defaultProfile, startupProfile]:
        result = runPlistBuddy(profile, prefPath)   // r29 / o29 @ +4138457, +4138472
        if result.success:
            profilesConfigured++

    if profilesConfigured == 0:
        throw Error("Failed to enable Option as Meta key or disable audio bell for any Terminal.app profile")
        // @ +4138587

    // Flush preferences cache
    runSubprocess("killall", "cfprefsd")    // @ +4138686, +4138697
    // feH @ +4138710

    displayResults([
        "Configured Terminal.app settings:",   // @ +4138739
        "- Enabled \"Use Option as Meta key\"", // @ +4138806
        "- Switched to visual bell",            // @ +4138868
        "Shift+Return will now enter a newline.", // @ +4138913
        "Option+Enter will now enter a newline.", // @ +4138962
        "You must restart Terminal.app for changes to take effect." // @ +4139047
    ])
```

Analysis basis: CC v2.1.178 bundle.js:+4137956

**Error note:** If `Option as Meta key` could not be set but the command completes, a separate error line is emitted:
> "Failed to enable Option as Meta key for Terminal.app." (+4139234)

---

### VSCode-Family Configuration (vscodeSetup / db_ / Qb_ / $D8)

Three handler variants are present for VSCode-family terminals, distinguished by environment detection:
- `db_` — standard VSCode (`keybindings.json`) (+4128604)
- `Qb_` — Cursor/Windsurf remote-server variant (`settings.json` path) (+4128629)
- `$D8` — VSCode with GPU acceleration / remote-SSH context (`terminal_setup_gpu_accel`, `remote_ssh`) (+4128654)

```
async function vscodeKeybindingSetup(variant):
    // Detect remote-server paths from HOME:
    //   ".vscode-server", ".cursor-server",
    //   ".windsurf-server", ".devin-server"  @ +4127841..+4127933

    if variant is "VSCode":                    // @ +4135201
        configFile = "keybindings.json"        // @ +4135893
        defaultContent = "[]"                  // @ +4135956
    else:
        configFile = "settings.json"           // @ +4132560
        defaultContent = "{}"                  // @ +4132587

    configPath = path.join(configDir, configFile)

    nW.mkdir(configDir, {recursive: true})
    rawContent = nW.readFile(configPath) ?? defaultContent

    parsed = JSON.parse(rawContent)            // dD6 @ +4136024

    // Check for existing shift+enter binding
    existing = parsed.find(entry =>
        entry includes "shift+enter"           // @ +4136342
    )
    if existing:
        report("already configured")
        return

    // Generate random backup suffix
    backupSuffix = MeH.randomBytes(4).toString("hex")  // @ +4136074, +4136090, +4136102
    nW.copyFile(configPath, configPath + ".backup." + backupSuffix)

    // Build new binding entry:
    newBinding = {
        key: "shift+enter",                    // @ +4136342
        command: "workbench.action.terminal.sendSequence",  // @ +4136364
        args: { text: "\x1b\r" },              // ESC+CR sequence @ +4136416
        when: "terminalFocus"                  // @ +4136431
    }
    parsed.push(newBinding)

    nW.writeFile(configPath, JSON.stringify(parsed, null, 4))

    reportSuccess("Configured")                // N / String @ +4137001, +4137091
```

Analysis basis: CC v2.1.178 bundle.js:+4136024

The key sequence written is `\x1b\r` (ESC + carriage return), which terminals interpret as a newline in the input buffer without submitting.

---

### Alacritty Configuration (alacrittySetup / kK7)

```
async function alacrittySetup():
    // Candidate paths for alacritty.toml:
    //   $HOME/.config/alacritty/alacritty.toml (non-win32)  @ +4139691, +4139743
    //   Platform win32 path variant                           @ +4139803

    platform = ke.platform()    // @ +4139787
    homedir  = ke.homedir()     // @ +4139730

    configPath = resolveAlacrittyPath(homedir, platform)

    if no valid path found:
        throw Error("No valid config path found for Alacritty")  // @ +4140052

    content = nW.readFile(configPath)

    // Check if already configured — looks for both:
    //   'mods = "Shift"'   @ +4140120
    //   'key = "Return"'   @ +4140150
    if content includes both markers:
        report("Alacritty Shift+Enter key binding already configured")  // @ +4140193
        return

    backupSuffix = MeH.randomBytes(4).toString("hex")
    nW.copyFile(configPath, backupPath)

    if backup fails:
        throw Error("Error backing up existing Alacritty config. Bailing out.")  // @ +4140403

    // Append TOML binding block to config
    nW.mkdir(path.dirname(configPath), {recursive: true})   // @ +4140551
    nW.writeFile(configPath, updatedContent)                 // @ +4140721

    report("Installed Alacritty Shift+Enter key binding")   // @ +4140777
    report("You may need to restart Alacritty for changes to take effect")  // @ +4140847
```

Analysis basis: CC v2.1.178 bundle.js:+4139662

On failure after this point:
> "Failed to install Alacritty Shift+Enter key binding" (+4141072)

---

### Zed Configuration (zedSetup / IK7)

```
async function zedSetup():
    keymapPath = path.join(ke.homedir(), ".zed", "keymap.json")  // @ +4141156, +4141164, +4141206

    nW.mkdir(path.dirname(keymapPath), {recursive: true})        // @ +4141231

    rawContent = nW.readFile(keymapPath) ?? "[]"
    parsed = JSON.parse(rawContent)    // i6 @ +4141762

    if not Array.isArray(parsed):
        parsed = []

    // Check for existing "shift-enter" binding
    if parsed.includes entry with key "shift-enter":             // @ +4141361, +4141372
        report("Zed Shift+Enter key binding already configured") // @ +4141412
        return

    backupSuffix = MeH.randomBytes(4).toString("hex")
    nW.copyFile(keymapPath, backupPath)

    if backup fails:
        throw Error("Error backing up existing Zed keymap. Bailing out.")  // @ +4141616

    // Insert new binding:
    newBinding = {
        context: "Terminal",                  // @ +4141825
        bindings: {
            "shift-enter": "terminal::SendText"  // @ +4141861, +4141372
        }
    }
    parsed.push(newBinding)

    nW.writeFile(keymapPath, xH(parsed))   // JSON.stringify @ +4141901, +4141916

    report("Installed Zed Shift+Enter key binding")       // @ +4141972
```

Analysis basis: CC v2.1.178 bundle.js:+4141156

On failure:
> "Failed to install Zed Shift+Enter key binding" (+4142181)

---

### iTerm2 Setup (iTermSetup / t29 + LD8)

```
async function iTermSetup():
    // Check if clipboard access is already enabled
    current = runSubprocess("defaults", "read",
        "com.googlecode.iterm2", "AllowClipboardAccess")  // @ +4129396, +4129420

    if current indicates enabled:
        report("iTerm2 clipboard access already enabled")  // @ +4129495
    else:
        result = runSubprocess("defaults", "write",        // @ +4129583
            "com.googlecode.iterm2", "AllowClipboardAccess",
            "-bool", "true")                               // @ +4129638

        if write failed:
            report("Couldn't update iTerm2 clipboard setting.")  // @ +4129689
        else:
            report("Enabled \"Applications in terminal may access clipboard\" in iTerm2")
            // @ +4129780
            report("Restart iTerm2 for this to take effect. Undo: defaults write ...")
            // @ +4129863

    // Always display Shift+Enter native support note:
    displayNote("Note: iTerm2, WezTerm, Ghostty, Kitty, Warp, and Windows Terminal support Shift+Enter natively.")
    // @ +4131672
```

Analysis basis: CC v2.1.178 bundle.js:+4129295

---

### Backup and Config-Write Utilities (backupConfig / fD8 + VK7)

```
async function backupConfig(sourcePath, options):
    // Checks for existing backup marker: "no_backup"  @ +4125558
    if options.no_backup:
        return { status: "no_backup" }

    // Run import step to verify readable
    runSubprocess("import")         // @ +4125719

    if import fails:
        return { status: "failed" } // @ +4125776

    // Verify re-read is consistent
    stat = pb_.stat(sourcePath)

    writeConfig(result)              // O1 @ +4125882
    emitTelemetry()                  // N @ +4125888

    if write fails:
        return { status: "failed" }

    return { status: "restored" }   // @ +4125858
```

Analysis basis: CC v2.1.178 bundle.js:+4125532

---

### PlistBuddy Command Runner (runPlistBuddy / n29 → r29 / o29)

```
function runPlistBuddy(profile, prefPath):
    // Executes: /usr/libexec/PlistBuddy -c "<command>" <prefPath>
    // @ +4137229, +4137256

    // "read" command verifies profile existence  @ +4138112
    readResult = subprocess("/usr/libexec/PlistBuddy", ["-c",
                   "Print :<profileName>:...", prefPath])

    // Separate invocations for:
    //   - "Use Option as Meta key"
    //   - audio bell disable (visual bell)
    // r29 handles "Default Window Settings" @ +4138457
    // o29 handles "Startup Window Settings" @ +4138472
    return { success: exitCode == 0 }
```

Analysis basis: CC v2.1.178 bundle.js:+4137226

---

### Notes Displayed for Natively-Supported Terminals

When the detected terminal already supports `Shift+Enter` natively (iTerm2, WezTerm, Ghostty, Kitty, Warp, Windows Terminal), or when `\` + Return is available (macOS generic), the command only displays informational messages:

- "Note: You can already use backslash (\\) + return to add newlines." (+4131332)
- "Note: iTerm2, WezTerm, Ghostty, Kitty, Warp, and Windows Terminal support Shift+Enter natively." (+4131672)

For iTerm2 specifically, macOS detection triggers additional clipboard-access configuration via the `defaults` command.

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_ok` (+1020153), `tengu_feature_bad` (+1020220), `tengu_feature_sad` (+1020301), `tengu_config_auth_loss_prevented` (+3345928), `tengu_config_lock_contention` (+3348912), `tengu_config_stale_write` (+3349048), `tengu_config_parse_error` (+3351487), `tengu_config_fallback_write` (+3348528), `tengu_daemon_control` (+17104063) |
| File writes | `keybindings.json` (VSCode-family), `settings.json` (Cursor/Windsurf remote), `alacritty.toml` (Alacritty), `~/.zed/keymap.json` (Zed), `~/Library/Preferences/com.apple.Terminal.plist` (Terminal.app) |
| Backup files | Random-suffix backup copies created before every write via `MeH.randomBytes(4).toString("hex")` |
| Subprocess invocations | `defaults export/write/read` (macOS), `/usr/libexec/PlistBuddy -c` (Terminal.app profiles), `killall cfprefsd` (flush macOS pref cache) |
| Directory creation | `nW.mkdir` with `{recursive: true}` for Zed keymap dir and VSCode config dir |
| appState changes | Onboarding project completion telemetry event `onboarding_project_complete` emitted via `KeH` (+4129295) |
| Sound | None detected |
| Hook registration | None detected in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.178 | Initial analysis |

---

## Common Mistakes

1. **Running on an unsupported terminal** — If the terminal cannot be identified, `/terminal-setup` only prints informational notes and makes no config changes. Verify that `$TERM_PROGRAM` or the process name matches one of the supported identifiers (`Apple_Terminal`, `vscode`, `cursor`, `windsurf`, `alacritty`, `zed`, `iTerm.app`).

2. **Forgetting to restart** — Most terminal emulators require a full restart after configuration changes. For Apple Terminal.app, the preferences cache is flushed via `killall cfprefsd`, but the UI still needs a restart. Alacritty requires a restart explicitly.

3. **Conflicting existing keybindings** — If `shift+enter` (VSCode) or `shift-enter` (Zed) or the Alacritty markers are already present in the config file, the command skips the write and reports "already configured". If the existing binding sends a different sequence, the user must manually reconcile.

4. **Remote/SSH sessions** — VSCode-family remote server paths (`.vscode-server`, `.cursor-server`, `.windsurf-server`, `.devin-server`) are handled by dedicated variants (`Qb_`, `$D8`). Running in a local VS Code window connected to a remote host may cause the wrong config path to be targeted.

5. **Non-darwin platforms** — The Apple Terminal.app and iTerm2 flows are macOS-only. On Linux or Windows, only the VSCode-family or Zed/Alacritty paths apply. The `win32` check (+4139803) influences the Alacritty config path resolution.

6. **Backup failures abort the operation** — For Terminal.app, Alacritty, and Zed, a failed backup causes an immediate bail-out with an error message. If the config directory is read-only, the command will not proceed.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `NK7` | Main handler — `asyncTerminalSetup` (Arbor-resolved, AsyncFunction) |
| `CRH` | Terminal-type detector; reads `ke.platform` and environment |
| `YD8` | Per-terminal dispatch router |
| `yK7` | Apple Terminal.app profile modification (PlistBuddy orchestration) |
| `n29` | Apple Terminal.app plist reader and backup initiator |
| `LeH` | Path builder using `c29.homedir` and `l29.join` |
| `g8` | Generic subprocess runner (`Q_` / `u6`) |
| `Q_` | Subprocess execution core |
| `u6` | Subprocess helper (error/output capture) |
| `ZK7` | Config backup creator (delegates to `W8`) |
| `W8` | Low-level config write-with-lock utility |
| `O1` | File-not-found / permission error classifier (`ENOENT`, `EACCES`, etc.) |
| `Z8` | Error/result wrapper |
| `N` | Console output / result display function |
| `AM4` | Logging/telemetry dispatch |
| `H` | Random delay / jitter utility (`Math.random`, `setTimeout`) |
| `xH` | `JSON.stringify` wrapper |
| `d4` | String sanitizer / redactor |
| `VdH` | Formatted output helper (`FCA`) |
| `LM4` | Config file writer with byte-length check (`Buffer.byteLength`) |
| `RH` | Error reporter and log pusher (`jA`, `L6`, `qq`, `RQ4`) |
| `jA` | Error constructor wrapper |
| `L6` | String coercion helper |
| `qq` | Essential-traffic queue helper |
| `RQ4` | Rolling log buffer (`Ye6.shift / push`) |
| `q` | Runtime data/event stream |
| `F1` | Fatal error handler — prints to stderr and calls `process.exit` |
| `NFH` | Console error formatter (`J6.red`) |
| `cX` | CLI error file writer (`E_H.writeFileSync`) |
| `f` | Promise/task set with `add`, `delete`, `finally` lifecycle |
| `L` | Async task manager (`A.close`, `q.close`) |
| `A` | Connection/session object |
| `r29` | PlistBuddy runner for "Default Window Settings" profile |
| `o29` | PlistBuddy runner for "Startup Window Settings" profile |
| `feH` | `killall cfprefsd` subprocess launcher |
| `mA` | ANSI color styler for terminal output |
| `OPH` | Full ANSI/256/RGB color mapper |
| `Ji` | Color-output finisher |
| `w` | Process exit / abort manager |
| `bX` | Forced-shutdown handler |
| `z` | Abort controller / daemon manager |
| `SH` | Feature-ok telemetry emitter |
| `bH` | Feature-bad telemetry emitter |
| `AR` | Daemon control telemetry emitter |
| `aB` | Process exit sequencer (`Promise.race/all`) |
| `fD8` | Backup orchestrator for Terminal.app plist |
| `VK7` | Config record creator (`S6`) |
| `S6` | Timestamped config record builder |
| `db_` | VSCode `keybindings.json` setup handler |
| `zD8` | Remote-server path detector (`.vscode-server`, etc.) |
| `dD6` | JSON document patcher (`JH8`, `Rm`) |
| `Rm` | String prefix stripper |
| `hR` | File URL converter (`a29.pathToFileURL`) |
| `cW` | Hyperlink / terminal-protocol detector (`Iw`, `parseInt`) |
| `Iw` | Hyperlink protocol helper |
| `xsA` | JSON patch applier (insert/remove/modify operations) |
| `C5_` | JSON array inserter (`hsA`) |
| `hsA` | JSON AST insertion helper |
| `b5_` | JSON array remover/modifier (`jH8`) |
| `jH8` | JSON substring extractor |
| `Qb_` | Cursor/Windsurf `settings.json` setup handler |
| `rb_` | Array type validator |
| `x5_` | JSON patch applier variant (settings path) |
| `$D8` | VSCode GPU-accel / remote-SSH setup handler |
| `d6` | Feature flag reader (`d`, `dH`) |
| `d` | Config value accessor |
| `dH` | Config section reader (`c36`) |
| `c36` | Config initialization sentinel |
| `kK7` | Alacritty `alacritty.toml` setup handler |
| `IK7` | Zed `keymap.json` setup handler |
| `i6` | `JSON.parse` wrapper |
| `KeH` | Onboarding/project-setup coordinator |
| `PY` | Onboarding display component (`S1H`, `S6`, `zq`) |
| `g29` | CLAUDE.md / workspace setup helper |
| `mb_` | CLAUDE.md path builder |
| `n6` | Logger / info printer |
| `pe6` | Context printer (`x8`) |
| `$P` | Project config writer |
| `wO8` | Config file write-with-lock (project config) |
| `tR1` | Object merge helper (`Object.assign`) |
| `_MH` | Config file reader with fallback |
| `JsH` | Config serializer |
| `zk_` | Backup directory path builder |
| `V` | Scroll / viewport math helper |
| `P` | Stream reader with timeout |
| `E` | Slice/range math helper |
| `ED6` | Atomic file writer (temp + rename + fchmod) |
| `gXH` | Config field extractor |
| `CG6` | Timestamp recorder (`Date.now`) |
| `YO8` | Project config write-with-lock variant |
| `ob_` | Unknown terminal setup handler (reads config, emits errors) |
| `hK7` | Helper called by `ob_` |
| `ib_` | Sub-handler using `S6` + `W8` |
| `lb_` | Sub-handler using `S6` |
| `nb_` | Sub-handler using `S6` |
| `cb_` | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| `t29` | Terminal-type detection + iTerm2 setup coordinator |
| `LD8` | iTerm2 clipboard-access configurator |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.