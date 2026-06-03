---
type: feature-spec
feature: "terminal-setup"
cc_version: "2.1.161"
updated: "2026-06-03"
tags: ["terminal-setup", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.161 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/terminal-setup`

> Analysis basis: CC v2.1.161 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.161

---

## Overview

`/terminal-setup` is a one-shot configuration command that installs a `Shift+Enter` key binding (and related terminal settings) for the user's current terminal emulator so that pressing `Shift+Enter` sends a newline rather than submitting input. It detects the active terminal type at runtime, applies the appropriate per-terminal configuration strategy (modifying plist files, keybinding JSON files, or TOML config files), and reports the result with actionable restart instructions.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `terminal-setup` |
| description | Install Shift+Enter key binding for newlines |
| loc_byte | `12243603` |
| loc_byte_end | `12244235` |
| loc_line | `8542` |
| module_id | `Wq9` |
| load_inline | `true` |
| arbor_handler.name | `SRL` |
| arbor_handler.fqn | `claude-2.1.161::SRL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.161 bundle.js:+12243603

---

## Input Branching

The handler performs 6+ distinct terminal-type branches, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    START(["/terminal-setup invoked"]) --> PLATFORM{Detect OS platform\nz8H.platform}

    PLATFORM -->|darwin| DETECT_TERM{Detect terminal type\nfrom env / process info}
    PLATFORM -->|win32 or linux| VSCODE_FAMILY{Is VSCode-family\neditor detected?}

    DETECT_TERM -->|"iTerm.app" in env| ITERM[iTerm2 branch:\nenable clipboard access\nvia 'defaults write']
    DETECT_TERM -->|"Apple_Terminal" in env| APPLE_TERMINAL[Apple Terminal branch:\nmodify com.apple.Terminal.plist\nvia PlistBuddy]
    DETECT_TERM -->|"vscode" / "cursor" / "windsurf"\nin TERM_PROGRAM or server dirs| VSCODE_BRANCH[VSCode-family branch:\nmodify keybindings.json]
    DETECT_TERM -->|"alacritty"| ALACRITTY[Alacritty branch:\nmodify alacritty.toml]
    DETECT_TERM -->|"zed"| ZED[Zed branch:\nmodify keymap.json]
    DETECT_TERM -->|"screen" or unknown| FALLBACK[Fallback: display\nnative-support note]

    VSCODE_FAMILY -->|yes| VSCODE_BRANCH
    VSCODE_FAMILY -->|no| FALLBACK

    APPLE_TERMINAL --> BACKUP{Can backup\nplist file?}
    BACKUP -->|no| ABORT_AT[Abort: emit error\n'Failed to create backup...']
    BACKUP -->|yes| READ_PROFILE{Read default\nand startup profiles}
    READ_PROFILE -->|read error| ABORT_PROFILE[Abort with error message]
    READ_PROFILE -->|ok| PLIST_BUDDY[Run PlistBuddy commands:\nSet UseOptionAsMetaKey,\ndisable audio bell]
    PLIST_BUDDY -->|all failed| WARN_AT[Warn: 'Failed to enable\nOption as Meta key...']
    PLIST_BUDDY -->|at least one ok| KILLALL[killall cfprefsd\nto flush pref daemon]
    KILLALL --> REPORT_AT[Report configured settings\n+ restart notice]

    VSCODE_BRANCH --> READ_KB{Read keybindings.json\n(create if absent)}
    READ_KB --> PARSE_KB[Parse JSON, locate or\ninsert shift+enter binding\nfor workbench.action.terminal.sendSequence]
    PARSE_KB --> BACKUP_KB[Backup with randomBytes suffix]
    BACKUP_KB --> WRITE_KB[Write updated keybindings.json]
    WRITE_KB --> REPORT_VS[Report success or error]

    ALACRITTY --> FIND_CFG{Find alacritty.toml\nin standard paths}
    FIND_CFG -->|not found| ABORT_ALA[Abort: 'No valid config path found']
    FIND_CFG -->|found| CHECK_EXISTING_ALA{Binding already present?\nmods = Shift, key = Return}
    CHECK_EXISTING_ALA -->|yes| SKIP_ALA[Report: already configured]
    CHECK_EXISTING_ALA -->|no| BACKUP_ALA[Backup config\nwith randomBytes suffix]
    BACKUP_ALA -->|error| ABORT_ALA_BACKUP[Abort: 'Error backing up...']
    BACKUP_ALA -->|ok| WRITE_ALA[Append TOML binding block\n+ report success]

    ZED --> READ_KEYMAP{Read keymap.json\n(~/.config/zed/keymap.json)\ncreate if absent}
    READ_KEYMAP --> CHECK_EXISTING_ZED{shift-enter\nalready present?}
    CHECK_EXISTING_ZED -->|yes| SKIP_ZED[Report: already configured]
    CHECK_EXISTING_ZED -->|no| BACKUP_ZED[Backup keymap\nwith randomBytes suffix]
    BACKUP_ZED -->|error| ABORT_ZED[Abort: 'Error backing up Zed keymap']
    BACKUP_ZED -->|ok| WRITE_ZED[Insert Terminal::SendText binding\nfor shift-enter + report success]

    ITERM --> READ_ITERM{Read iTerm2 pref:\nAllowClipboardAccess\nfrom com.googlecode.iterm2}
    READ_ITERM -->|already true| SKIP_ITERM[Report: already enabled]
    READ_ITERM -->|false or absent| WRITE_ITERM[defaults write -bool true\nReport success + restart note]
    WRITE_ITERM -->|error| FAIL_ITERM[Report: 'Couldn't update iTerm2 clipboard setting']

    FALLBACK --> NOTE[Print native-support note:\niTerm2, WezTerm, Ghostty,\nKitty, Warp, Windows Terminal\nsupport Shift+Enter natively]
```

Analysis basis: CC v2.1.161 bundle.js:+4008762 (platform detection), +4008959 (terminal dispatch), +4006765 (darwin literal), +4010901 (win32 literal)

---

## Behavioral Spec

### 1. Handler Entry Point (`SRL`)

The top-level async handler `SRL` is the Arbor-resolved entry for `/terminal-setup`.

```
async function terminalSetupHandler(context):
    platform = os.platform()                          // z8H.platform
    terminalType = detectTerminalType(platform)       // YNH / Xq9
    branch = selectBranch(terminalType)

    if branch == "iterm2":
        result = await configureITerm2()              // Xq9
    else if branch == "vscode_family":
        result = await applyVSCodeKeyBinding()        // cW_ / dW_ / Y48
    else if branch == "apple_terminal":
        result = await configureAppleTerminal()       // CRL
    else if branch == "alacritty":
        result = await configureAlacritty()           // bRL
    else if branch == "zed":
        result = await configureZed()                 // xRL
    else:
        result = buildFallbackMessage()

    displayResult(result)                             // J48 / KnH
```

Analysis basis: CC v2.1.161 bundle.js:+4008762, +4008959, +4009090, +4009310, +4010233

---

### 2. Terminal Type Detection

```
function detectTerminalType(platform):
    // Check platform first
    if platform == "darwin":
        termProgram = env.TERM_PROGRAM  // or equivalent
        if termProgram contains "iTerm.app" or "screen":
            return "iterm2_or_screen"
        if termProgram == "Apple_Terminal":
            return "apple_terminal"
    // Check VSCode-family via TERM_PROGRAM or home-dir server directories
    if termProgram == "vscode":
        return "vscode"
    if homeDir contains ".vscode-server":
        return "vscode"
    if homeDir contains ".cursor-server":
        return "cursor"
    if homeDir contains ".windsurf-server":
        return "windsurf"
    if termProgram == "alacritty":
        return "alacritty"
    if termProgram == "zed":
        return "zed"
    return "unknown"
```

Analysis basis: CC v2.1.161 bundle.js:+4006765 ("darwin"), +4006789 ("Apple_Terminal"), +4006821 ("vscode"), +4006845 ("cursor"), +4006869 ("windsurf"), +4006895 ("alacritty"), +4006922 ("zed"), +4006336 (".vscode-server"), +4006366 (".cursor-server"), +4006396 (".windsurf-server")

---

### 3. Apple Terminal Configuration (`CRL`)

The Apple Terminal handler uses the macOS `defaults` CLI and `/usr/libexec/PlistBuddy` to patch `com.apple.Terminal.plist`.

```
async function configureAppleTerminal():
    // Step 1: export plist to temp file via "defaults export com.apple.Terminal"
    prefFile = path.join(homedir(), "Library", "Preferences", "com.apple.Terminal.plist")
    exportResult = await runCommand("defaults", ["export", "com.apple.Terminal", tmpPath])

    // Step 2: create backup using randomBytes-suffixed filename
    backupOk = await createBackup(prefFile)
    if not backupOk:
        throw Error("Failed to create backup of Terminal.app preferences, bailing out")
                    // literal at +4016633

    // Step 3: read default window profile name
    defaultProfile = await runPlistBuddy("read", prefFile, "Default Window Settings")
    if error:
        throw Error("Failed to read default Terminal.app profile")   // +4016831

    // Step 4: read startup window profile name
    startupProfile = await runPlistBuddy("read", prefFile, "Startup Window Settings")
    if error:
        throw Error("Failed to read startup Terminal.app profile")   // +4017008

    // Step 5: for each profile (default, startup):
    //   - Set UseOptionAsMetaKey = true  (via PlistBuddy -c command)
    //   - Set AudioBell = false          (disable audio bell)
    //   collect success/failure per profile

    successItems = []
    if any profile configured UseOptionAsMetaKey:
        successItems.push('- Enabled "Use Option as Meta key"')      // +4017437
    if any profile configured AudioBell=false:
        successItems.push("- Switched to visual bell")               // +4017499

    if successItems is empty:
        throw Error("Failed to enable Option as Meta key or disable audio bell for any Terminal.app profile")
                    // +4017218

    // Step 6: flush pref daemon
    await runCommand("killall", ["cfprefsd"])                        // +4017317, +4017328

    // Step 7: build result message
    outputLines = ["Configured Terminal.app settings:"]             // +4017370
    outputLines.push(...successItems)
    outputLines.push(dim("Shift+Return will now enter a newline.")) // +4017544
    outputLines.push(dim("Option+Enter will now enter a newline.")) // +4017593
    outputLines.push(dim("You must restart Terminal.app for changes to take effect.")) // +4017678

    return { type: "success", lines: outputLines }                  // "success" at +4017357
```

Analysis basis: CC v2.1.161 bundle.js:+4016587 (CRL→xkA), +4016615 (CRL→Oq9), +4002845 ("Library"), +4002855 ("Preferences"), +4002869 ("com.apple.Terminal.plist"), +4002968 ("defaults"), +4002980 ("export"), +4002989 ("com.apple.Terminal"), +4015860 ("/usr/libexec/PlistBuddy")

---

### 4. Apple Terminal Backup and Rollback (`O48` / `kRL`)

```
async function backupAndVerifyTerminalPlist(prefFilePath):
    // kRL: create initial in-memory backup snapshot
    snapshot = captureConfigSnapshot()                // kRL / y6

    // O48: attempt plist export and atomic copy
    exportPath = deriveTempExportPath()
    stat = await fs.stat(prefFilePath)
    if stat fails:
        return { status: "no_backup" }               // "no_backup" at +4003252

    await copyFileAtomically(prefFilePath, backupPath)
    importResult = await runCommand("defaults", ["import", ...])
    if import fails:
        return { status: "failed" }                  // "failed" at +4003461

    // verify re-read matches snapshot
    if snapshot mismatch:
        restoreFromBackup(backupPath)
        return { status: "restored" }                // "restored" at +4003538

    return { status: "ok" }
```

Analysis basis: CC v2.1.161 bundle.js:+4003226 (O48→kRL), +4003278 (O48→LnH), +4003315 (O48→UW_.stat), +4003389 (O48→b8), +4003252 ("no_backup"), +4003461 ("failed"), +4003538 ("restored")

---

### 5. VSCode-Family Key Binding Installation (`cW_` for install, `dW_` for update, `Y48` for GPU/remote)

```
async function configureVSCodeKeyBindings(editorName):
    // Determine keybindings.json path based on editor and OS
    configDir = resolveVSCodeConfigDir(editorName)   // P48: uses z8H.homedir, z8H.platform
    // win32: AppData/Roaming/<editor>/User/
    // darwin: ~/Library/Application Support/<editor>/User/
    // linux:  ~/.config/<editor>/User/
    keybindingsPath = path.join(configDir, "keybindings.json")  // "keybindings.json" at +4014524

    // Create parent directory if needed
    await fs.mkdir(configDir, { recursive: true })

    // Read existing file or default to "[]"
    raw = await fs.readFile(keybindingsPath, "utf-8")  // "utf-8" at +4014638
           ?? "[]"                                      // "[]" at +4014587

    // Parse JSON, locate existing shift+enter binding
    parsed = parseJSON(raw)                            // b56 / K9
    existing = findBinding(parsed, "shift+enter")     // "shift+enter" at +4014973

    if existing:
        // dW_ path: update command in existing entry
        updated = updateBindingCommand(existing,
                    "workbench.action.terminal.sendSequence",  // +4014995
                    { text: "\x1b\r" },                        // ESC+CR at +4015047
                    "when": "terminalFocus")                   // +4015062
    else:
        // cW_ path: insert new binding entry
        newEntry = {
            key: "shift+enter",
            command: "workbench.action.terminal.sendSequence",
            args: { text: "\x1b\r" },
            when: "terminalFocus"
        }
        parsed.push(newEntry)

    // Backup original with randomBytes(4).toString("hex") suffix  // 4 at +4014721, "hex" at +4014733
    backupPath = keybindingsPath + ".backup." + randomHex
    await fs.copyFile(keybindingsPath, backupPath)

    // Write updated JSON
    await fs.writeFile(keybindingsPath, serialize(parsed))

    return buildSuccessResult(editorName)
```

Analysis basis: CC v2.1.161 bundle.js:+4013853 (cW_→j48), +4013868 (cW_→WA), +4014505 (cW_→P48), +4014554 (cW_→z2.mkdir), +4014614 (cW_→z2.readFile), +4014705 (cW_→MnH.randomBytes), +4014768 (cW_→z2.copyFile), +4015473 (cW_→z2.writeFile), +4010846 ("Code"), +4010901 ("win32"), +4010917 ("AppData"), +4010927 ("Roaming"), +4010939 ("User"), +4010991 ("Application Support"), +4011031 (".config")

---

### 6. VSCode Settings GPU/Remote Path (`Y48`)

When running in a remote SSH context or with GPU acceleration settings, a separate path (`Y48`) reads/writes `settings.json` rather than `keybindings.json`.

```
async function configureVSCodeSettings(editorName):
    settingsPath = path.join(configDir, "settings.json")  // "settings.json" at +4011203

    raw = await fs.readFile(settingsPath, "utf-8") ?? "{}"  // "{}" at +4011230

    parsed = parseJSON(raw)
    if typeof parsed != "object":
        return { status: "not_json_object" }               // +4012619

    // Check for terminal_setup_gpu_accel context
    // "terminal_setup_gpu_accel" at +4012369
    // "remote_ssh" at +4012396
    // apply relevant settings key

    backupPath = settingsPath + ".backup." + randomHex
    await fs.copyFile(settingsPath, backupPath)
    await fs.writeFile(settingsPath, serialize(parsed))
```

Analysis basis: CC v2.1.161 bundle.js:+4012248 (Y48→w6.dim), +4012353 (Y48→j48), +4012366 (Y48→t6), +4012369 ("terminal_setup_gpu_accel"), +4012396 ("remote_ssh"), +4012619 ("not_json_object"), +4012963 ("write_failed"), +4013184 ("backup_failed")

---

### 7. Alacritty Configuration (`bRL`)

```
async function configureAlacritty():
    // Search standard config paths for alacritty.toml
    candidatePaths = buildAlacrittyConfigCandidates()  // +4018322 "alacritty.toml"
    configPath = candidatePaths.find(p => fileExists(p))

    if not configPath:
        throw Error("No valid config path found for Alacritty")  // +4018685

    raw = await fs.readFile(configPath, "utf-8")

    // Check if binding already present
    if raw.includes('mods = "Shift"') and raw.includes('key = "Return"'):
        return report("Alacritty Shift+Enter key binding already configured")  // +4018826

    // Backup
    backupPath = configPath + ".backup." + randomHex
    try:
        await fs.copyFile(configPath, backupPath)
    catch:
        throw Error("Error backing up existing Alacritty config. Bailing out.")  // +4019036

    // Append TOML binding block
    bindingBlock = buildAlacrittyTOMLBinding()
    await fs.writeFile(configPath, raw + bindingBlock)

    return {
        message: "Installed Alacritty Shift+Enter key binding",  // +4019410
        note: "You may need to restart Alacritty for changes to take effect"  // +4019480
    }
```

Analysis basis: CC v2.1.161 bundle.js:+4018293 (bRL→A.push), +4018361 (bRL→z8H.homedir), +4018419 (bRL→z8H.platform), +4018572 (bRL→z2.readFile), +4018742 (bRL→L.includes), +4018753 ('mods = "Shift"'), +4018783 ('key = "Return"'), +4018925 (bRL→MnH.randomBytes), +4018988 (bRL→z2.copyFile), +4019354 (bRL→z2.writeFile), +4019596 (bRL→N), +4019670 (bRL→String), +4019705 ("Failed to install Alacritty Shift+Enter key binding")

---

### 8. Zed Configuration (`xRL`)

```
async function configureZed():
    keymapPath = path.join(homedir(), ".config", "zed", "keymap.json")
                 // "keymap.json" at +4019840

    await fs.mkdir(path.dirname(keymapPath), { recursive: true })

    raw = await fs.readFile(keymapPath, "utf-8") ?? "[]"

    // Check if shift-enter already bound
    if raw.includes("shift-enter"):                         // "shift-enter" at +4020006
        return report("Zed Shift+Enter key binding already configured")  // +4020046

    // Backup
    backupPath = keymapPath + ".backup." + randomHex
    try:
        await fs.copyFile(keymapPath, backupPath)
    catch:
        throw Error("Error backing up existing Zed keymap. Bailing out.")  // +4020250

    // Parse and insert new binding
    parsed = parseJSON(raw)
    if not Array.isArray(parsed):
        parsed = []

    newBinding = {
        context: "Terminal",                                // "Terminal" at +4020459
        bindings: { "shift-enter": "terminal::SendText",   // "terminal::SendText" at +4020495
                    args: "\x1b\r" }
    }
    parsed.push(newBinding)

    // Serialize with SH (JSON.stringify) and write
    await fs.writeFile(keymapPath, JSON.stringify(parsed, null, 2))

    return {
        message: "Installed Zed Shift+Enter key binding",  // +4020606
    }
```

Analysis basis: CC v2.1.161 bundle.js:+4019789 (xRL→Oh.join), +4019797 (xRL→z8H.homedir), +4019865 (xRL→z2.mkdir), +4019920 (xRL→z2.readFile), +4019995 (xRL→q.includes), +4020117 (xRL→zh), +4020139 (xRL→MnH.randomBytes), +4020202 (xRL→z2.copyFile), +4020535 (xRL→z2.writeFile), +4020550 (xRL→SH), +4020809 ("Failed to install Zed Shift+Enter key binding")

---

### 9. iTerm2 Configuration (`Xq9`)

```
async function configureITerm2():
    domainKey = "com.googlecode.iterm2"                    // +4007819
    prefKey   = "AllowClipboardAccess"                     // +4007843

    // Read current value via 'defaults read'
    currentValue = await runCommand("defaults", ["read", domainKey, prefKey])
    currentValue = currentValue.trim()

    if currentValue == "1" or currentValue == "true":
        return report("iTerm2 clipboard access already enabled")  // +4007918

    // Write true
    writeResult = await runCommand("defaults",
                    ["write", domainKey, prefKey, "-bool", "true"])
                    // "write" at +4008006, "-bool" at +4008061

    if writeResult.exitCode != 0:
        return report('Couldn\'t update iTerm2 clipboard setting.')  // +4008112

    return {
        message: 'Enabled "Applications in terminal may access clipboard" in iTerm2',  // +4008203
        note: "Restart iTerm2 for this to take effect. Undo: defaults write com.googlecode.iterm2 AllowClipboardAccess -bool false"  // +4008286
    }
```

Analysis basis: CC v2.1.161 bundle.js:+4007754 (Xq9→w6.dim), +4007797 (Xq9→b8), +4007878 (Xq9→A.trim), +4007902 (Xq9→WA), +4008433 (Xq9→yH)

---

### 10. Fallback / Native-Support Messages

When the terminal is not one of the directly-supported types, the handler emits informational notes rather than modifying any configuration.

- For terminals that support `Shift+Enter` natively (iTerm2, WezTerm, Ghostty, Kitty, Warp, Windows Terminal): display the native-support note.
  Analysis basis: CC v2.1.161 bundle.js:+4010091
- For terminals that allow `\` + Return as a substitute: display the backslash note.
  Analysis basis: CC v2.1.161 bundle.js:+4009756

---

### 11. Sub-process Execution Utility (`b8` / `h_`)

All shell commands (e.g., `defaults`, `killall`, `PlistBuddy`) are dispatched through a shared async sub-process runner:

```
async function runSubprocess(command, args, options):
    // h_: spawns child process, captures stdout/stderr
    // timeout enforced (related constant: 10 at +1051079)
    // result queue uses shift/push pattern (s44: lg6.shift / lg6.push)
    proc = spawn(command, args, options)
    output = await collectOutput(proc)     // QGH, Y, kf4, S$, N, v8, yH
    if proc.exitCode != 0:
        logError(output.stderr)            // ri.logError at +972355
    return output
```

Analysis basis: CC v2.1.161 bundle.js:+1051134 (b8→h_), +1051640 (h_→QGH), +1051777 (h_→Y), +1051833 (h_→kf4), +1051079 (constant 10), +971635 (s44→lg6.shift), +971647 (s44→lg6.push), +972355 (yH→ri.logError)

---

### 12. File-Write Utility with Atomic Backup (`Y56`)

Config file writes use an atomic pattern: write to a temp file, apply original permissions, then rename.

```
function atomicWriteFile(targetPath, content, originalMode):
    tempPath = targetPath + ".backup." + randomBytes(6).toString("hex")
                // 6 at +1013760
    fd = fs.openSync(tempPath, flags)
    fs.writeFileSync(fd, content)
    fs.fchmodSync(fd, originalMode)        // apply original permissions at +1014238
    fs.fsyncSync(fd)                       // flush at +1014304
    fs.closeSync(fd)
    fs.renameSync(tempPath, targetPath)    // atomic rename at +1014432
```

Analysis basis: CC v2.1.161 bundle.js:+1013744 (Y56→Qa8.randomBytes), +1013809 (Y56→q.statSync), +1014180 (Y56→K$.writeFileSync), +1014238 (K$.fchmodSync), +1014304 (K$.fsyncSync), +1014432 (q.renameSync), +1013760 (6), +1014259 ("Applied original permissions to temp file")

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_ok` (bundle.js:+966587), `tengu_feature_bad` (+966650), `tengu_feature_sad` (+966732), `tengu_config_auth_loss_prevented` (+3246565), `tengu_config_lock_contention` (+3249297), `tengu_config_stale_write` (+3249433), `tengu_config_parse_error` (+3251872), `tengu_daemon_control` (+15940522) |
| File mutations | Modifies one of: `~/Library/Preferences/com.apple.Terminal.plist`, `keybindings.json` (VSCode-family), `settings.json` (VSCode GPU/remote path), `alacritty.toml`, `~/.config/zed/keymap.json` |
| Backups created | Each file mutation creates a `.backup.<randomHex>` copy before writing, using `MnH.randomBytes` (4 or 6 bytes) |
| Shell commands spawned | `defaults export/read/write/import`, `/usr/libexec/PlistBuddy -c`, `killall cfprefsd` (macOS only) |
| Directory creation | `fs.mkdir` with `{ recursive: true }` for VSCode config dirs and Zed config dir |
| appState changes | `onboarding_project_complete` event emitted on successful setup completion (literal at +4002183) via `KnH` |
| Config lock | File writes go through the global config lock; `tengu_config_lock_contention` fired on slow acquisition |
| Sound | None identified in traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.161 | Initial analysis |

---

## Common Mistakes

1. **Running on an unsupported terminal**: On terminals such as Warp, WezTerm, Ghostty, or Windows Terminal, `Shift+Enter` is already handled natively — the command will emit an informational message rather than modify any file. This is expected behavior, not an error.

2. **Not restarting the terminal after the command**: The Apple Terminal, Alacritty, and iTerm2 paths all require a terminal restart for changes to take effect. The command prints this reminder, but users frequently miss it.

3. **Multiple Claude instances racing on config**: The config-write layer uses a file lock. If a second Claude instance is running simultaneously, `tengu_config_lock_contention` may be emitted and the write may be delayed or refused.

4. **Backup accumulation**: Each invocation creates a new `.backup.<hex>` file. Running `/terminal-setup` repeatedly will accumulate backup files in the config directories.

5. **VSCode remote/SSH ambiguity**: The command detects VSCode-family editors by checking both `TERM_PROGRAM` and the presence of `.vscode-server` / `.cursor-server` / `.windsurf-server` directories in `$HOME`. In some setups, both signals may disagree, potentially selecting the wrong editor branch.

6. **Apple Terminal profile mismatch**: If the "Default Window Settings" and "Startup Window Settings" profile names differ, the command patches both independently; a failure on one does not abort patching the other, but a failure on all profiles triggers the `Failed to enable Option as Meta key…` error.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `SRL` | Top-level async handler for `/terminal-setup` (Arbor-resolved entry) |
| `YNH` | Platform/terminal-type detector (reads `z8H.platform`) |
| `Xq9` | iTerm2 configuration sub-handler |
| `CRL` | Apple Terminal configuration sub-handler |
| `Oq9` | Apple Terminal plist export helper |
| `fnH` | Constructs path to `com.apple.Terminal.plist` via `Mq9.homedir` + `$q9.join` |
| `b8` | Async subprocess runner (top-level) |
| `h_` | Subprocess output collector |
| `h6` | Secondary subprocess helper |
| `IRL` | Subprocess result parser / error handler |
| `W8` | Config file save utility (global config write) |
| `yH` | Async write queue / error logger |
| `a_` | Error formatter |
| `pH` | String coercion helper |
| `r9` | Queue classifier ("essential-traffic") |
| `s44` | FIFO queue manager (shift/push) |
| `wq9` | PlistBuddy command builder (Set key operations) |
| `jq9` | PlistBuddy command builder (Delete/Add key operations) |
| `LnH` | Config write dispatcher (calls `W8`) |
| `WA` | Output line formatter / ANSI color dispatcher |
| `LYH` | ANSI color name-to-function mapper |
| `yd` | Dim/styled text helper |
| `Y` | Process exit / abort handler |
| `z` | AbortController-like lifecycle manager |
| `hH` | Daemon stop (ok path) |
| `RH` | Daemon stop (error path) |
| `ly` | Daemon control dispatcher |
| `qp` | Process race/shutdown handler |
| `O48` | Backup-and-verify plist helper |
| `kRL` | Config snapshot capturer |
| `y6` | Snapshot/token generator with timestamp |
| `cW_` | VSCode keybindings.json installer (new binding) |
| `dW_` | VSCode keybindings.json updater (existing binding) |
| `Y48` | VSCode settings.json modifier (GPU/remote path) |
| `j48` | VSCode-family type disambiguator (checks server dir strings) |
| `P48` | VSCode config directory resolver (platform-aware) |
| `b56` | JSON parse wrapper with error normalization |
| `Ox` | String prefix stripper |
| `K9` | Filesystem error code classifier (ENOENT, EACCES, etc.) |
| `zh` | Hyperlink/URL builder for config paths |
| `$2` | Hyperlink renderer (RD, rH9.includes, parseInt) |
| `qRA` | JSON binding insert helper |
| `Ot8` | JSON AST insertion operator |
| `oSA` | JSON AST array editor |
| `zt8` | JSON AST range editor |
| `nQ6` | JSON substring extractor |
| `Dt8` | JSON binding update helper |
| `oW_` | Array shape validator for keybinding JSON |
| `bRL` | Alacritty configuration sub-handler |
| `xRL` | Zed configuration sub-handler |
| `m6` | JSON.parse wrapper |
| `J48` | Top-level output renderer / result presenter |
| `KnH` | Onboarding completion emitter |
| `cO` | Config state observer |
| `Kq9` | Project config loader |
| `pW_` | CLAUDE.md path resolver |
| `F6` | Filesystem existence checker |
| `PQ6` | Project-level config reader |
| `LD` | Current project config saver |
| `Pj_` | Global config save-with-lock |
| `qjq` | Config object merger (`Object.assign`) |
| `nDH` | Config file reader with parse/stat |
| `iY6` | Config validator |
| `Xj_` | Config backup path builder |
| `Y56` | Atomic file writer (temp + fchmod + fsync + rename) |
| `McH` | Config merge helper |
| `$cH` | Timestamp helper (`Date.now`) |
| `Jj_` | Config write finalizer |
| `aW_` | Read-config-for-terminal-setup helper |
| `RRL` | Read result classifier |
| `rW_` | Config read path variant A |
| `nW_` | Config read path variant B |
| `iW_` | Config read path variant C |
| `lW_` | Config read path variant D |
| `z48` | Terminal label string builder |
| `N` | Shell command executor (high-level) |
| `VBK` | Command result wrapper |
| `H` | HTTP/fetch utility (bootstrap) |
| `SH` | JSON.stringify wrapper |
| `Z4` | Path redaction / credential scrubber |
| `imH` | Git/path helper |
| `IBK` | File write utility (general) |
| `V` | Directory entry filter |
| `X` | Text editor input component |
| `Z` | Slice helper |
| `t6` | Subprocess with stdio inherit |
| `d` | Promise/deferred utility |
| `h1H` | Subprocess output aggregator |
| `Xa8` | Child process spawn wrapper |
| `WJ` | Forced-shutdown label |
| `McH` | Config merge helper (duplicate — same as above) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.