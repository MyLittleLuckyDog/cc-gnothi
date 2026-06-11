---
type: feature-spec
feature: "terminal-setup"
cc_version: "2.1.169"
updated: "2026-06-11"
tags: ["terminal-setup", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.169 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/terminal-setup`

> Analysis basis: CC v2.1.169 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.169

---

## Overview

`/terminal-setup` installs a Shift+Enter key binding (and related settings) into the user's current terminal emulator so that pressing Shift+Enter inserts a newline rather than submitting input. It detects the active terminal application at runtime, applies the appropriate configuration strategy for each supported emulator, creates a backup of existing configuration before modifying it, and reports the applied changes to the user.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `terminal-setup` |
| description | Install Shift+Enter key binding for newlines |
| loc_byte | 12518191 |
| loc_byte_end | 12518823 |
| loc_line | 8885 |
| module_id | `fM9` |
| load_inline | `true` |
| arbor_handler.name | `blL` |
| arbor_handler.fqn | `claude-2.1.169::blL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | 1 |

Analysis basis: CC v2.1.169 bundle.js:+12518191

---

## Input Branching

The command branches across 6+ distinct terminal-emulator paths plus a macOS-specific sub-branch, warranting a Mermaid flowchart.

```mermaid
flowchart TD
    A["/terminal-setup invoked"] --> B{platform == 'darwin'?}

    B -- yes --> C{Detect terminal emulator}
    B -- no  --> Z[Non-macOS path\ncall per-emulator handler\nbased on env detection]

    C --> D{TERM_PROGRAM / process env}

    D -- "Apple_Terminal" --> E[terminalAppHandler\nmodify com.apple.Terminal.plist\nvia defaults + PlistBuddy]
    D -- "iTerm.app / screen" --> F[iterm2Handler\nenable clipboard access\ndefaults write com.googlecode.iterm2]
    D -- "vscode / cursor / windsurf" --> G[vsCodeFamilyHandler\npatch keybindings.json\nshift+enter → sendSequence ESC+CR]
    D -- "alacritty" --> H[alacrittyHandler\npatch alacritty.toml\nmods=Shift key=Return]
    D -- "zed" --> I[zedHandler\npatch keymap.json\nshift-enter → terminal::SendText]
    D -- other / unknown --> J[Emit informational note\nno config changes made]

    E --> K{Backup existing plist?}
    K -- success --> L[Apply PlistBuddy commands\nEnable Option-as-Meta\nDisable audio bell]
    K -- failure --> M[Abort — emit error\n'Failed to create backup']
    L --> N{Any profile patched?}
    N -- yes --> O[killall cfprefsd\nEmit success lines]
    N -- no  --> P[Emit warning:\n'Failed to enable Option as Meta\nor disable audio bell for any profile']

    G --> Q{keybindings.json exists?}
    Q -- no  --> R[Create with empty array '[]']
    Q -- yes --> S[Read & parse existing JSON]
    S --> T{Binding already present?}
    T -- yes --> U[Skip — already configured]
    T -- no  --> V[Backup file\nInsert shift+enter entry\nWrite back]

    H --> W{Config path found?}
    W -- no  --> X[Abort — 'No valid config path found for Alacritty']
    W -- yes --> Y1{Binding already present?}
    Y1 -- yes --> Y2[Skip — already configured]
    Y1 -- no  --> Y3[Backup + append TOML block\nRestart advisory]

    I --> AA{keymap.json exists?}
    AA -- no  --> AB[Create with empty array]
    AA -- yes --> AC{Binding already present?}
    AC -- yes --> AD[Skip — already configured]
    AC -- no  --> AE[Backup + insert\nterminal::SendText entry\nWrite back]
```

Analysis basis: CC v2.1.169 bundle.js:+4048750 (platform check), +4046722 (terminal detection), +4043760 (Apple Terminal plist path), +4054753 (VSCode binding), +4058531 (Alacritty TOML), +4059617 (Zed keymap)

---

## Behavioral Spec

### Handler Entry Point (`blL`)

```
async function terminalSetupHandler(context):
    currentPlatform = os.platform()                    // +4048750

    // macOS-specific: detect iTerm2 vs others
    if currentPlatform == "darwin":
        terminalName = detectTerminal()                // DyH checks TERM_PROGRAM etc.
        if terminalName includes "iTerm.app":
            await iterm2Handler()                      // LM9  +4048946
        elif terminalName includes "screen":
            // screen is treated as iTerm context
            await iterm2Handler()

    // Determine emulator by environment variables
    emulatorTag = resolveEmulatorTag(currentPlatform)  // uM8 +4049077

    // Display informational notes for natively-supporting terminals
    // e.g. "iTerm2, WezTerm, Ghostty, Kitty, Warp, and Windows Terminal
    //       support Shift+Enter natively."              // +4050083

    // Dispatch to per-emulator installer
    await perEmulatorInstaller(emulatorTag)            // FM8 +4050225
```

Analysis basis: CC v2.1.169 bundle.js:+4048750, +4048946, +4049077, +4050225

---

### Terminal Detection (`DyH` / `detectTerminal`)

```
function detectTerminal(platform):
    // Reads process.env / ks.platform                 // +4046722
    if platform == "darwin":                           // +4046738
        // Checks TERM_PROGRAM for:
        //   "Apple_Terminal"                          // +4046762
        //   "vscode"                                  // +4046794
        //   "cursor"                                  // +4046818
        //   "windsurf"                                // +4046842
        //   "alacritty"                               // +4046868
        //   "zed"                                     // +4046895
    return matched terminal identifier string
```

Analysis basis: CC v2.1.169 bundle.js:+4046722–4046895

---

### Apple Terminal Handler (`ulL`)

The Apple Terminal path is the most complex, operating via `defaults` and `/usr/libexec/PlistBuddy`.

```
async function appleTerminalInstaller():
    plistPath = path.join(
        os.homedir(), "Library", "Preferences",       // +4043637, +4043647
        "com.apple.Terminal.plist"                     // +4043661
    )

    // Step 1: export current plist to a temp file
    run("defaults", "export", "com.apple.Terminal",   // +4043760, +4043772, +4043781
        tempFile)

    // Step 2: stat to confirm plist accessible         // +4043837

    // Step 3: create a backup via backupConfigFile()  // SlL +4043929
    if backup fails:
        throw Error("Failed to create backup of Terminal.app preferences, bailing out")
                                                       // +4056413

    // Step 4: read 'Default Window Settings' profile name
    defaultProfile = runPlistBuddy("Print", "Default Window Settings")
                                                       // +4056551
    if read fails:
        throw Error("Failed to read default Terminal.app profile")
                                                       // +4056611

    // Step 5: read 'Startup Window Settings' profile name
    startupProfile = runPlistBuddy("Print", "Startup Window Settings")
                                                       // +4056728
    if read fails:
        throw Error("Failed to read startup Terminal.app profile")
                                                       // +4056788

    // Step 6: collect all unique profile names, apply PlistBuddy patches
    // - Enable "Use Option as Meta key"               // +4057217
    // - Switch to visual bell                         // +4057279
    // Uses /usr/libexec/PlistBuddy                    // +4055640
    // with -c flag                                    // +4055667

    // Step 7: if no profile was successfully patched
    if noProfilePatched:
        emit warning("Failed to enable Option as Meta key or disable audio bell"
                     + " for any Terminal.app profile")  // +4056998

    // Step 8: kill cfprefsd to flush prefs            // +4057097, +4057108
    // (adds process name to kill list via D.push)     // +4057194

    // Step 9: emit success output
    emit("Configured Terminal.app settings:")          // +4057150
    emit("- Enabled \"Use Option as Meta key\"")       // +4057217
    emit("- Switched to visual bell")                  // +4057279
    emit("Shift+Return will now enter a newline.")     // +4057324
    emit("Option+Enter will now enter a newline.")     // +4057373
    emit("You must restart Terminal.app for changes to take effect.")
                                                       // +4057458
```

Analysis basis: CC v2.1.169 bundle.js:+4043637, +4055640, +4056413, +4056998, +4057097, +4057458

---

### iTerm2 Handler (`LM9` / `iterm2Handler`)

```
async function iterm2Handler():
    // Check com.googlecode.iterm2 AllowClipboardAccess  // +4047807, +4047831
    run("defaults", "read", "com.googlecode.iterm2",
        "AllowClipboardAccess")                        // +4047785

    alreadyEnabled = (output.trim() matches truthy)    // +4047866
    if alreadyEnabled:
        emit("iTerm2 clipboard access already enabled")  // +4047906
        return

    // Write the setting
    run("defaults", "write",                           // +4047994
        "com.googlecode.iterm2",
        "AllowClipboardAccess", "-bool", true)         // +4048049

    if write fails:
        emit warning("Couldn't update iTerm2 clipboard setting.")  // +4048100

    emit("Enabled \"Applications in terminal may access clipboard\" in iTerm2")
                                                       // +4048191
    emit("Restart iTerm2 for this to take effect. Undo: defaults write"
         + " com.googlecode.iterm2 AllowClipboardAccess -bool false")
                                                       // +4048274
```

Analysis basis: CC v2.1.169 bundle.js:+4047785, +4047831, +4048100, +4048274

---

### VS Code Family Handler (`MN_` / `vsCodeFamilyHandler`)

Covers VS Code, Cursor, Windsurf, and Devin environments detected by server-directory markers (`.vscode-server`, `.cursor-server`, `.windsurf-server`, `.devin-server`). Analysis basis: CC v2.1.169 bundle.js:+4046241–4046344.

```
async function vsCodeFamilyHandler(editorName):
    // editorName one of: "VSCode" (+4053612), "Cursor" (+4047112),
    //                    "Devin Desktop" (+4047207)

    configDir  = resolveVSCodeConfigDir()              // YS.join +4054294
    configFile = path.join(configDir, "keybindings.json")  // +4054304

    // Create dir if absent                            // s2.mkdir +4054334
    raw = readFile(configFile) || "[]"                 // +4054367, +4054394

    parsed = parseKeyBindings(raw)                     // BO6 +4054435

    // Check if shift+enter binding already present    // +4054753
    binding = {
        key:     "shift+enter",                        // +4054753
        command: "workbench.action.terminal.sendSequence",  // +4054775
        args:    { text: "\x1b\r" },                   // +4054827  (ESC + CR)
        when:    "terminalFocus"                        // +4054842
    }

    if alreadyPresent(parsed, binding):
        return  // idempotent

    // Backup existing file with random hex suffix     // EoH.randomBytes +4054485, hex +4054513
    backupFile(configFile)                             // s2.copyFile +4054548

    // Insert new binding and write back               // s2.writeFile +4055253
    emit success with editor name                      // N +4055412
```

Analysis basis: CC v2.1.169 bundle.js:+4053627, +4054294, +4054753, +4054827

---

### Alacritty Handler (`mlL` / `alacrittyHandler`)

```
async function alacrittyHandler():
    // Resolve config path candidates:
    //   - ~/.config/alacritty/alacritty.toml          // +4058102, +4058154
    //   - platform-specific paths (win32 excluded)    // +4058214
    candidates = buildCandidateList()                  // A.push +4058073, ks.homedir +4058141

    configPath = findExistingCandidate(candidates)     // s2.readFile +4058350

    if no candidate found:
        throw Error("No valid config path found for Alacritty")  // +4058463

    content = readFile(configPath)

    // Idempotency check
    if content includes 'mods = "Shift"'               // +4058531
    and content includes 'key = "Return"':             // +4058561
        emit("Alacritty Shift+Enter key binding already configured")  // +4058604
        return

    // Backup
    backup = copyFileWithRandomSuffix(configPath)      // EoH.randomBytes +4058703
    if backup fails:
        throw Error("Error backing up existing Alacritty config. Bailing out.")  // +4058814

    // Create parent dirs if needed                    // s2.mkdir +4058962
    // Append TOML key binding block                   // s2.writeFile +4059132
    // Block ends with newline if file doesn't end with one  // L.endsWith +4059016

    emit("Installed Alacritty Shift+Enter key binding")  // +4059188
    emit("You may need to restart Alacritty for changes to take effect")  // +4059258

    if install fails:
        emit error("Failed to install Alacritty Shift+Enter key binding")  // +4059483
```

Analysis basis: CC v2.1.169 bundle.js:+4058102, +4058463, +4058531, +4058814, +4059188

---

### Zed Handler (`plL` / `zedHandler`)

```
async function zedHandler():
    keymapPath = path.join(os.homedir(), "keymap.json")  // +4059617, ks.homedir +4059575

    // Create parent dir if absent                    // s2.mkdir +4059642
    raw = readFile(keymapPath) || "[]"               // s2.readFile +4059697

    parsed = parseJSON(raw)                          // j9 +4059749

    // Idempotency: check for "shift-enter"           // +4059783
    if alreadyContains(parsed, "shift-enter"):
        emit("Zed Shift+Enter key binding already configured")  // +4059823
        return

    // Backup
    backupFile(keymapPath)                           // EoH.randomBytes +4059916
    if backup fails:
        throw Error("Error backing up existing Zed keymap. Bailing out.")  // +4060027

    // Build entry and push into parsed array
    entry = {
        context: "Terminal",                         // +4060236
        bindings: {
            "shift-enter": "terminal::SendText",     // +4059783, +4060272
            // text payload: ESC+CR sequence
        }
    }
    parsed.push(entry)                               // L.push +4060220
    writeFile(keymapPath, JSON.stringify(parsed))    // s2.writeFile +4060312, CH +4060327

    emit("Installed Zed Shift+Enter key binding")    // +4060383

    if install fails:
        emit error("Failed to install Zed Shift+Enter key binding")  // +4060592
```

Analysis basis: CC v2.1.169 bundle.js:+4059567, +4059783, +4060236, +4060383

---

### Backup Utility (`xM8` / `backupAndRestoreManager`)

Used by all per-emulator handlers before modifying any configuration file.

```
async function backupAndRestoreManager(filePath):
    // Check file exists                              // _N_.stat +4044107
    // Copy to temporary path with random hex suffix  // b8 +4044181
    // On failure, record "no_backup" state           // +4044044

    // Expose restore function:
    async function restoreFromBackup():
        try:
            import backup into original location     // "import" +4044196
        catch:
            record "failed" state                    // +4044253
        finally:
            record "restored" state on success       // +4044330
```

Analysis basis: CC v2.1.169 bundle.js:+4044018, +4044044, +4044107, +4044196

---

### PlistBuddy Runner (`_M9` / `plistBuddyRunner`)

```
async function plistBuddyRunner(command, plistPath):
    // Executable: "/usr/libexec/PlistBuddy"          // +4055640
    // Always passes "-c" flag                        // +4055667
    // Constructs argument array: ["-c", command, plistPath]
    result = await spawnProcess(
        "/usr/libexec/PlistBuddy",
        ["-c", command, plistPath]
    )                                                // b8 +4055637, ToH +4055733
    return result.trim()
```

Analysis basis: CC v2.1.169 bundle.js:+4055637, +4055640, +4055667, +4055733

---

### Apple Terminal Profile Patch (`AM9` / `appleTerminalProfilePatcher`)

```
async function appleTerminalProfilePatcher(profileName, plistPath):
    // Runs PlistBuddy Set commands for the named profile
    // Sets UseOptionAsMetaKey = true
    // Sets VisualBell = true / AudioBell = false
    // Returns boolean indicating success             // N +4056245
```

Analysis basis: CC v2.1.169 bundle.js:+4056024, +4056107, +4056245

---

### Process Runner (`b8` / `spawnProcess`)

General-purpose child-process spawner used by all sub-handlers.

```
async function spawnProcess(command, args, options):
    // Queues command with concurrency limit (10)     // +1098455
    // Timeout after 1,000,000 ms                     // +1098977
    // On success: resolve with stdout
    // On error:   reject with stderr or error code
    // Logs errors via bo.logError                    // +1019718
```

Analysis basis: CC v2.1.169 bundle.js:+1098455, +1098510, +1098977, +1019718

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_ok` (+1013926), `tengu_feature_bad` (+1013988), `tengu_feature_sad` (+1014069), `tengu_config_auth_loss_prevented` (+3269463), `tengu_config_lock_contention` (+3272314), `tengu_config_stale_write` (+3272450), `tengu_config_parse_error` (+3274889), `tengu_daemon_control` (+16543552) |
| File writes | Per-emulator config files: `keybindings.json` (VS Code family), `alacritty.toml`, `keymap.json` (Zed), `com.apple.Terminal.plist` (Apple Terminal via `defaults import`) |
| Backup files | Each modified file receives a copy with a random hex-byte suffix before any write (+4054485, +4058703, +4059916) |
| `defaults` invocations | Reads and writes macOS user preferences for `com.apple.Terminal` and `com.googlecode.iterm2` |
| Process kills | `killall cfprefsd` queued after Apple Terminal plist modification to flush preference cache (+4057097, +4057108) |
| Process exit | Error paths in child-process utilities may call `process.exit` (+13208394, +16538634, +16539893) |
| stdout output | Uses `J6.dim` styling for progress messages; `success` / `warning` / `error` level messages emitted to terminal |
| Hook registration | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| Sound | None observed in traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.169 | Initial analysis |

---

## Common Mistakes

1. **Running on a non-macOS system for Terminal.app/iTerm2 paths** — the `com.apple.Terminal` and `com.googlecode.iterm2` paths are macOS-only. On non-macOS systems only VS Code-family, Alacritty, and Zed paths are active.
2. **Not restarting the terminal after setup** — changes to `com.apple.Terminal.plist`, `alacritty.toml`, and iTerm2 preferences require an application restart. The command explicitly warns about this (+4057458, +4059258).
3. **Multiple Claude instances sharing the same config file** — backup logic uses random hex suffixes to avoid collisions, but concurrent runs could still race on the write step. Run `/terminal-setup` from a single session.
4. **Assuming Shift+Enter works immediately in Apple Terminal** — `cfprefsd` must finish reloading. The command kills `cfprefsd` to accelerate this, but a full Terminal.app restart is still recommended.
5. **Terminals that support Shift+Enter natively** — iTerm2, WezTerm, Ghostty, Kitty, Warp, and Windows Terminal do not need this command (+4050083). Running `/terminal-setup` in those environments may still proceed but the note explains no configuration change is required.
6. **VSCode remote SSH environments** — the handler checks for a `remote_ssh` context (+4052164) and adjusts the config directory accordingly; manually editing `keybindings.json` in the wrong location will not take effect.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `blL` | Main async handler for `/terminal-setup` (Arbor-resolved entry point) |
| `DyH` | Terminal emulator detector — reads `TERM_PROGRAM` / `ks.platform` |
| `FM8` | Per-emulator installer dispatcher |
| `ulL` | Apple Terminal plist installer (full flow) |
| `e59` | Apple Terminal plist path resolver |
| `ToH` | Home-directory path builder |
| `b8` | Generic child-process spawner (spawnProcess) |
| `U_` | Process execution queue / concurrency limiter |
| `C6` | Process spawn helper |
| `SlL` | Backup file creator for Apple Terminal plist |
| `X8` | Config file writer with lock |
| `hH` | Process output handler / stderr logger |
| `wA` | Error constructor wrapper |
| `_6` | String coercion utility |
| `kq` | Essential-traffic queue manager |
| `av4` | Queue shift/push helper |
| `smH` | CLI error reporter (console.error + red coloring) |
| `ij` | File write + path join for CLI error output |
| `L` | Async task queue (add/delete/finally wrapper) |
| `f` | Task executor (close/finalize) |
| `A` | String lowercaser / task array |
| `_M9` | PlistBuddy runner |
| `AM9` | Apple Terminal per-profile patcher |
| `N` | Shell command executor / HTTP fetcher |
| `ItK` | HTTP request internals |
| `H` | Bootstrap HTTP fetch with headers |
| `CH` | JSON.stringify wrapper |
| `R4` | URL/path component extractor |
| `rBH` | Log entry formatter |
| `StK` | Config file write-with-lock |
| `GoH` | Config write helper using X8 |
| `hA` | Ink/chalk color prefix parser |
| `NJH` | ANSI/chalk color string renderer |
| `Jl` | Ink render helper |
| `D` | Process exit / abort list |
| `Bj` | Forced-shutdown message emitter |
| `z` | Daemon lifecycle manager |
| `SH` | Daemon start handler |
| `bH` | Daemon stop/failure handler |
| `rh` | Daemon control event emitter |
| `PU` | Promise race/all runner for daemon shutdown |
| `xM8` | Backup-and-restore manager |
| `RlL` | Backup file copy initiator |
| `y6` | Timestamped file operation helper |
| `MN_` | VS Code family keybindings installer |
| `BM8` | Server-directory (vscode-server etc.) detector |
| `BO6` | JSON value normalizer / string coercer |
| `Vu` | JSON string prefix stripper |
| `j9` | File error code classifier (ENOENT, EACCES, etc.) |
| `E8` | Error code constants |
| `DS` | File-URL resolver (pathToFileURL) |
| `o2` | Hyperlink environment detector |
| `HD` | Hyperlink builder |
| `QBA` | JSON keybinding insert helper |
| `v1_` | AST-based JSON insertion utility |
| `xBA` | JSON AST node inserter |
| `N1_` | JSON AST node remover |
| `wr6` | JSON AST substring extractor |
| `fN_` | VS Code settings.json patcher |
| `DN_` | Array.isArray guard |
| `I1_` | JSON keybinding replace helper |
| `pM8` | VS Code GPU acceleration / remote-SSH settings patcher |
| `o6` | Telemetry feature-sad emitter |
| `d` | Telemetry event logger |
| `K6` | Telemetry transport |
| `c76` | Telemetry base constants |
| `mlL` | Alacritty TOML config installer |
| `plL` | Zed keymap.json installer |
| `F6` | JSON.parse wrapper |
| `WoH` | Onboarding project completion handler |
| `kY` | Onboarding file writer |
| `r59` | CLAUDE.md context path resolver |
| `HN_` | CLAUDE.md path constructor |
| `l6` | Logger utility |
| `mi6` | Logger sink |
| `qj` | Project config writer |
| `UL8` | Config file write-with-lock (low-level) |
| `hT1` | Config object merger |
| `y7H` | Config read-with-parse |
| `ViH` | Config validation helper |
| `yG_` | Config backup directory manager |
| `V` | Buffer split utility |
| `P` | Stream chunk processor |
| `E` | Math.max/min range helper |
| `WO6` | Atomic file write (rename-based) |
| `OJH` | Config diff helper |
| `MP6` | Timestamp generator |
| `pL8` | Project config file writer |
| `wN_` | VS Code settings reader |
| `xlL` | Settings key extractor |
| `YN_` | Config write path Y |
| `ON_` | Config write path O |
| `zN_` | Config write path Z |
| `LM9` | iTerm2 clipboard access handler |
| `uM8` | Emulator tag resolver |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.