---
type: feature-spec
feature: "terminal-setup"
cc_version: "2.1.160"
updated: "2026-06-02"
tags: ["terminal-setup", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.160 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/terminal-setup`

> Analysis basis: CC v2.1.160 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.160

---

## Overview

`/terminal-setup` installs terminal key bindings and settings that improve the Claude Code experience — most importantly a **Shift+Enter** binding for inserting newlines without submitting input. The command detects the active terminal emulator (or falls back to a platform-appropriate heuristic), then applies the necessary configuration changes per-application (Apple Terminal, iTerm2, VSCode/Cursor/Windsurf, Alacritty, or Zed).

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `terminal-setup` |
| description | Install Shift+Enter key binding for newlines |
| loc_byte | `12202230` |
| loc_byte_end | `12202862` |
| loc_line | `8523` |
| module_id | `L_9` |
| load_inline | `true` |
| arbor_handler.name | `IyL` |
| arbor_handler.fqn | `claude-2.1.160::IyL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.160 bundle.js:+12202230

---

## Input Branching

The command branches across at least six terminal-emulator paths plus multiple sub-branches for file I/O success/failure; a Mermaid flowchart is required.

```mermaid
flowchart TD
    Start(["/terminal-setup invoked"]) --> DetectOS{platform check}
    DetectOS -->|not darwin| NonMac[Non-macOS path]
    DetectOS -->|darwin| DetectTerm{Detect terminal emulator}

    NonMac --> CheckVSCodeFamily{VSCode-family env?}
    CheckVSCodeFamily -->|VSCode / Cursor / Windsurf server env| VSCodePath
    CheckVSCodeFamily -->|none| UnsupportedMsg[Display unsupported notice\nwith backslash+return tip]

    DetectTerm -->|iTerm.app process running| iTerm2Path[iTerm2 branch]
    DetectTerm -->|screen/other| TermFallback[Display native-support notice]
    DetectTerm -->|Apple Terminal| AppleTermPath[Apple Terminal branch]
    DetectTerm -->|VSCode / Cursor / Windsurf IDE| VSCodePath[VSCode-family branch]
    DetectTerm -->|Alacritty| AlacrittyPath[Alacritty branch]
    DetectTerm -->|Zed| ZedPath[Zed branch]

    iTerm2Path --> iTerm2ClipboardCheck{clipboard access\nalready enabled?}
    iTerm2ClipboardCheck -->|yes| iTerm2Skip[Skip, show already-configured msg]
    iTerm2ClipboardCheck -->|no| iTerm2Write[Write iTerm2 pref via defaults write]
    iTerm2Write -->|success| iTerm2OK[Show success + restart notice]
    iTerm2Write -->|failure| iTerm2Fail[Show failure msg]

    AppleTermPath --> BackupPrefs{Backup Terminal plist\n(Library/Preferences/\ncom.apple.Terminal.plist)}
    BackupPrefs -->|failure| AppleBackupFail[Error: "Failed to create backup…"]
    BackupPrefs -->|success| ReadDefaults[Read Default Window Settings profile]
    ReadDefaults -->|failure| DefaultProfileFail[Error: "Failed to read default Terminal.app profile"]
    ReadDefaults -->|success| ReadStartup[Read Startup Window Settings profile]
    ReadStartup -->|failure| StartupProfileFail[Error: "Failed to read startup Terminal.app profile"]
    ReadStartup -->|success| ApplyPlistBuddy[Apply option-as-meta + visual bell\nvia /usr/libexec/PlistBuddy]
    ApplyPlistBuddy -->|all profiles fail| AppleAllFail[Error: "Failed to enable Option as Meta key…"]
    ApplyPlistBuddy -->|partial/full success| KillPrefsd[killall cfprefsd]
    KillPrefsd --> AppleSuccess[Show configured settings:\n'Enabled Use Option as Meta key'\n'Switched to visual bell'\n'Shift+Return will now enter a newline.'\n'You must restart Terminal.app…']

    VSCodePath --> DetermineProduct{product name}
    DetermineProduct -->|VSCode| VSCodeKeybindPath
    DetermineProduct -->|Cursor| CursorKeybindPath
    DetermineProduct -->|Windsurf| WindsurfKeybindPath
    VSCodeKeybindPath --> WriteKeybind[Write keybindings.json:\nshift+enter → sendSequence ESC+CR\nwhen: terminalFocus]
    CursorKeybindPath --> WriteKeybind
    WindsurfKeybindPath --> WriteKeybind
    WriteKeybind -->|success| VSCodeOK[Show success msg]
    WriteKeybind -->|failure| VSCodeFail[Show failure/warning msg]

    AlacrittyPath --> FindAlacrittyConfig{Locate alacritty.toml}
    FindAlacrittyConfig -->|not found| AlacrittyNoConfig[Error: "No valid config path found for Alacritty"]
    FindAlacrittyConfig -->|found| CheckAlacrittyBinding{binding already present?\n'mods = Shift' + 'key = Return'}
    CheckAlacrittyBinding -->|yes| AlacrittyAlready[Show already-configured msg]
    CheckAlacrittyBinding -->|no| BackupAlacritty{Backup existing config}
    BackupAlacritty -->|failure| AlacrittyBackupFail[Error: "Error backing up… Bailing out."]
    BackupAlacritty -->|success| WriteAlacritty[Append Shift+Enter binding to config]
    WriteAlacritty -->|success| AlacrittyOK[Show: "Installed Alacritty Shift+Enter key binding"\n+ restart notice]
    WriteAlacritty -->|failure| AlacrittyFail[Error: "Failed to install Alacritty Shift+Enter key binding"]

    ZedPath --> FindZedKeymap{Locate keymap.json\n~/.config/zed/keymap.json}
    FindZedKeymap -->|check binding 'shift-enter'| CheckZedBinding{already present?}
    CheckZedBinding -->|yes| ZedAlready[Show already-configured msg]
    CheckZedBinding -->|no| BackupZed{Backup existing keymap}
    BackupZed -->|failure| ZedBackupFail[Error: "Error backing up… Bailing out."]
    BackupZed -->|success| WriteZed[Inject Terminal / terminal::SendText binding]
    WriteZed -->|success| ZedOK[Show: "Installed Zed Shift+Enter key binding"]
    WriteZed -->|failure| ZedFail[Error: "Failed to install Zed Shift+Enter key binding"]
```

Analysis basis: CC v2.1.160 bundle.js:+3999132 (platform check), +3999329 (iTerm2 sub-handler), +3997462 (VSCode-family routing), +4008663 (Alacritty sub-handler), +4010159 (Zed sub-handler)

---

## Behavioral Spec

### 1. Top-Level Handler (`IyL`)

The Arbor-resolved handler `IyL` is an `AsyncFunction` reached via `module_id` resolution.

```
async function terminalSetupHandler(context):
    currentPlatform = os.platform()               // s6H.platform
    detectedTerminal = detectTerminalEmulator()   // pvH -> K_9

    if currentPlatform != "darwin":
        if isVSCodeFamilyEnv():
            return await configureVSCodeFamily(context)
        else:
            displayMessage(backslashReturnTip)    // literal: "Note: You can already use backslash (\\) + return …"
            displayMessage(nativeSupportNote)     // literal: "Note: iTerm2, WezTerm, Ghostty, Kitty, Warp, and Windows Terminal support Shift+Enter natively."
            return

    // macOS path
    await runTerminalSpecificSetup(detectedTerminal, context)  // a18
```

Analysis basis: CC v2.1.160 bundle.js:+3999132

---

### 2. Terminal Emulator Detection (`pvH` / `K_9`)

```
function detectTerminalEmulator():
    platform = os.platform()           // s6H.platform (loc +3997118)
    termProgram = env("TERM_PROGRAM")
    identified = identifyFromEnv()     // checks TERM_PROGRAM and process list

    candidates = [
        "Apple_Terminal",   // +3997159
        "vscode",           // +3997191
        "cursor",           // +3997215
        "windsurf",         // +3997239
        "alacritty",        // +3997265
        "zed",              // +3997292
    ]

    for each candidate in candidates:
        if termProgram matches candidate:
            return candidate

    // iTerm2 detection is a separate sub-check (K_9)
    if runCommand("defaults read com.googlecode.iterm2 AllowClipboardAccess") succeeds:
        return "iterm2"

    return "unknown"
```

Analysis basis: CC v2.1.160 bundle.js:+3997118 (platform), +3997135–3997292 (terminal literals)

---

### 3. iTerm2 Sub-Handler (`K_9`)

```
async function configureiTerm2():
    dim("iTerm2")                                      // j6.dim, +3998124

    currentValue = runCommand(
        "defaults read com.googlecode.iterm2 AllowClipboardAccess"
    )                                                  // h8 subprocess, +3998167

    trimmedValue = currentValue.trim()                 // +3998248
    if trimmedValue == "1":
        displayLine(JA, "iTerm2 clipboard access already enabled")  // +3998288
        return

    writeResult = runCommand(
        "defaults write com.googlecode.iterm2 AllowClipboardAccess -bool YES"
    )                                                  // "write", "-bool", +3998376/+3998431

    if writeResult fails:
        warn("Couldn't update iTerm2 clipboard setting.")  // yH error path, +3998482
        return

    displaySuccess(
        'Enabled "Applications in terminal may access clipboard" in iTerm2',  // +3998573
        "Restart iTerm2 for this to take effect. Undo: defaults write …"      // +3998656
    )
```

Analysis basis: CC v2.1.160 bundle.js:+3998124, +3998167, +3998288, +3998573

---

### 4. Apple Terminal Sub-Handler (`yyL`)

This is the most complex path, involving plist backup, profile reading, and PlistBuddy manipulation.

```
async function configureAppleTerminal():
    // Step 1: Backup plist
    plistPath = path.join(homedir(), "Library", "Preferences", "com.apple.Terminal.plist")
    // literals: "Library" +3993215, "Preferences" +3993225, "com.apple.Terminal.plist" +3993239

    backupOK = await createBackup(plistPath)           // c18 -> VyL
    if not backupOK:
        throw Error("Failed to create backup of Terminal.app preferences, bailing out")
        // literal +4007003

    // Step 2: Export current prefs to temp file via `defaults export com.apple.Terminal`
    // literals: "defaults" +3993338, "export" +3993350, "com.apple.Terminal" +3993359
    exportResult = await runSubprocess("defaults", ["export", "com.apple.Terminal", tmpFile])
    // h8 subprocess call, +4007098

    // Step 3: Read Default Window Settings profile name
    defaultProfile = exportResult.trim()               // q.trim, +4007180
    if not defaultProfile:
        throw Error("Failed to read default Terminal.app profile")  // +4007201

    // Step 4: Read Startup Window Settings profile name
    startupProfile = exportResult.trim()               // L.trim, +4007357
    if not startupProfile:
        throw Error("Failed to read startup Terminal.app profile")  // +4007378

    // Step 5: Apply settings via PlistBuddy for each unique profile
    // Tool path: "/usr/libexec/PlistBuddy" +4006230, flag: "-c" +4006257
    profilesPatched = 0
    for profile in deduplicate([defaultProfile, startupProfile]):
        result = applyPlistBuddySettings(profile, plistPath)  // H_9, __9
        if result ok:
            profilesPatched++

    if profilesPatched == 0:
        displayError("Failed to enable Option as Meta key or disable audio bell for any Terminal.app profile")
        // literal +4007588
        return

    // Step 6: Reload prefs daemon
    runSubprocess("killall", ["cfprefsd"])             // literals +4007687, +4007698

    // Step 7: Display results
    displaySuccess("Configured Terminal.app settings:", [
        '- Enabled "Use Option as Meta key"',          // +4007807
        '- Switched to visual bell',                   // +4007869
    ])
    displayInfo(colorize(
        "Shift+Return will now enter a newline.",       // +4007914
        "Option+Enter will now enter a newline.",       // +4007963
    ))
    displayNote("You must restart Terminal.app for changes to take effect.")  // +4008048
```

Analysis basis: CC v2.1.160 bundle.js:+4007003, +4007098, +4007201, +4007378, +4007588, +4007914, +4008048

---

### 5. VSCode-Family Sub-Handlers (`q2_`, `A2_`, `i18`)

Three parallel handlers cover VSCode (`q2_`), Cursor (`A2_`), and Windsurf (`i18`) respectively. They share the same logical shape:

```
async function configureVSCodeFamily(productName, keybindingsDir):
    // Detect remote/server environment
    isRemote = isRemoteSSHEnv()                        // o18: checks .vscode-server (+3996706),
                                                       // .cursor-server (+3996736), .windsurf-server (+3996766)

    // Resolve keybindings.json path
    keybindingsPath = path.join(
        resolveConfigDir(productName),                 // s18: platform-aware, +4001240
        "keybindings.json"                             // literal +4004894
    )

    // Ensure directory exists
    await fs.mkdir(keybindingsPath parent, {recursive: true})  // A2.mkdir, +4004924

    // Read existing file (default to "[]" if missing)
    existing = await fs.readFile(keybindingsPath, "utf-8")  // +4004984, default "[]" +4004957

    // Parse JSON
    parsed = parseJsonWithComments(existing)           // if6 -> cg6/Ax/N, +4005025

    // Check for existing shift+enter binding
    alreadyPresent = parsed.find(entry =>
        entry.key == "shift+enter"                     // literal +4005343
    )

    if alreadyPresent:
        // Update in-place rather than duplicate
        // (handled via JSON AST patch, qhA/ha8)

    else:
        // Build new binding entry
        newEntry = {
            key: "shift+enter",
            command: "workbench.action.terminal.sendSequence",  // +4005365
            args: { text: "\x1b\r" },                           // ESC+CR, +4005417
            when: "terminalFocus"                               // +4005432
        }
        parsed.push(newEntry)

    // Backup before write (randomBytes suffix, 4 bytes → hex)
    // RlH.randomBytes, 4 bytes +4005091, "hex" +4005103
    backupPath = keybindingsPath + ".backup." + randomHex()
    await fs.copyFile(keybindingsPath, backupPath)     // A2.copyFile, +4005138

    // Write updated file
    await fs.writeFile(keybindingsPath, JSON.stringify(parsed, null, 2))  // A2.writeFile, +4005843

    displaySuccess(productName + " Shift+Enter key binding installed")
```

For Windsurf (`i18`), the GPU acceleration setting path `terminal_setup_gpu_accel` is additionally checked via a `t6` call (literal: `"terminal_setup_gpu_accel"` at +4002739, `"remote_ssh"` at +4002766).

Analysis basis: CC v2.1.160 bundle.js:+4004894, +4005025, +4005343, +4005365, +4005417, +4005432, +4005843

---

### 6. Alacritty Sub-Handler (`hyL`)

```
async function configureAlacritty():
    // Candidate config paths searched (platform + homedir aware)
    // "alacritty.toml" literal +4008692
    candidatePaths = resolveCandidatePaths("alacritty.toml")  // path.join + s6H.homedir/platform

    configPath = candidatePaths.find(p => fs.existsSync(p))
    if not configPath:
        throw Error("No valid config path found for Alacritty")  // +4009055

    content = await fs.readFile(configPath, "utf-8")   // A2.readFile, +4008942

    // Check for existing binding
    if content.includes('mods = "Shift"') and content.includes('key = "Return"'):
        // literals +4009123, +4009153
        displayInfo("Alacritty Shift+Enter key binding already configured")  // +4009196
        return

    // Backup
    backupPath = configPath + ".backup." + randomHex()  // RlH.randomBytes, +4009295
    try:
        await fs.copyFile(configPath, backupPath)       // +4009358
    catch:
        throw Error("Error backing up existing Alacritty config. Bailing out.")  // +4009406

    // Append binding block to TOML
    // Ensures [[keyboard.bindings]] section exists; creates parent dir if needed
    await fs.mkdir(path.dirname(configPath), {recursive: true})  // +4009554/+4009563
    newContent = appendAlacrittyBinding(content)        // inserts shift+Return sendSequence block

    await fs.writeFile(configPath, newContent)          // +4009724

    displaySuccess(
        "Installed Alacritty Shift+Enter key binding",  // +4009780
        "You may need to restart Alacritty for changes to take effect"  // +4009850
    )
```

Analysis basis: CC v2.1.160 bundle.js:+4009055, +4009123, +4009196, +4009406, +4009780, +4009850

---

### 7. Zed Sub-Handler (`SyL`)

```
async function configureZed():
    keymapPath = path.join(homedir(), ".config", "zed", "keymap.json")
    // s6H.homedir +4010167, Lh.join +4010159

    await fs.mkdir(path.dirname(keymapPath), {recursive: true})  // A2.mkdir, +4010235

    existing = await fs.readFile(keymapPath, "utf-8")   // A2.readFile, +4010290
    parsed = parseJson(existing)                         // H9 error-code check, +4010342

    // Check for existing shift-enter binding
    if parsed.includes("shift-enter"):                   // literal +4010376, q.includes +4010365
        displayInfo("Zed Shift+Enter key binding already configured")  // +4010416
        return

    // Backup
    backupPath = keymapPath + ".backup." + randomHex()   // RlH.randomBytes, +4010509
    try:
        await fs.copyFile(keymapPath, backupPath)         // +4010572
    catch:
        throw Error("Error backing up existing Zed keymap. Bailing out.")  // +4010620

    // Build new binding entry
    // Context: "Terminal" +4010829, action: "terminal::SendText" +4010865
    // Array.isArray check +4010773, L.push +4010813
    if Array.isArray(parsed):
        parsed.push({
            context: "Terminal",
            bindings: { "shift-enter": ["terminal::SendText", { text: "\x1b\r" }] }
        })
    else:
        parsed = [parsedAsEntry, newEntry]

    await fs.writeFile(keymapPath, JSON.stringify(parsed, null, 2))  // SH +4010920, +4010905
    // if writeFile fails: Error("Failed to install Zed Shift+Enter key binding") +4011185

    displaySuccess("Installed Zed Shift+Enter key binding")  // +4010976
```

Analysis basis: CC v2.1.160 bundle.js:+4010159, +4010376, +4010416, +4010829, +4010865, +4010976

---

### 8. Backup Helper (`c18` / `VyL`)

All file-write paths share a backup sub-routine:

```
async function createConfigBackup(filePath):
    exists = await stat(filePath) != null              // sX_.stat, +3993415/+3993685

    if not exists:
        return { status: "no_backup" }                 // literal +3993622

    // Create a rolling backup store (VyL -> R6)
    // R6 uses Date.now() +3244687 and a rotation counter (ojL)
    backupRecord = initBackupRecord(filePath)          // R6, +3993068

    // Run subprocess: `defaults export com.apple.Terminal <tmp>`
    // or file copy for non-plist targets
    importResult = runImport(filePath, backupRecord)   // hlH -> W8, +3993648

    if importResult fails:
        return { status: "failed" }                    // literal +3993831
    else:
        return { status: "restored", record: backupRecord }  // literal +3993908
```

Analysis basis: CC v2.1.160 bundle.js:+3993415, +3993622, +3993831, +3993908

---

### 9. Subprocess Execution (`h8` / `v_`)

File I/O and `defaults` commands share a common subprocess runner:

```
async function runSubprocess(command, args, options):
    // Buffer size cap: 1,000,000 bytes (+1050635)
    // Queue depth limit: 10 (+1050113)
    // Retry count: 1 (+1050758)

    if queue full:
        wait for slot

    result = spawnProcess(command, args, options)      // v_ -> jEH/Y/o44/SO/N/G8/yH

    if result.exitCode != 0:
        logError(result.stderr)                        // yH -> mi.logError, +971861
        return { ok: false, stderr: result.stderr }

    return { ok: true, stdout: result.stdout }
```

Analysis basis: CC v2.1.160 bundle.js:+1050113, +1050635, +1050758, +971861

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_feature_ok` | Fired on successful feature completion (bundle.js:+966123) |
| Telemetry — `tengu_feature_bad` | Fired on feature hard failure (bundle.js:+966181) |
| Telemetry — `tengu_feature_sad` | Fired on partial/degraded feature outcome (bundle.js:+966258) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a stale write would have wiped auth (bundle.js:+3243039) |
| Telemetry — `tengu_config_lock_contention` | Fired when config lock acquisition is slow (bundle.js:+3245771) |
| Telemetry — `tengu_config_stale_write` | Fired when stale config write is blocked (bundle.js:+3245907) |
| Telemetry — `tengu_config_parse_error` | Fired when config JSON cannot be parsed (bundle.js:+3248346) |
| Telemetry — `tengu_daemon_control` | Fired during daemon lifecycle interactions (bundle.js:+15883547) |
| File system writes | Modifies `keybindings.json` (VSCode-family), `alacritty.toml`, `~/.config/zed/keymap.json`, or `~/Library/Preferences/com.apple.Terminal.plist` |
| Backup files | Creates `.backup.<randomhex>` copies of files before any write; rolling backup store for Apple Terminal |
| External processes | May invoke `defaults`, `/usr/libexec/PlistBuddy`, `killall cfprefsd` on macOS |
| appState changes | None detected in depth-2 traversal |
| Sound | None detected in depth-2 traversal |
| Hook registration | None detected in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.160 | Initial analysis |

---

## Common Mistakes

1. **Running on an unsupported terminal**: The command only modifies config for Apple Terminal, iTerm2, VSCode/Cursor/Windsurf, Alacritty, and Zed. Running it in any other terminal (e.g., plain `xterm`, `gnome-terminal`) will produce an informational note about using backslash+Return instead, and make no changes.
2. **Forgetting to restart the terminal**: All paths except VSCode-family explicitly require restarting the terminal for changes to take effect. The `killall cfprefsd` step for Apple Terminal does not substitute for an app restart.
3. **Invoking outside macOS for Apple Terminal paths**: The Apple Terminal and iTerm2 branches are macOS-only (guarded by `platform == "darwin"`). On Linux, only VSCode-family is supported.
4. **Conflicting existing bindings**: The command checks for existing `shift+enter`/`shift-enter` bindings before writing. If a binding is found it displays an "already configured" message — but a binding to a *different* command will still trigger the "already configured" path, potentially masking a misconfiguration.
5. **Permission errors on plist**: `~/Library/Preferences/com.apple.Terminal.plist` may be locked by TCC on newer macOS. If `defaults export` fails, the backup step will fail and the command will abort with an error rather than proceeding.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `IyL` | Top-level async handler for `/terminal-setup` (Arbor primary) |
| `pvH` | Terminal emulator detection wrapper (reads `TERM_PROGRAM`, platform) |
| `K_9` | iTerm2 detection and clipboard-access sub-handler |
| `a18` | macOS router — dispatches to per-terminal sub-handlers |
| `yyL` | Apple Terminal configuration sub-handler |
| `q2_` | VSCode keybinding configuration sub-handler |
| `A2_` | Cursor keybinding configuration sub-handler |
| `i18` | Windsurf keybinding configuration sub-handler |
| `hyL` | Alacritty configuration sub-handler |
| `SyL` | Zed keymap configuration sub-handler |
| `ylH` | Onboarding/project-state integration (emits `onboarding_project_complete`) |
| `c18` | Config backup orchestrator |
| `VyL` | Backup record initializer (delegates to `R6`) |
| `R6` | Timestamped backup-entry writer |
| `h8` | Subprocess execution wrapper (queue, buffer, retry) |
| `v_` | Low-level process spawn (calls `jEH`, `Y`, `o44`, `SO`, `N`, `G8`, `yH`) |
| `S6` | Shell path resolver (`sF6`, `Y_`) |
| `yH` | Subprocess output handler / error logger (calls `mi.logError`) |
| `a89` | Apple Terminal plist path builder (`homedir + Library/Preferences/…`) |
| `SlH` | Path join helper for macOS home-relative paths |
| `ZyL` | PlistBuddy config-write orchestrator |
| `W8` | Global config read/write with lock (`xY_`, `y0`, `ZDH`, `bY_`) |
| `H_9` | PlistBuddy command executor for Default profile |
| `__9` | PlistBuddy command executor for Startup profile |
| `hlH` | Dispatch helper calling `W8` |
| `JA` | ANSI/terminal color output formatter |
| `xDH` | Color string mapper (maps color names to chalk/j6 methods) |
| `s18` | VSCode-family config directory resolver (platform-aware) |
| `o18` | Remote server environment detector (`.vscode-server`, `.cursor-server`, `.windsurf-server`) |
| `if6` | JSON-with-comments parser (`cg6`, `Ax`, `N`) |
| `qhA` | JSON AST patch helper (keybinding insert/modify) |
| `ha8` | JSON AST patch helper variant (used by Cursor/Windsurf paths) |
| `ka8` | JSON insertion-index calculator (`oyA`) |
| `oyA` | JSON array element inserter |
| `ya8` | JSON property modifier |
| `dg6` | JSON substring extractor for patch |
| `fh` | Hyperlink/URL formatter for terminal output |
| `eX` | Hyperlink support detector |
| `H9` | Error-code classifier (`ENOENT`, `EACCES`, etc.) |
| `G8` | Generic error constructor/wrapper |
| `xY_` | Config file writer with file-lock and backup rotation |
| `ZDH` | Config file reader with parse and access guard |
| `bY_` | Config backup file writer |
| `If6` | Atomic file write helper (temp + rename, fchmod, fsync) |
| `uY_` | Backup rotation path builder |
| `qYq` | Lock acquisition helper |
| `az` | Project-level config writer |
| `fY6` | Config merge/diff utility |
| `SdH` | Config schema validator |
| `RdH` | Config timestamp checker |
| `N` | Logging/output renderer (debug, stdout, coloring) |
| `SH` | JSON serializer wrapper |
| `lmK` | Log level controller |
| `rmK` | File-write throttle / rate limiter |
| `PmH` | Output padding helper |
| `x4` | Log-line formatter |
| `gO` | Session/project initializer |
| `l89` | CLAUDE.md path resolver |
| `aX_` | Workspace root locator |
| `jg6` | Directory traversal helper |
| `d6` | File existence checker |
| `t6` | Feature-flag / setting reader (calls `d`) |
| `d` | Low-level async I/O primitive |
| `m6` | JSON.parse wrapper |
| `$2_` | Array type guard for keybinding arrays |
| `O2_` | Config read-only accessor |
| `M2_` | Config record builder variant |
| `L2_` | Config record builder variant (light) |
| `f2_` | Config record builder variant (fallback) |
| `K2_` | Config record builder variant (keyed) |
| `kyL` | Config key normalizer |
| `l18` | Terminal product-name string resolver |
| `r6` | Result/status renderer |
| `Y` | Process exit / abort wrapper |
| `z` | Daemon lifecycle controller |
| `hH` | Daemon stop (ok) handler |
| `RH` | Daemon stop (error) handler |
| `Qy` | Daemon control dispatcher |
| `_p` | Race/all Promise coordinator for daemon shutdown |
| `n9` | Network queue manager ("essential-traffic") |
| `T14` | Queue shift/push rotator |
| `d_` | Error normalizer (Error + String coercion) |
| `FH` | String coercion helper |
| `LJ` | Forced-shutdown label constant |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.