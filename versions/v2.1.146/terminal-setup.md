---
type: feature-spec
feature: "terminal-setup"
cc_version: "2.1.146"
updated: "2026-06-01"
tags: ["terminal-setup", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.146 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/terminal-setup`

> Analysis basis: CC v2.1.146 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.146

---

## Overview

`/terminal-setup` detects the user's active terminal emulator and installs a Shift+Enter key binding that sends a newline sequence, enabling multi-line input in Claude Code without submitting the prompt. On macOS with Apple Terminal, the command also applies additional preference tweaks (Option-as-Meta key and visual bell). For VS Code-family editors and other supported terminals, it patches the relevant configuration file in place, backing up the original before writing.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `terminal-setup` |
| description | Install Shift+Enter key binding for newlines |
| loc_byte | `11790375` |
| loc_byte_end | `11791007` |
| loc_line | `9701` |
| module_id | `BF9` |
| load_inline | `true` |
| arbor_handler.name | `$6L` |
| arbor_handler.fqn | `claude-2.1.146::$6L` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.146 bundle.js:+11790375

---

## Input Branching

The command dispatches across seven or more distinct terminal-emulator branches, making a Mermaid flowchart the required representation.

```mermaid
flowchart TD
    A(["/terminal-setup invoked"]) --> B{Detect platform\nKe.platform}
    B -- "darwin" --> C{Detect terminal emulator\nnTH → Ke.platform}
    B -- "win32 / other" --> D[VS Code / Cursor / Windsurf\nserver-side path]

    C -- "Apple_Terminal" --> E[appleTerminalSetup\nSF9 → plist export/import\nvia PlistBuddy]
    C -- "vscode / cursor / windsurf" --> F[vscodeKeybindingSetup\nMM_ / fM_\nkeybindings.json patch]
    C -- "alacritty" --> G[alacrittySetup\nY6L\nalacritty.toml patch]
    C -- "zed" --> H[zedSetup\nD6L\nkeymap.json patch]
    C -- "iTerm2 / screen / other darwin" --> I[iterm2ClipboardSetup\nUF9 + advisory message]
    C -- "unrecognized" --> J[Display advisory note\nShift+Enter natively\nsupported list]

    E --> K{Backup plist\nSF9}
    K -- "backup fails" --> L[Error: backup failure\nbundle.js:+3922536]
    K -- "success" --> M[Read default/startup profile\nz6L: 'Default Window Settings'\n'Startup Window Settings']
    M --> N[Apply PlistBuddy commands\nOption-as-Meta + visual bell\nxF9 / uF9]
    N --> O[killall cfprefsd\nbundle.js:+3923220]
    O --> P[Report: success message\nbundle.js:+3923273]

    F --> Q{Read keybindings.json\n_G.readFile}
    Q -- "ENOENT / empty" --> R[Seed with empty array '[]'\nbundle.js:+3920490]
    Q -- "exists" --> S[Parse existing bindings\nYx6 / UJA]
    R & S --> T{Binding already present?\n'shift+enter' check}
    T -- "already configured" --> U[Skip / no-op]
    T -- "absent" --> V[Backup file\nC36.randomBytes\n_G.copyFile]
    V --> W[Inject binding\nworkbench.action.terminal.sendSequence\nESC+CR sequence\nbundle.js:+3920876]
    W --> X[writeFile keybindings.json]

    G --> Y{Read alacritty.toml\n_G.readFile}
    Y -- "no valid path" --> Z[Error: no config path\nbundle.js:+3924586]
    Y -- "exists" --> AA{Contains\n'mods = "Shift"'\n+ 'key = "Return"'?}
    AA -- "yes" --> AB[Already configured\nbundle.js:+3924727]
    AA -- "no" --> AC[Backup + append TOML stanza\nbundle.js:+3925311]

    H --> AD{Read keymap.json\n_G.readFile}
    AD -- "missing" --> AE[Seed empty array]
    AD -- "exists" --> AF{Contains\n'shift-enter'?}
    AF -- "yes" --> AG[Already configured\nbundle.js:+3925946]
    AF -- "no" --> AH[Backup + inject Zed action\n'terminal::SendText'\nbundle.js:+3926506]
```

---

## Behavioral Spec

### 1. Platform and Terminal Detection

```
async function terminalSetupHandler():
    platform = Ke.platform()          // e.g. "darwin", "win32"
    terminalKind = detectTerminal()   // nTH: inspects env vars, process hierarchy
    dispatch to per-terminal handler based on (platform, terminalKind)
```

The top-level async handler (`$6L`, resolved via Arbor `module_id` path) reads `Ke.platform` at entry.
Analysis basis: CC v2.1.146 bundle.js:+3916265

Recognized terminal identifiers (literals in the bundle):
- `"Apple_Terminal"` (bundle.js:+3914369)
- `"vscode"` (bundle.js:+3914401)
- `"cursor"` (bundle.js:+3914425)
- `"windsurf"` (bundle.js:+3914449)
- `"alacritty"` (bundle.js:+3914475)
- `"zed"` (bundle.js:+3914502)
- `"iTerm.app"` / `"screen"` detected via `nTH` (bundle.js:+3916366, +3916415)

Terminals noted as already supporting Shift+Enter natively (advisory message):
`"iTerm2, WezTerm, Ghostty, Kitty, Warp, and Windows Terminal"` (bundle.js:+3917593)

---

### 2. Apple Terminal Setup (`SF9` / `z6L`)

```
async function appleTerminalSetup():
    plistPath = path.join(homedir(), "Library", "Preferences",
                          "com.apple.Terminal.plist")
    // Backup via: defaults export com.apple.Terminal <tmpfile>
    backupOk = runCommand("defaults", "export", "com.apple.Terminal", tmpPath)
    if not backupOk:
        throw Error("Failed to create backup of Terminal.app preferences, bailing out")
        // bundle.js:+3922536

    defaultProfile = readPlistKey("Default Window Settings")
    if defaultProfile is empty:
        throw Error("Failed to read default Terminal.app profile")
        // bundle.js:+3922734

    startupProfile = readPlistKey("Startup Window Settings")
    if startupProfile is empty:
        throw Error("Failed to read startup Terminal.app profile")
        // bundle.js:+3922911

    for each profile in [defaultProfile, startupProfile]:
        applyPlistBuddyCommands(profile)   // xF9, uF9: Option-as-Meta, visual bell

    if no profile was successfully patched:
        throw Error("Failed to enable Option as Meta key or disable audio bell ...")
        // bundle.js:+3923121

    runCommand("killall", "cfprefsd")      // flush preference daemon
    // bundle.js:+3923220 / +3923231

    display success summary:
        "- Enabled \"Use Option as Meta key\""    // bundle.js:+3923340
        "- Switched to visual bell"               // bundle.js:+3923402
        "Shift+Return will now enter a newline."  // bundle.js:+3923447
        "Option+Enter will now enter a newline."  // bundle.js:+3923496
        "You must restart Terminal.app for changes to take effect."
        // bundle.js:+3923581
```

`PlistBuddy` is invoked at `/usr/libexec/PlistBuddy` (bundle.js:+3921763) with the `-c` flag (bundle.js:+3921790).

The plist read/export uses the `defaults` binary with sub-commands `"export"` (bundle.js:+3910611) and `"read"` (bundle.js:+3922646).

---

### 3. VS Code-Family Keybinding Setup (`MM_` — install, `fM_` — check/update)

```
async function vscodeKeybindingSetup(editorVariant):
    // editorVariant: "VSCode" | "Cursor" | "Windsurf"
    // Determines config directory via jM_:
    //   win32  → %APPDATA%/Roaming/Code/User/keybindings.json
    //   darwin → ~/Library/Application Support/Code/User/keybindings.json
    //   linux  → ~/.config/Code/User/keybindings.json
    // (substitute "Cursor" / "Windsurf" for non-VSCode variants)

    configPath = resolveKeybindingsPath(editorVariant)   // jM_

    raw = await fs.readFile(configPath, "utf-8")
         catch ENOENT → raw = "[]"

    bindings = parseJsonWithComments(raw)   // Yx6

    alreadyPresent = bindings.find(b =>
        b.key == "shift+enter" &&
        b.command == "workbench.action.terminal.sendSequence" &&
        b.when == "terminalFocus")
    // bundle.js:+3920876, +3920898, +3920965

    if alreadyPresent:
        return   // no-op

    backupPath = configPath + ".backup." + randomHex()   // C36.randomBytes
    await fs.copyFile(configPath, backupPath)

    newBinding = {
        key: "shift+enter",
        command: "workbench.action.terminal.sendSequence",
        args: { text: "\x1b\r" },      // ESC + CR  bundle.js:+3920950
        when: "terminalFocus"
    }
    updatedBindings = insertBinding(bindings, newBinding)   // UJA / pJA

    await fs.writeFile(configPath, serialize(updatedBindings), "utf-8")
```

Remote server variants (`.vscode-server`, `.cursor-server`, `.windsurf-server`) are also checked (bundle.js:+3913917, +3913947, +3913977).

Analysis basis: CC v2.1.146 bundle.js:+3920558

---

### 4. Alacritty Setup (`Y6L`)

```
async function alacrittySetup():
    candidates = buildAlacrittyConfigPaths()   // platform-aware list
    // common: ~/.config/alacritty/alacritty.toml  bundle.js:+3924225

    configPath = candidates.find(p => exists(p))
    if configPath is null:
        throw Error("No valid config path found for Alacritty")
        // bundle.js:+3924586

    content = await fs.readFile(configPath, "utf-8")

    if content.includes('mods = "Shift"') and content.includes('key = "Return"'):
        // bundle.js:+3924654, +3924684
        display "Alacritty Shift+Enter key binding already configured"
        // bundle.js:+3924727
        return

    backupPath = configPath + ".backup." + randomHex()
    await fs.copyFile(configPath, backupPath)
        catch error → throw Error("Error backing up existing Alacritty config.")
        // bundle.js:+3924937

    appendTomlStanza(configPath)   // adds [keyboard] binding block

    display "Installed Alacritty Shift+Enter key binding"
    // bundle.js:+3925311
    display "You may need to restart Alacritty for changes to take effect"
    // bundle.js:+3925381
        catch write error → throw Error("Failed to install Alacritty Shift+Enter key binding")
        // bundle.js:+3925606
```

Analysis basis: CC v2.1.146 bundle.js:+3924196

---

### 5. Zed Setup (`D6L`)

```
async function zedSetup():
    keymapPath = path.join(homedir(), ".config", "zed", "keymap.json")
    // bundle.js:+3925740

    await fs.mkdir(dirname(keymapPath), { recursive: true })
    raw = await fs.readFile(keymapPath, "utf-8")
         catch ENOENT → raw = "[]"

    keymap = JSON.parse(raw)   // g6

    alreadyPresent = keymap includes entry with key "shift-enter"
    // bundle.js:+3925906

    if alreadyPresent:
        display "Zed Shift+Enter key binding already configured"
        // bundle.js:+3925946
        return

    backupPath = keymapPath + ".backup." + randomHex()
    await fs.copyFile(keymapPath, backupPath)
        catch error → throw Error("Error backing up existing Zed keymap. Bailing out.")
        // bundle.js:+3926150

    newEntry = {
        context: "Terminal",              // bundle.js:+3926359
        bindings: {
            "shift-enter": "terminal::SendText"   // bundle.js:+3926395
        }
    }
    keymap.push(newEntry)
    await fs.writeFile(keymapPath, JSON.stringify(keymap, null, 2))   // CH

    display "Installed Zed Shift+Enter key binding"
    // bundle.js:+3926506
        catch error → throw Error("Failed to install Zed Shift+Enter key binding")
        // bundle.js:+3926715
```

Analysis basis: CC v2.1.146 bundle.js:+3925690

---

### 6. iTerm2 / Screen / Unknown Terminal Handler (`UF9`)

```
async function iterm2AndFallbackHandler(terminalKind):
    if terminalKind == "iterm2" or "iTerm.app":
        check iTerm2 clipboard pref via:
            defaults read com.googlecode.iterm2 AllowClipboardAccess
        if already "1" / truthy:
            display "iTerm2 clipboard access already enabled"
            // bundle.js:+3915421
        else:
            run: defaults write com.googlecode.iterm2 AllowClipboardAccess -bool true
            // bundle.js:+3915509, +3915564
            if fails: display "Couldn't update iTerm2 clipboard setting."
            // bundle.js:+3915615
            else:
                display "Enabled Applications in terminal may access clipboard in iTerm2"
                display "Restart iTerm2 for this to take effect. ..."
                // bundle.js:+3915789

    // Advisory for all terminals that natively support Shift+Enter
    display note:
        "Note: You can already use backslash (\\) + return to add newlines."
        // bundle.js:+3917258
        "Note: iTerm2, WezTerm, Ghostty, Kitty, Warp, and Windows Terminal support
         Shift+Enter natively."
        // bundle.js:+3917593
```

Analysis basis: CC v2.1.146 bundle.js:+3915257

---

### 7. Command Execution Helper (`W8` / shell runner)

```
function runShellCommand(args: string[]):
    // W8 → V_ (async shell runner)
    spawn subprocess with args
    collect stdout / stderr
    timeout: 10 concurrent slots (bundle.js:+1039120)
    throttle: 1 000 000 μs interval (bundle.js:+1039642)
    on "error" level output: log via SH (bundle.js:+1040069)
    return { exitCode, stdout, stderr }
```

Analysis basis: CC v2.1.146 bundle.js:+1039175

---

### 8. Preference Backup / Restore Helper (`qH8`)

```
async function backupAndRestoreHelper(plistPath):
    status = "no_backup"   // bundle.js:+3910883
    try:
        stat(plistPath)                 // AM_.stat
        create backup via plistExport   // K6L
        status = "restored" on success  // bundle.js:+3911169
    catch:
        status = "failed"               // bundle.js:+3911092
    return status
```

Analysis basis: CC v2.1.146 bundle.js:+3910857

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_config_auth_loss_prevented` (bundle.js:+3166049); `tengu_bg_spare_enable` (bundle.js:+15059830); `tengu_bg_low_mem_mb` (bundle.js:+12414219); `tengu_bg_spare_spawn` (bundle.js:+15060190); `tengu_config_lock_contention` (bundle.js:+3168712); `tengu_config_stale_write` (bundle.js:+3168848); `tengu_config_parse_error` (bundle.js:+3171293); `tengu_feature_ok` (bundle.js:+955938) |
| File writes | `keybindings.json` (VS Code/Cursor/Windsurf); `alacritty.toml`; `~/.config/zed/keymap.json`; macOS plist via `defaults export/import`; random `.backup.<hex>` copies of all modified files |
| Process spawns | `/usr/libexec/PlistBuddy -c ...`; `defaults read/write/export/import`; `killall cfprefsd`; shell runner `W8` / `V_` |
| Config guard | Write to `~/.claude.json` is blocked if re-read config is missing auth that cache has (GH #3117) (bundle.js:+3165921) |
| appState changes | `onboarding_project_complete` flag set on successful setup (bundle.js:+3909814) |
| Sound | None detected |
| Hook registration | None detected in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.146 | Initial analysis |

---

## Common Mistakes

1. **Running on an unsupported terminal**: Terminals such as iTerm2, WezTerm, Ghostty, Kitty, Warp, and Windows Terminal already support Shift+Enter natively; the command will display an advisory and take no file action.
2. **Skipping the required restart**: Both Apple Terminal and Alacritty require a full application restart before the new key binding takes effect. The command prints an explicit reminder but cannot restart them automatically.
3. **Running without write permission on config files**: If `keybindings.json`, `alacritty.toml`, or `keymap.json` is read-only, the command will error before writing. Backup creation will also fail in this case and the operation aborts.
4. **Expecting VS Code remote variants to be auto-detected**: Remote server directories (`.vscode-server`, `.cursor-server`, `.windsurf-server`) are searched, but only if they exist under `$HOME`. If using a non-standard install path the binding must be added manually.
5. **Invoking outside a `darwin` host expecting Apple Terminal changes**: The `defaults export/import` and `PlistBuddy` branches are macOS-only; running in a Linux or Windows container will skip this path entirely.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `$6L` | Main async handler for `/terminal-setup` (Arbor-resolved entry point) |
| `nTH` | Terminal emulator detector (reads platform + env to classify terminal kind) |
| `fH8` | Per-editor dispatch router (routes to MM_, fM_, Y6L, D6L, etc.) |
| `z6L` | Apple Terminal plist patch orchestrator |
| `SF9` | Apple Terminal plist export/backup helper |
| `CFH` | Apple Terminal plist path builder (homedir + Library/Preferences/…) |
| `W8` | Shell command runner (async subprocess spawner) |
| `V_` | Low-level async process execution utility |
| `x6` | Process output collector |
| `K6L` | Apple Terminal `defaults export` helper |
| `K8` | Global config writer (with auth-loss guard, GH #3117) |
| `SH` | Log writer / output emitter |
| `n_` | Error serializer |
| `mH` | String coercion utility |
| `X1` | Network traffic classifier ("essential-traffic") |
| `PuK` | Request queue manager (shift/push) |
| `xF9` | PlistBuddy command runner for Option-as-Meta setting |
| `uF9` | PlistBuddy command runner for visual bell setting |
| `RFH` | Config write dispatcher |
| `kA` | Chalk/ANSI color string formatter (foreground) |
| `v$H` | Full ANSI color code resolver (all chalk color names) |
| `Dg` | Dim-color text renderer |
| `N` | Shell command execution with logging |
| `CH` | JSON serializer wrapper |
| `O4` | Path segment extractor |
| `NRH` | URL formatter |
| `YwK` | HTTP request sender |
| `qH8` | Apple Terminal backup/restore state machine |
| `L6L` | Config telemetry recorder for terminal setup |
| `MM_` | VS Code `keybindings.json` installer (full install path) |
| `fM_` | VS Code `keybindings.json` updater (existing file path) |
| `$M_` | Remote server directory detector (`.vscode-server`, etc.) |
| `jM_` | VS Code config directory resolver (platform-aware) |
| `Yx6` | JSON-with-comments parser |
| `AC` | JSON comment stripper |
| `l9` | Filesystem error classifier (ENOENT, EACCES, etc.) |
| `L8` | Structured logger |
| `sC` | Hyperlink formatter for terminal output |
| `KX` | Terminal hyperlink capability detector |
| `DJ` | Hyperlink escape-code builder |
| `UJA` | JSON keybinding array inserter (VS Code, with duplicate check) |
| `jB8` | JSON AST node inserter |
| `hJA` | JSON AST remove/insert operator |
| `JB8` | JSON AST overlapping-edit resolver |
| `Ox6` | JSON substring extractor |
| `pJA` | JSON keybinding array updater (VS Code) |
| `Y6L` | Alacritty config installer |
| `D6L` | Zed keymap installer |
| `g6` | JSON.parse wrapper |
| `SFH` | Onboarding completion recorder |
| `n$` | Project config updater |
| `NF9` | Onboarding state reader |
| `_M_` | CLAUDE.md workspace initializer |
| `Q6` | Async file writer (atomic) |
| `ub6` | Workspace init helper |
| `Az` | Project-level config writer |
| `dK_` | Config write-with-lock (file lock, backup rotation) |
| `jA9` | OS metrics sampler |
| `Y$H` | Config reader (with parse-error telemetry) |
| `if6` | Config lock acquisition |
| `cK_` | Config backup directory manager |
| `hq6` | Atomic file writer (temp + rename + fchmod) |
| `bUH` | Config cache getter |
| `xUH` | Config cache timestamp checker |
| `QK_` | Config write finalizer (with symlink resolution) |
| `bH` | Feature-flag checker |
| `wM_` | VS Code settings.json reader |
| `O6L` | VS Code settings.json path resolver |
| `DM_` | Config mutation helper (type D) |
| `zM_` | Config mutation helper (type z) |
| `YM_` | Config mutation helper (type Y) |
| `UF9` | iTerm2 clipboard enable + fallback advisory handler |
| `KH8` | Terminal name display string builder |
| `mY1` | Spare PTY socket path builder |
| `pY1` | Spare PTY lock path builder |
| `Fd` | Spare PTY directory path builder |
| `HY5` | Spare PTY host initializer |
| `az5` | Background daemon spawn options builder |
| `wy` | PTY socket path joiner |
| `_HA` | Background spare PTY refill logic |
| `A1` | Bun subprocess wrapper |
| `zS1` | Background spare telemetry emitter |
| `rE6` | Background spare memory monitor |
| `D` | Background spare process lifecycle manager |
| `N6` | Telemetry event emitter |
| `Ga6` | Telemetry deduplication tracker |
| `m6` | Telemetry event builder |
| `$` | Subscription/disposable tracker |
| `Tt` | Telemetry batch flusher |
| `c` | Promise timeout wrapper |
| `Z` | Backup file prefix matcher |
| `X` | SDK connection manager |
| `V` | Backup file list slicer |
| `OM_` | Config mutation helper (type O) |