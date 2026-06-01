---
type: feature-spec
feature: "terminal-setup"
cc_version: "2.1.143"
updated: "2026-06-01"
tags: ["terminal-setup", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.143 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/terminal-setup`

> Analysis basis: CC v2.1.143 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.143

---

## Overview

`/terminal-setup` installs a **Shift+Enter key binding for newlines** in the user's current terminal emulator. When invoked, it detects the active terminal (Apple Terminal, iTerm2, VS Code, Cursor, Windsurf, Alacritty, Zed, or other), applies the appropriate configuration change, and reports the result to the user. On macOS with Apple Terminal, it additionally enables the Option-as-Meta key and switches to a visual bell.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `terminal-setup` |
| description | `Install Shift+Enter key binding for newlines` |
| module_id | `su9` |
| load_inline | `true` |
| loc_byte | `11367218` |
| loc_byte_end | `11367850` |
| loc_line | `6976` |
| arbor_handler.name | `DnL` |
| arbor_handler.fqn | `claude-2.1.143::DnL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.143 bundle.js:+11367218

---

## Input Branching

The command branches on 5+ distinct terminal/platform paths, so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/terminal-setup invoked"] --> B{qt.platform == 'darwin'?}
    B -- No --> C{VS Code / Cursor / Windsurf\nenv detected?}
    B -- Yes --> D{Terminal app detected}

    D -- "Apple_Terminal" --> E[Apply Terminal.app plist changes\nvia PlistBuddy + defaults CLI]
    E --> E1{Backup plist succeeded?}
    E1 -- No --> E2[Abort: 'Failed to create backup\nof Terminal.app preferences']
    E1 -- Yes --> E3[Read Default & Startup profiles\nSet Option-as-Meta + visual bell\nfor each profile]
    E3 --> E4{At least one profile updated?}
    E4 -- No --> E5[Error: 'Failed to enable Option as\nMeta key or disable audio bell']
    E4 -- Yes --> E6[killall cfprefsd\nReport: Shift+Return / Option+Enter\nnewline; restart required]

    D -- "iTerm.app / iTerm2" --> F[Enable AllowClipboardAccess\nvia defaults write\nReport clipboard + Shift+Enter note]

    D -- "screen / other macOS" --> G[Emit native support note\nfor iTerm2, WezTerm, Ghostty…]

    C -- Yes\n('.vscode-server'\n'.cursor-server'\n'.windsurf-server') --> H[VS Code-family handler\nWrite keybindings.json entry:\nshift+enter →\nworkbench.action.terminal.sendSequence\nwith ESC+CR sequence]
    H --> H1{keybindings.json exists?}
    H1 -- No --> H2[Create with empty array '[]'\nthen insert entry]
    H1 -- Yes --> H3[Read, parse, deduplicate,\nappend entry, write back\nwith backup]

    C -- No --> I{Alacritty detected?}
    I -- Yes --> J[Locate alacritty.toml\nCheck for 'mods = Shift' + 'key = Return'\nIf already present: skip\nElse: backup + append TOML block\nReport restart note]

    I -- No --> K{Zed detected?}
    K -- Yes --> L[Locate keymap.json\nCheck for 'shift-enter' binding\nIf already present: skip\nElse: backup + insert JSON entry\nContext: Terminal / terminal::SendText\nReport result]

    K -- No --> M[Emit generic note:\n'backslash+Return for newlines'\nor iTerm2/WezTerm/Ghostty/Kitty/Warp\nnative Shift+Enter support]
```

---

## Behavioral Spec

### Top-level handler: `terminalSetupHandler` (`DnL`)

```
async function terminalSetupHandler(context):
    platform = getPlatform()          // qt.platform
    terminalName = detectTerminal()   // via au9 → reads env/process info
    dimText = styleHelper.dim(...)    // M6.dim for subdued UI output

    if platform == "darwin":
        if terminalName contains "Apple_Terminal":
            result = appleTerminalSetup()
        elif terminalName contains "iTerm.app":
            result = iterm2Setup()
        else:
            result = emitNativeSupportNote()
    else:
        // non-macOS or VS Code-family server path
        result = vscodeOrGenericSetup()

    render result as JSX output
```

Analysis basis: CC v2.1.143 bundle.js:+3904081

---

### Terminal Detection: `detectTerminal` (`au9`)

```
function detectTerminal():
    raw = readTerminalEnvironment()   // Y8 → env vars / process info
    name = raw.trim()
    // Checks against known names:
    //   "Apple_Terminal", "iTerm.app", "screen", "vscode",
    //   "cursor", "windsurf", "alacritty", "zed"
    styled = applyAnsiStyling(name)   // OA + M6.dim
    return name
```

Known terminal identifier strings checked (Analysis basis: CC v2.1.143 bundle.js:+3902161–3902318):
- `"darwin"` (platform check)
- `"Apple_Terminal"`
- `"vscode"`, `"cursor"`, `"windsurf"`
- `"alacritty"`, `"zed"`
- `"iTerm.app"`, `"screen"`

---

### Apple Terminal setup: `appleTerminalSetup` (`JnL`)

```
async function appleTerminalSetup():
    prefPath = buildPrefPath()    // nUH → ~/Library/Preferences/com.apple.Terminal.plist
    // Attempt backup via Y8 / b$A / Qu9
    backupOk = backupPlist(prefPath)
    if not backupOk:
        throw Error("Failed to create backup of Terminal.app preferences, bailing out")
        // Analysis basis: CC v2.1.143 bundle.js:+3910352

    defaultProfile = runPlistBuddy("read", "Default Window Settings", prefPath)
    if not defaultProfile:
        throw Error("Failed to read default Terminal.app profile")
        // Analysis basis: CC v2.1.143 bundle.js:+3910550

    startupProfile = runPlistBuddy("read", "Startup Window Settings", prefPath)
    if not startupProfile:
        throw Error("Failed to read startup Terminal.app profile")
        // Analysis basis: CC v2.1.143 bundle.js:+3910727

    successCount = 0
    for each profile in [defaultProfile.trim(), startupProfile.trim()]:
        ok = applyProfileChanges(profile, prefPath)  // nu9 + iu9
        if ok: successCount++

    if successCount == 0:
        throw Error("Failed to enable Option as Meta key or disable audio bell for any Terminal.app profile")
        // Analysis basis: CC v2.1.143 bundle.js:+3910937

    runCommand("killall", "cfprefsd")
    // Analysis basis: CC v2.1.143 bundle.js:+3911036

    return buildSuccessOutput([
        "- Enabled \"Use Option as Meta key\"",
        "- Switched to visual bell",
        "Shift+Return will now enter a newline.",
        "Option+Enter will now enter a newline.",
        "You must restart Terminal.app for changes to take effect."
    ])
    // Analysis basis: CC v2.1.143 bundle.js:+3911156–3911397
```

The plist path is constructed as:
`~/Library/Preferences/com.apple.Terminal.plist`
(Analysis basis: CC v2.1.143 bundle.js:+3898292–3898316)

Backup and import use the `defaults export / import` macOS CLI commands, with fallback states of `"no_backup"`, `"failed"`, and `"restored"` tracked internally.
(Analysis basis: CC v2.1.143 bundle.js:+3898415–3898985)

Profile property edits are performed via `/usr/libexec/PlistBuddy -c ...`.
(Analysis basis: CC v2.1.143 bundle.js:+3909579)

---

### VS Code-family keybinding setup: `vscodeKeybindingSetup` (`R4_`)

```
async function vscodeKeybindingSetup(editorName):
    // editorName ∈ {"VSCode", "Cursor", "Windsurf"}
    // Analysis basis: CC v2.1.143 bundle.js:+3907557 / 3902510 / 3902580

    kbPath = resolveKeybindingsPath(editorName)
    // U4_: platform-specific path resolution
    //   win32 → %APPDATA%\Roaming\Code\User\keybindings.json
    //   darwin → ~/Library/Application Support/Code/User/keybindings.json
    //   linux  → ~/.config/Code/User/keybindings.json
    // Analysis basis: CC v2.1.143 bundle.js:+3906127–3906309

    mkdir(dirname(kbPath))
    existing = readFile(kbPath) ?? "[]"
    parsed = parseJsonWithFallback(existing)   // SR6 + C9

    // Check for existing shift+enter binding
    if findEntry(parsed, "shift+enter") exists:
        return alreadyConfiguredMessage()

    backup = createBackup(kbPath)   // yf6.randomBytes for backup suffix

    newEntry = {
        key: "shift+enter",
        command: "workbench.action.terminal.sendSequence",
        args: { text: "\u001b\r" },           // ESC + CR
        when: "terminalFocus"
    }
    // Analysis basis: CC v2.1.143 bundle.js:+3908692–3908781

    updated = insertEntry(parsed, newEntry)   // szA / azA
    writeFile(kbPath, stringify(updated), "utf-8")
    // Analysis basis: CC v2.1.143 bundle.js:+3909192

    return successMessage(editorName, kbPath)
```

Detected via `.vscode-server`, `.cursor-server`, `.windsurf-server` directory presence.
(Analysis basis: CC v2.1.143 bundle.js:+3901733–3901793)

---

### VS Code settings.json check: `vscodeSettingsCheck` (`h4_`)

```
async function vscodeSettingsCheck(editorName):
    settingsPath = resolveSettingsPath(editorName)  // keybindings path sibling "settings.json"
    // Analysis basis: CC v2.1.143 bundle.js:+3906481
    existing = readFile(settingsPath) ?? "{}"
    parsed = parseJson(existing)

    // Read current keybindings array
    kbs = parsed["keybindings"] (or top-level array if applicable)
    if isArray(kbs):
        formatted = formatBindings(kbs)   // OA + M6.dim
    return formattedOutput
```

Analysis basis: CC v2.1.143 bundle.js:+3906530

---

### Alacritty setup: `alacrittySetup` (`jnL`)

```
async function alacrittySetup():
    configPath = locateAlacrittyConfig()
    // Searches standard locations; if none found:
    //   throw "No valid config path found for Alacritty"
    //   Analysis basis: CC v2.1.143 bundle.js:+3912402

    content = readFile(configPath)

    if content contains "mods = \"Shift\"" and "key = \"Return\"":
        return "Alacritty Shift+Enter key binding already configured"
        // Analysis basis: CC v2.1.143 bundle.js:+3912543

    backup = createBackup(configPath)
    if backup failed:
        throw "Error backing up existing Alacritty config. Bailing out."
        // Analysis basis: CC v2.1.143 bundle.js:+3912753

    // Append TOML binding block
    append(configPath, tomlBlock)
    return success("Installed Alacritty Shift+Enter key binding",
                   "You may need to restart Alacritty for changes to take effect")
    // Analysis basis: CC v2.1.143 bundle.js:+3913127–3913197
```

The detection checks for `"alacritty.toml"` (Analysis basis: CC v2.1.143 bundle.js:+3912041).
If installation fails: `"Failed to install Alacritty Shift+Enter key binding"` (Analysis basis: CC v2.1.143 bundle.js:+3913422).

---

### Zed setup: `zedSetup` (`PnL`)

```
async function zedSetup():
    keymapPath = resolveZedKeymapPath()
    // Typically ~/.config/zed/keymap.json or platform equivalent
    // Analysis basis: CC v2.1.143 bundle.js:+3913556

    mkdir(dirname(keymapPath))
    content = readFile(keymapPath) ?? "[]"
    parsed = parseJson(content)   // R6 → JSON.parse

    if parsed contains entry with key "shift-enter":
        return "Zed Shift+Enter key binding already configured"
        // Analysis basis: CC v2.1.143 bundle.js:+3913762

    backup = createBackup(keymapPath)
    if backup failed:
        throw "Error backing up existing Zed keymap. Bailing out."
        // Analysis basis: CC v2.1.143 bundle.js:+3913966

    newEntry = {
        context: "Terminal",
        bindings: { "shift-enter": "terminal::SendText" }
    }
    // Analysis basis: CC v2.1.143 bundle.js:+3914175–3914211

    updated = appendEntry(parsed, newEntry)
    writeFile(keymapPath, stringify(updated))
    return "Installed Zed Shift+Enter key binding"
    // Analysis basis: CC v2.1.143 bundle.js:+3914322
```

Failure path: `"Failed to install Zed Shift+Enter key binding"` (Analysis basis: CC v2.1.143 bundle.js:+3914531).

---

### iTerm2 clipboard setup: `iterm2Setup` (`au9` branch)

```
async function iterm2Setup():
    domain = "com.googlecode.iterm2"
    key    = "AllowClipboardAccess"
    // Analysis basis: CC v2.1.143 bundle.js:+3903138

    current = readDefaultsValue(domain, key)
    if current is truthy:
        return "iTerm2 clipboard access already enabled"
        // Analysis basis: CC v2.1.143 bundle.js:+3903237

    ok = runCommand("defaults", "write", domain, key, "-bool", "true")
    // Analysis basis: CC v2.1.143 bundle.js:+3903325

    if not ok:
        return "Couldn't update iTerm2 clipboard setting."
        // Analysis basis: CC v2.1.143 bundle.js:+3903431

    return [
        "Enabled \"Applications in terminal may access clipboard\" in iTerm2",
        "Restart iTerm2 for this to take effect. Undo: defaults write com.googlecode.iterm2 AllowClipboardAccess -bool false"
    ]
    // Analysis basis: CC v2.1.143 bundle.js:+3903522–3903605
```

---

### Backup mechanism: `createBackupOrRestore` (`ws6`)

```
async function createBackupOrRestore(filePath, mode):
    // mode ∈ {"no_backup", "import", "failed", "restored"}
    // Analysis basis: CC v2.1.143 bundle.js:+3898699–3898985

    if mode == "no_backup":
        skip backup, proceed

    stat = fs.stat(filePath)
    if not exists: return {state: "no_backup"}

    backupPath = buildBackupPath(filePath, randomSuffix)  // N6 + lUH
    copy(filePath, backupPath)
    if copy failed:
        return {state: "failed"}

    return {state: "import", backupPath: backupPath}
```

Analysis basis: CC v2.1.143 bundle.js:+3898371–3898609

---

### Generic / fallback notes

When the terminal is not one of the specifically supported ones, the handler emits:

- `"Note: You can already use backslash (\\) + return to add newlines."` (Analysis basis: CC v2.1.143 bundle.js:+3905074)
- `"Note: iTerm2, WezTerm, Ghostty, Kitty, Warp, and Windows Terminal support Shift+Enter natively."` (Analysis basis: CC v2.1.143 bundle.js:+3905409)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_config_auth_loss_prevented` (bundle.js:+3159634), `tengu_bg_spare_enable` (+14502634), `tengu_bg_low_mem_mb` (+11972252), `tengu_bg_spare_spawn` (+14502994), `tengu_config_lock_contention` (+3162297), `tengu_config_stale_write` (+3162433), `tengu_config_parse_error` (+3164878), `tengu_feature_ok` (+955068) |
| Filesystem writes | `keybindings.json` (VS Code-family), `alacritty.toml`, `keymap.json` (Zed), `com.apple.Terminal.plist` (Apple Terminal via `defaults` CLI) |
| Backup files | Random-suffix `.backup.*` copies created before any write (Analysis basis: CC v2.1.143 bundle.js:+3163094) |
| External processes spawned | `/usr/libexec/PlistBuddy -c ...`, `defaults export/import/write/read`, `killall cfprefsd` |
| appState changes | `onboarding_project_complete` flag touched via `cUH` → `SH` path (Analysis basis: CC v2.1.143 bundle.js:+3897630) |
| Sound | None detected |
| Config lock | Uses global config lock (`P9_`) with contention telemetry; lock acquisition > threshold logged as warning (Analysis basis: CC v2.1.143 bundle.js:+3162208) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.143 | Initial analysis |

---

## Common Mistakes

1. **Running on a non-macOS system expecting Terminal.app changes** — Apple Terminal–specific plist edits only execute when `qt.platform == "darwin"` and the terminal is identified as `Apple_Terminal`. On Linux or Windows the command falls through to VS Code-family or generic handlers.
2. **Not restarting the terminal after setup** — All terminal-specific changes (Terminal.app, Alacritty, Zed) require a restart to take effect, as explicitly noted in the success messages.
3. **Missing keybindings.json directory** — The VS Code handler creates the parent directory automatically, but if the user's home directory path resolves unexpectedly (e.g., on Windows with unusual `%APPDATA%`), the mkdir step (`C0.mkdir`) may fail silently and the file write will error.
4. **iTerm2 clipboard change is separate from Shift+Enter** — On macOS with iTerm2, the command only enables clipboard access; Shift+Enter is noted as natively supported and not separately configured.
5. **Backup state confusion** — If a previous interrupted run left a `.backup.*` file, the command will create a new backup without cleaning up the old one. Users should check `~/Library/Preferences/` or the relevant config directories if they need to revert.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `DnL` | Main async handler for `/terminal-setup` (arbor-resolved entry point) |
| `IGH` | Platform-check helper (reads `qt.platform`) |
| `Ps6` | Per-terminal dispatcher (routes to R4_, h4_, jnL, PnL, etc.) |
| `JnL` | Apple Terminal plist setup function |
| `Qu9` | Apple Terminal backup orchestrator |
| `nUH` | Terminal plist path builder (`~/Library/Preferences/com.apple.Terminal.plist`) |
| `Y8` | Environment / terminal name reader |
| `$_` | Shell command executor (uses plist byte offsets 0, 27) |
| `S6` | Shell subprocess runner |
| `$nL` | Config write helper (saves global config) |
| `a6` | Global config save function |
| `NH` | Shell command output collector / error logger |
| `v_` | Error-to-string converter |
| `xH` | String coercion utility |
| `zq` | Essential-traffic traffic filter |
| `kNK` | Command queue shift/push manager |
| `nu9` | Apply PlistBuddy changes for default Terminal.app profile |
| `iu9` | Apply PlistBuddy changes for startup Terminal.app profile |
| `v` | Telemetry / logging emit function |
| `G5K` | Telemetry event builder |
| `hH` | JSON.stringify wrapper |
| `P7` | Log-line formatter |
| `cSH` | ANSI color resolver |
| `Z5K` | File-write-with-size-check utility |
| `lUH` | Config save wrapper (delegates to `a6`) |
| `OA` | ANSI-styled text renderer |
| `w$H` | ANSI color code applicator (full chalk-like color table) |
| `vF` | Fallback text renderer |
| `D` | Background subprocess / task runner |
| `G6` | Background spare process enabler |
| `Ci6` | Spare process deduplication / registry |
| `N6` | Config read-with-lock function |
| `JZq` | Telemetry flush / dispose helper |
| `IG6` | Background memory monitor |
| `$o_` | Background PTY host spawner (`Bun.spawn`) |
| `F1` | Feature-ok telemetry emitter |
| `o7q` | Spare socket path builder |
| `a7q` | Alternate spare socket path builder |
| `eQ` | Socket path resolver |
| `pq5` | Background job manager |
| `bq5` | Background process state updater |
| `Bk` | Background PTY log reader |
| `ws6` | Apple Terminal backup-or-restore function |
| `OnL` | Backup config read helper |
| `R4_` | VS Code / VSCode-family keybinding installer |
| `C4_` | VS Code server directory detector (`.vscode-server`, `.cursor-server`, `.windsurf-server`) |
| `U4_` | VS Code keybindings.json path resolver (platform-aware) |
| `SR6` | JSON parse with comment stripping |
| `jR` | JSON leading-comment stripper |
| `C9` | Filesystem error classifier (ENOENT, EACCES, etc.) |
| `L8` | Structured error constructor |
| `$C` | File URL converter (`ru9.pathToFileURL`) |
| `n2` | Hyperlink / terminal hyperlink formatter |
| `hJ` | Hyperlink escape builder |
| `szA` | JSON keybinding array insert (VSCode-style, default profile) |
| `du8` | JSON document editor (insert/remove/modify) |
| `QzA` | JSON AST insertion-index finder |
| `cu8` | JSON AST edit applier |
| `kR6` | JSON substring extractor |
| `h4_` | VS Code `settings.json` reader/formatter |
| `azA` | JSON keybinding array insert (VSCode-style, settings profile) |
| `jnL` | Alacritty TOML keybinding installer |
| `PnL` | Zed `keymap.json` keybinding installer |
| `R6` | JSON.parse wrapper |
| `cUH` | Onboarding state manager |
| `X$` | Onboarding JSX component renderer |
| `pu9` | Onboarding step state reader |
| `v4_` | Workspace CLAUDE.md presence checker |
| `HR6` | File read helper |
| `b3` | Project config save function |
| `P9_` | Config read-write with file lock |
| `heA` | Config object merger |
| `H$H` | Config file reader with backup rotation |
| `d76` | Config schema validator |
| `X9_` | Config backup path builder |
| `yA6` | Atomic file writer (temp + rename, fchmod, fsync) |
| `emH` | Config change event emitter |
| `HpH` | Config timestamp recorder |
| `j9_` | Project config file writer |
| `SH` | Onboarding completion state setter |
| `p4_` | VS Code settings.json current-keybindings reader |
| `wnL` | Settings read helper |
| `m4_` | Config N6 read variant (method m) |
| `x4_` | Config N6 read variant (method x) |
| `u4_` | Config N6 read variant (method u) |
| `au9` | Terminal detection + iTerm2 clipboard setup |
| `Js6` | Terminal name label formatter |