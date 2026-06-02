---
type: feature-spec
feature: "terminal-setup"
cc_version: "2.1.159"
updated: "2026-06-02"
tags: ["terminal-setup", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.159 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/terminal-setup`

> Analysis basis: CC v2.1.159 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.159

---

## Overview

`/terminal-setup` installs a Shift+Enter key binding in the user's current terminal emulator so that pressing Shift+Enter sends a newline instead of submitting input. It detects the active terminal environment, applies the appropriate configuration file edits (with backup/restore safety), and reports success or failure. The command is macOS/desktop-focused; VS Code-family editors (VS Code, Cursor, Windsurf), Alacritty, Zed, Apple Terminal, and iTerm2 are each handled by dedicated sub-routines.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `terminal-setup` |
| description | Install Shift+Enter key binding for newlines |
| loc_byte | `12088403` |
| loc_byte_end | `12089035` |
| loc_line | `8011` |
| module_id | `rH9` |
| load_inline | `true` |
| arbor_handler.name | `EJ7` |
| arbor_handler.fqn | `claude-2.1.159::EJ7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.159 bundle.js:+12088403

---

## Input Branching

The handler `EJ7` selects one of several terminal-specific sub-handlers based on runtime environment detection, yielding more than three distinct execution paths. A Mermaid flowchart is therefore used.

```mermaid
flowchart TD
    START(["/terminal-setup invoked"]) --> PLATFORM{platform == 'darwin'?}

    PLATFORM -- "No (non-macOS)" --> NONMAC[Run VS Code-family path\nor report unsupported]
    PLATFORM -- "Yes (macOS)" --> DETECT_TERM{Detect $TERM_PROGRAM\n/ process ancestry}

    DETECT_TERM --> ITERM{"iTerm2 / iTerm.app?"}
    DETECT_TERM --> VSCODE_FAM{"vscode / cursor /\nwindsurf?"}
    DETECT_TERM --> APPLE_TERM{"Apple_Terminal?"}
    DETECT_TERM --> ALACRITTY{"alacritty?"}
    DETECT_TERM --> ZED{"zed?"}
    DETECT_TERM --> OTHER["Emit info: terminal\nalready supports\nShift+Enter natively\nor unsupported"]

    ITERM --> iH9_FLOW[iH9: iTerm2 clipboard\n& key-binding setup]
    iH9_FLOW --> ITERM_CHECK{AllowClipboardAccess\nalready set?}
    ITERM_CHECK -- Yes --> ITERM_SKIP["Log: already enabled"]
    ITERM_CHECK -- No --> ITERM_WRITE["defaults write\ncom.googlecode.iterm2\nAllowClipboardAccess"]
    ITERM_WRITE --> ITERM_OK["Success message\n+ restart note"]

    VSCODE_FAM --> H18_DISPATCH[H18: dispatch to\nper-editor sub-handler]
    H18_DISPATCH --> bX_["bX_: VS Code\nkeybindings.json install"]
    H18_DISPATCH --> CX_["CX_: Cursor\nkeybindings.json install"]
    H18_DISPATCH --> s98["s98: Windsurf\nkeybindings.json install"]

    bX_ & CX_ & s98 --> KB_FLOW[Read keybindings.json\n(create if absent)\nBackup → patch → write]
    KB_FLOW --> KB_OK["Success or error message"]

    APPLE_TERM --> vJ7_FLOW[vJ7: Apple Terminal\nplist manipulation]
    vJ7_FLOW --> BACKUP{Backup plist\nsucceeded?}
    BACKUP -- No --> BAIL["Error: Failed to create\nbackup; bailing out"]
    BACKUP -- Yes --> READ_PROF{Read Default Window\nSettings profile}
    READ_PROF -- Error --> ERR_PROF["Error: Failed to read\ndefault profile"]
    READ_PROF -- OK --> PATCH_PROF["PlistBuddy: set\nOption-as-Meta + visual bell\nfor each profile"]
    PATCH_PROF --> KILL_PREF["killall cfprefsd"]
    KILL_PREF --> REPORT["Success: list applied\nchanges + restart note"]
    PATCH_PROF -- All failed --> WARN_FAIL["Warning: Failed to enable\nOption as Meta key or\ndisable audio bell"]

    ALACRITTY --> NJ7_FLOW[NJ7: Alacritty\nalacritty.toml install]
    NJ7_FLOW --> AL_FIND{Locate alacritty.toml\nacross known paths}
    AL_FIND -- Not found --> AL_ERR["Error: No valid config\npath found for Alacritty"]
    AL_FIND -- Found --> AL_CHECK{Binding already\npresent?}
    AL_CHECK -- Yes --> AL_SKIP["Log: already configured"]
    AL_CHECK -- No --> AL_BACKUP["Backup existing config"]
    AL_BACKUP -- Error --> AL_BAIL["Error: backup failed;\nbailing out"]
    AL_BACKUP -- OK --> AL_WRITE["Append [keyboard.bindings]\nShift+Return section"]
    AL_WRITE --> AL_OK["Success + restart note"]

    ZED --> IJ7_FLOW[IJ7: Zed keymap.json install]
    IJ7_FLOW --> ZED_CHECK{shift-enter binding\nalready present?}
    ZED_CHECK -- Yes --> ZED_SKIP["Log: already configured"]
    ZED_CHECK -- No --> ZED_BACKUP["Backup existing keymap"]
    ZED_BACKUP -- Error --> ZED_BAIL["Error: backup failed;\nbailing out"]
    ZED_BACKUP -- OK --> ZED_WRITE["Insert Terminal /\nterminal::SendText entry\ninto keymap array"]
    ZED_WRITE --> ZED_OK["Success message"]
```

---

## Behavioral Spec

### Top-level handler (`EJ7`)

The Arbor-resolved handler for this command is `EJ7` (an `AsyncFunction` reached via `module_id → rH9`).

Analysis basis: CC v2.1.159 bundle.js:+3962384

```
async function terminalSetupHandler(context):
    currentPlatform = os.platform()              // v6H.platform :+3962384

    if currentPlatform != "darwin":
        // Non-macOS: still may proceed for VS Code-family detection
        // but most sub-handlers are macOS-gated

    terminalName = detectTerminalEmulator()      // iH9 :+3962581
    displayName  = resolveDisplayName(terminalName)

    if terminalName includes "iterm" or "iTerm.app":
        result = await setupITerm2(context)      // iH9 :+3962581

    elif terminalName in ["vscode","cursor","windsurf"]:
        result = await setupVSCodeFamily(context, terminalName)  // H18 :+3963855

    else:
        // Emit informational note about native support or unsupported terminal
        // Literals: "Note: iTerm2, WezTerm..." :+3963713
        //           "Note: You can already use backslash..." :+3963378
        emitInfoNote(terminalName)
        return

    renderResult(result)
```

### Terminal detection (`iH9`)

Analysis basis: CC v2.1.159 bundle.js:+3961376

```
async function detectAndSetupITerm2(context):
    // Check $TERM_PROGRAM / process tree for "iTerm.app" or "screen"
    // :+3962486, :+3962535
    label = styled("iTerm.app", j6.dim)          // dim styling :+3961376

    rawOutput = await runCommand(
        ["defaults", "read", "com.googlecode.iterm2", "AllowClipboardAccess"]
    )                                             // :+3961419

    alreadySet = rawOutput.trim() matches truthy value  // :+3961500
    if alreadySet:
        renderMessage("iTerm2 clipboard access already enabled")  // :+3961540
        return successResult

    await runCommand([
        "defaults", "write", "com.googlecode.iterm2",
        "AllowClipboardAccess", "-bool", "true"
    ])                                            // :+3961628, :+3961683

    on error:
        renderMessage("Couldn't update iTerm2 clipboard setting.")  // :+3961734
        return errorResult

    renderMessage(
        'Enabled "Applications in terminal may access clipboard" in iTerm2'
    )                                             // :+3961825
    renderNote(
        "Restart iTerm2 for this to take effect. Undo: defaults write ..."
    )                                             // :+3961908
    return successResult
```

### VS Code-family dispatcher (`H18`)

Analysis basis: CC v2.1.159 bundle.js:+3960630

```
async function setupVSCodeFamily(context, terminalIdent):
    // Dispatch to per-editor handler based on detected editor name
    // Literals checked: "vscode" :+3960443, "cursor" :+3960467, "windsurf" :+3960491
    // Also checks for server variants: ".vscode-server" :+3959958,
    //   ".cursor-server" :+3959988, ".windsurf-server" :+3960018

    if terminalIdent == "vscode":
        return await installVSCodeKeybinding(context)   // bX_ :+3960664
    elif terminalIdent == "cursor":
        return await installCursorKeybinding(context)   // CX_ :+3960689
    elif terminalIdent == "windsurf":
        return await installWindsurfKeybinding(context) // s98 :+3960714
```

### VS Code keybinding install (`bX_`)

Analysis basis: CC v2.1.159 bundle.js:+3967475

```
async function installVSCodeKeybinding(context):
    label = styled("VSCode", j6.dim)             // :+3967460, :+3967943

    configDir = resolveVSCodeConfigDir()          // _18: checks platform/homedir :+3968127
    keybindingsPath = path.join(configDir, "keybindings.json")  // :+3968136

    await fs.mkdir(configDir, { recursive: true })   // :+3968176
    raw = await fs.readFile(keybindingsPath, "utf-8")
          ?? "[]"                                 // :+3968209, :+3968236

    parsed = parseJSON(raw)                       // eL6 :+3968277
    alreadyHasBinding = findBinding(parsed, "shift+enter")  // :+3968595

    if alreadyHasBinding:
        // already configured — no-op

    backupPath = keybindingsPath + "." + randomHex()  // BcH.randomBytes :+3968327
    await fs.copyFile(keybindingsPath, backupPath)    // :+3968390

    newBinding = {
        key: "shift+enter",                       // :+3968595
        command: "workbench.action.terminal.sendSequence",  // :+3968617
        args: { text: "\x1b\r" },                 // ESC+CR :+3968669
        when: "terminalFocus"                     // :+3968684
    }
    updatedArray = insertBinding(parsed, newBinding)  // jkA :+3969073

    await fs.writeFile(keybindingsPath, serialize(updatedArray))  // :+3969095

    on error:
        renderError(...)
        return warningResult                      // :+3967493
```

### VS Code config directory resolution (`_18`)

Analysis basis: CC v2.1.159 bundle.js:+3964484

```
function resolveVSCodeConfigDir(editorName):
    platform = os.platform()                     // v6H.platform :+3964506
    home     = os.homedir()                      // v6H.homedir  :+3964492

    if platform == "win32":
        return path.join(home, "AppData", "Roaming", editorName, "User")
        // literals: "win32" :+3964523, "AppData" :+3964539,
        //           "Roaming" :+3964549, "User" :+3964561
    elif platform == "darwin":
        return path.join(home, "Library", "Application Support", editorName, "User")
        // literals: "Application Support" :+3964613
    else:
        return path.join(home, ".config", editorName, "User")
        // literal: ".config" :+3964653

    // editorName is "Code" :+3964468 for VS Code
```

### Cursor keybinding install (`CX_`)

Analysis basis: CC v2.1.159 bundle.js:+3964704

```
async function installCursorKeybinding(context):
    // Same flow as installVSCodeKeybinding, but:
    //   editor display name = "Cursor" :+3960761
    //   config dir resolves using "Cursor" rather than "Code"
    //   additionally reads settings.json to check for GPU/SSH settings
    //     key "terminal_setup_gpu_accel" :+3965991
    //     key "remote_ssh" :+3966018
    //   error tags: "not_json_object" :+3966241,
    //               "write_failed" :+3966585,
    //               "backup_failed" :+3966806
    // Backup → patch keybindings.json → write
    // On success render styled result :+3964973
```

### Windsurf keybinding install (`s98`)

Analysis basis: CC v2.1.159 bundle.js:+3965870

```
async function installWindsurfKeybinding(context):
    // Same keybinding flow as VS Code/Cursor but:
    //   editor display name = "Windsurf" :+3960856
    //   reads "settings.json" :+3964825, default content "{}" :+3964852
    //   also checks GPU acceleration and remote SSH conditions
    //     "terminal_setup_gpu_accel" :+3965991, "remote_ssh" :+3966018
    //   Backup → patch → write
```

### Apple Terminal plist manipulation (`vJ7`)

Analysis basis: CC v2.1.159 bundle.js:+3970209

```
async function setupAppleTerminal(context):
    // Step 1: create backup of Terminal.app preferences plist
    plistPath = path.join(homedir(), "Library", "Preferences",
                          "com.apple.Terminal.plist")
    // literals :+3956467, :+3956477, :+3956491

    backupOk = await backupPlist(plistPath)       // BH9 :+3970237
    if not backupOk:
        throw Error("Failed to create backup of Terminal.app preferences, bailing out")
        // :+3970255

    // Step 2: export plist to known temp path
    await runCommand(["defaults", "export", "com.apple.Terminal", tempPath])
    // literals: "defaults" :+3956590, "export" :+3956602,
    //           "com.apple.Terminal" :+3956611

    // Step 3: read default profile name
    defaultProfile = await readPlistKey("Default Window Settings")
    // :+3970393
    if error:
        throw Error("Failed to read default Terminal.app profile")  // :+3970453

    startupProfile = await readPlistKey("Startup Window Settings")
    // :+3970570
    if error:
        throw Error("Failed to read startup Terminal.app profile")  // :+3970630

    // Step 4: apply PlistBuddy edits to each profile via dH9 / cH9
    //   dH9: set "Option as Meta key" via /usr/libexec/PlistBuddy :+3969482
    //   cH9: set visual bell (disable audio bell)
    results = []
    for each profile in [defaultProfile, startupProfile]:
        metaResult  = await setPlistBuddyOption(profile, "OptionMeta")  // dH9 :+3970710
        bellResult  = await setPlistBuddyBell(profile)                  // cH9 :+3970725
        results.push({ metaResult, bellResult })

    // Step 5: kill cfprefsd to flush preferences
    if any result succeeded:
        await runCommand(["killall", "cfprefsd"])  // :+3970939, :+3970950
        pcH(...)                                   // flush / re-import :+3970963
    else:
        renderWarning("Failed to enable Option as Meta key or disable audio bell for any Terminal.app profile")
        // :+3970840

    // Step 6: render outcome
    successLines = []
    if optionMetaApplied:
        successLines.push('- Enabled "Use Option as Meta key"')  // :+3971059
    if bellApplied:
        successLines.push("- Switched to visual bell")           // :+3971121

    renderSuccess("Configured Terminal.app settings:")           // :+3970992
    renderLines(successLines)

    // Step 7: report keybinding result
    //   "Shift+Return will now enter a newline."  :+3971166
    //   "Option+Enter will now enter a newline."  :+3971215
    //   "You must restart Terminal.app for changes to take effect."  :+3971300
```

### PlistBuddy sub-command runner (`dH9`)

Analysis basis: CC v2.1.159 bundle.js:+3969479

```
async function runPlistBuddyCommand(profile, command, args):
    argv = ["/usr/libexec/PlistBuddy", "-c", command, ...args]
    // :+3969482, :+3969509
    output = await runCommandCapture(argv)        // v8 :+3969479
    configDir = resolveConfigPath()               // UcH :+3969575
    result = await emitTelemetry(output)          // N :+3969726
    return result
```

### Apple Terminal plist backup / restore (`r98`)

Analysis basis: CC v2.1.159 bundle.js:+3956848

```
async function backupAndVerifyPlist(plistPath):
    // GJ7: resolve backup destination :+3956848
    backupDest = resolveBackupPath(plistPath)     // GJ7 → h6 :+3956320
    pcH(...)                                      // config flush :+3956900

    stat = await fs.stat(plistPath)              // kX_.stat :+3956937
    if not stat.exists:
        return { status: "no_backup" }           // :+3956874

    await runCommand(["defaults", "export", ...]) // v8 :+3957011
    on error:
        SH(...)                                   // error handler :+3957188
        return { status: "failed" }              // :+3957083

    return { status: "restored" | "no_backup" }  // :+3957160
```

### Alacritty config install (`NJ7`)

Analysis basis: CC v2.1.159 bundle.js:+3971915

```
async function installAlacrittyKeybinding(context):
    // Candidate paths for alacritty.toml on macOS/Linux/Windows
    candidates = buildAlacrittyConfigPaths(homedir(), platform())
    // NJ7 uses v6H.homedir :+3971983, v6H.platform :+3972041
    // Filename literal: "alacritty.toml" :+3971944

    configPath = candidates.find(p => fileExists(p))
    if not configPath:
        throw Error("No valid config path found for Alacritty")  // :+3972307

    content = await fs.readFile(configPath, "utf-8")
    alreadyConfigured = content.includes('mods = "Shift"')  // :+3972375
                     && content.includes('key = "Return"')  // :+3972405
    if alreadyConfigured:
        renderInfo("Alacritty Shift+Enter key binding already configured")  // :+3972448
        return

    backupPath = configPath + "." + randomHex()
    try:
        await fs.copyFile(configPath, backupPath)   // :+3972610
    catch:
        throw Error("Error backing up existing Alacritty config. Bailing out.")  // :+3972658

    appendedContent = content + ALACRITTY_BINDING_TOML_BLOCK
    await fs.writeFile(configPath, appendedContent)

    on success:
        renderSuccess("Installed Alacritty Shift+Enter key binding")  // :+3973032
        renderNote("You may need to restart Alacritty for changes to take effect")  // :+3973102
    on error:
        renderError("Failed to install Alacritty Shift+Enter key binding")  // :+3973327
```

### Zed keymap install (`IJ7`)

Analysis basis: CC v2.1.159 bundle.js:+3973411

```
async function installZedKeybinding(context):
    home        = os.homedir()                   // v6H.homedir :+3973419
    keymapPath  = path.join(home, ".config", "zed", "keymap.json")
    // literal: "keymap.json" :+3973462

    await fs.mkdir(path.dirname(keymapPath), { recursive: true })  // :+3973487
    raw     = await fs.readFile(keymapPath, "utf-8") ?? "[]"       // :+3973542
    parsed  = parseJSON(raw)                                        // oq :+3973594

    alreadyHasBinding = parsed.includes("shift-enter")  // :+3973617, :+3973628
    if alreadyHasBinding:
        renderInfo("Zed Shift+Enter key binding already configured")  // :+3973668
        return

    backupPath = keymapPath + "." + randomHex()
    try:
        await fs.copyFile(keymapPath, backupPath)   // :+3973824
    catch:
        throw Error("Error backing up existing Zed keymap. Bailing out.")  // :+3973872

    newEntry = {
        context: "Terminal",                     // :+3974081
        bindings: {
            "shift-enter": "terminal::SendText"  // :+3974117
        }
    }
    if Array.isArray(parsed):
        parsed.push(newEntry)                    // :+3974065
    else:
        parsed = [newEntry]

    await fs.writeFile(keymapPath, JSON.stringify(parsed, null, 2))  // :+3974157
    // RH (JSON.stringify wrapper) :+3974172

    on success:
        renderSuccess("Installed Zed Shift+Enter key binding")  // :+3974228
    on error:
        renderError("Failed to install Zed Shift+Enter key binding")  // :+3974437
```

### Run-command utility (`v8` / `T_` / `R6`)

Analysis basis: CC v2.1.159 bundle.js:+1049661

```
async function runSubprocess(argv, options):
    // T_: spawn child process, collect stdout/stderr
    //   timeout constant: 1 000 000 ms :+1050128
    //   queue depth limit: 10 :+1049606
    //   success exit code: 0, error tag: "error" :+1050555
    //   retry count: 1 :+1050251
    // R6: resolves result object → rB6 (stdout parser) + O_ (error mapper)
    //   :+976313, :+976332
    result = await spawnAndCollect(argv)
    return { stdout, stderr, exitCode }
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_config_auth_loss_prevented` (:+3206325); `tengu_bg_spare_enable` (:+15468826); `tengu_bg_low_mem_mb` (:+12731249); `tengu_daemon_control` (:+15505330); `tengu_bg_spare_spawn` (:+15469186); `tengu_feature_sad` (:+966168); `tengu_feature_ok` (:+966033); `tengu_config_lock_contention` (:+3209057); `tengu_config_stale_write` (:+3209193); `tengu_config_parse_error` (:+3211632) |
| Filesystem writes | `keybindings.json` (VS Code / Cursor / Windsurf), `settings.json` (Cursor/Windsurf), `alacritty.toml` (Alacritty), `keymap.json` (Zed), `com.apple.Terminal.plist` (Apple Terminal) — all with atomic backup via `BcH.randomBytes`-named copy before overwrite |
| Filesystem reads | Plist, keybindings, keymap, and settings files as above; `kX_.stat` used to check plist existence before backup |
| External process spawns | `defaults export`, `defaults read`, `defaults write`, `/usr/libexec/PlistBuddy`, `killall cfprefsd` (all macOS only); generic `v8` subprocess runner for all child processes |
| appState changes | `onboarding_project_complete` event emitted on successful terminal configuration (:+3955805) |
| Config lock | Uses config write-lock (`YY_` / `mz`) with contention telemetry; lock acquisition > expected duration emits `tengu_config_lock_contention` (:+3208968) |
| Sound | None detected |
| Hook registration | None detected |

---

## Version History

| Version | Change |
|---|---|
| v2.1.159 | Initial analysis |

---

## Common Mistakes

1. **Running on an unsupported terminal**: The command only applies changes to Apple Terminal, iTerm2, VS Code, Cursor, Windsurf, Alacritty, and Zed. Running it in WezTerm, Ghostty, Kitty, Warp, or Windows Terminal will emit an informational note ("already supported natively") and make no changes.
2. **Skipping the restart step**: Every sub-handler that writes config files notes that the terminal application must be restarted for the key binding to take effect (e.g., `:+3971300`, `:+3973102`). Changes are written to disk but are not hot-reloaded by the terminal.
3. **Conflicting manual keybindings**: If `shift+enter` / `shift-enter` already appears in `keybindings.json` or `keymap.json`, the handler skips re-installation silently. A pre-existing binding with a *different* command will not be overwritten; manual inspection is required.
4. **Permission errors on plist**: On macOS with SIP or restricted home directories, `defaults write` may return `EACCES` / `EPERM` (:+174596, :+174610). The command propagates these as error messages but does not escalate privileges.
5. **Running outside macOS for Apple Terminal path**: The plist-based Apple Terminal flow is macOS-only; attempting to invoke that branch on Linux or Windows (e.g., via a mis-set `$TERM_PROGRAM`) will fail at the `defaults` command invocation.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `EJ7` | Top-level async handler for `/terminal-setup` (Arbor-resolved) |
| `H18` | VS Code-family dispatcher; routes to per-editor sub-handlers |
| `iH9` | iTerm2 setup sub-handler (clipboard access + key binding) |
| `vJ7` | Apple Terminal plist manipulation handler |
| `bX_` | VS Code `keybindings.json` install sub-handler |
| `CX_` | Cursor `keybindings.json` install sub-handler |
| `s98` | Windsurf `keybindings.json` install sub-handler |
| `NJ7` | Alacritty `alacritty.toml` install sub-handler |
| `IJ7` | Zed `keymap.json` install sub-handler |
| `dH9` | PlistBuddy sub-command runner (Option-as-Meta key) |
| `cH9` | PlistBuddy sub-command runner (visual bell) |
| `BH9` | Plist backup orchestrator |
| `UcH` | Home-directory config path resolver (joins `Library/Preferences/...`) |
| `r98` | Apple Terminal plist backup and verify utility |
| `GJ7` | Backup destination path resolver |
| `pcH` | Config flush / plist re-import utility |
| `v8` | Generic subprocess spawn-and-collect utility |
| `T_` | Core process spawn primitive (timeout, queue depth) |
| `R6` | Subprocess result resolver (stdout parser + error mapper) |
| `rB6` | Stdout parsing helper called by `R6` |
| `O_` | Error mapping helper called by `R6` |
| `_18` | VS Code config directory resolver (platform/homedir-aware) |
| `e98` | Terminal-program string matcher (checks `$TERM_PROGRAM` / process list) |
| `eL6` | JSON parse wrapper used for keybindings files |
| `nb` | String prefix-check / slice helper |
| `jkA` | Keybinding array insert logic (VS Code format) |
| `To8` | Keybinding array insert logic (alternate, used by CX_ / s98) |
| `Wo8` | JSON AST insert-node helper |
| `Go8` | JSON AST overlapping-edit helper |
| `fkA` | Core JSON document mutation function |
| `FF6` | JSON substring extraction helper |
| `UX_` | Array type-check helper |
| `oq` | Lightweight JSON parse wrapper (used for Zed keymap) |
| `ty` | Hyperlink / URL formatter for terminal output |
| `cP` | Hyperlink support detector |
| `FD` | FORCE_HYPERLINK environment check |
| `YA` | ANSI colour-code renderer dispatcher |
| `zYH` | Full ANSI 256-colour / RGB / named-colour renderer |
| `jd` | Fallback plain-text colour renderer |
| `z8` | Global config read (lock-aware) |
| `mz` | Current-project config save (lock-aware) |
| `YY_` | Config save-with-lock implementation |
| `tzH` | Config file reader |
| `zY_` | Atomic config file writer |
| `DY_` | Config backup path builder |
| `CL6` | Atomic file write with permission preservation |
| `tOq` | Config lock primitive |
| `$Y6` | Config post-write validator |
| `mcH` | Onboarding project complete event emitter |
| `hO` | Onboarding render helper |
| `xH9` | Workspace config path resolver |
| `IX_` | CLAUDE.md existence checker |
| `YF6` | CLAUDE.md file loader |
| `G6` | Telemetry event emitter |
| `h6` | Telemetry event builder (Date.now timestamp) |
| `K_8` | Telemetry dedup guard |
| `SH` | Async task queue / error log |
| `F_` | Error formatter |
| `CH` | String cast utility |
| `L1` | Essential-traffic logger |
| `I_4` | Task queue shift/push manager |
| `N` | API call / network request dispatcher |
| `tCK` | Request serialiser |
| `RH` | JSON.stringify wrapper |
| `E4` | Path/token redactor ("[REDACTED]") |
| `vuH` | Colour theme selector |
| `_bK` | Config write helper with byte-length guard |
| `AvH` | Platform string helper |
| `BX_` | VS Code-family read-only config inspector |
| `VJ7` | Config inspector result renderer |
| `pX_` | Onboarding step: project pX_ action |
| `uX_` | Onboarding step: project uX_ action |
| `mX_` | Onboarding step: project mX_ action |
| `xX_` | Onboarding step: project xX_ action |
| `D` | Background daemon process manager |
| `TfA` | Daemon spawn implementation (Bun.spawn) |
| `Fy8` | Daemon low-memory monitor |
| `Xs1` | Daemon dispose/cleanup handler |
| `M` | Process reference with unref/kill methods |
| `G1` | Daemon stdio stream handler |
| `Sh1` | Daemon stdout path builder |
| `Rh1` | Daemon stderr path builder |
| `al` | Daemon spare-process socket path builder |
| `QB5` | Daemon IPC setup helper |
| `gT` | Daemon environment builder |
| `UB5` | Daemon argument assembler |
| `z` | Daemon stop result handler |
| `P` | SDK connection manager |
| `WJ7` | Subprocess wrapper for plist commands |
| `hH` | Feature-ok telemetry helper |
| `t6` | Feature-context builder |
| `BQH` | Config before-read hook |
| `FQH` | Config timestamp recorder |
| `AY6` | Telemetry init helper |
| `qY6` | Telemetry session ID helper |
| `Ix` | Telemetry string normaliser |
| `Nx` | Telemetry null-check |
| `w8` | Async error boundary |
| `Iz` | Promise timeout wrapper |
| `d` | Logger (debug/warn) |
| `U6` | JSON.parse wrapper |
| `o98` | Terminal display-name resolver |