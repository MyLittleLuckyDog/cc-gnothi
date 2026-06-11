---
type: feature-spec
feature: "terminal-setup"
cc_version: 2.1.172
updated: "2026-06-11"
tags: ["terminal-setup", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.170
analysis_basis: "CC v2.1.170 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/terminal-setup`

> Analysis basis: CC v2.1.170 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.170

---

## Overview

`/terminal-setup` installs the Shift+Enter key binding for entering newlines without submitting input, targeting the terminal emulator currently in use. The command detects the active terminal environment (Apple Terminal, iTerm2, VS Code, Cursor, Windsurf, Alacritty, or Zed), then reads, backs up, modifies, and rewrites the relevant configuration file or preference store for that terminal. On macOS with Apple Terminal, it additionally enables the Option key as Meta and disables the audio bell.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `terminal-setup` |
| description | Install Shift+Enter key binding for newlines |
| loc_byte | `12540290` |
| loc_byte_end | `12540922` |
| loc_line | `8885` |
| module_id | `m39` |
| load_inline | `true` |
| arbor_handler.name | `HiL` |
| arbor_handler.fqn | `claude-2.1.170::HiL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.170 bundle.js:+12540290

---

## Input Branching

Seven or more distinct execution paths exist depending on detected terminal environment and OS. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/terminal-setup invoked"] --> B{OS platform?}
    B -- "darwin (macOS)" --> C{Detect terminal emulator}
    B -- "other OS" --> Z[Show unsupported / informational message]

    C -- "Apple_Terminal" --> D[Configure Apple Terminal via PlistBuddy + defaults]
    C -- "iTerm2 / iTerm.app" --> E[Enable clipboard access via 'defaults write' for com.googlecode.iterm2]
    C -- "vscode / cursor / windsurf / .vscode-server / .cursor-server / .windsurf-server" --> F[Modify keybindings.json — add shift+enter binding]
    C -- "alacritty" --> G[Modify alacritty.toml — add Shift+Return binding]
    C -- "zed" --> H[Modify keymap.json — add shift-enter binding]
    C -- "screen / unknown" --> I[Show informational note: natively supported terminals listed]

    D --> D1{Backup Terminal.app plist}
    D1 -- "backup failed" --> D2[Abort with error: 'Failed to create backup...']
    D1 -- "backup ok" --> D3[Read Default Window Settings profile]
    D3 -- "read fails" --> D4[Abort with error: 'Failed to read default Terminal.app profile']
    D3 -- "ok" --> D5[Read Startup Window Settings profile]
    D5 -- "read fails" --> D6[Abort with error: 'Failed to read startup Terminal.app profile']
    D5 -- "ok" --> D7[Apply Option-as-Meta + visual bell to all profiles via PlistBuddy]
    D7 -- "all profiles fail" --> D8[Error: 'Failed to enable Option as Meta key or disable audio bell...']
    D7 -- "at least one ok" --> D9[Run: killall cfprefsd]
    D9 --> D10[Display success: 'Configured Terminal.app settings:' + bullet list]
    D10 --> D11[Show restart notice]

    F --> F1{keybindings.json exists?}
    F1 -- "no / ENOENT" --> F2[Start with empty array: '[]']
    F1 -- "yes" --> F3[Read and parse existing keybindings]
    F2 & F3 --> F4{shift+enter binding already present?}
    F4 -- "yes" --> F5[Skip / report already configured]
    F4 -- "no" --> F6[Backup keybindings.json]
    F6 -- "backup failed" --> F7[Abort]
    F6 -- "ok" --> F8[Inject binding: key=shift+enter, command=workbench.action.terminal.sendSequence, args=ESC+CR, when=terminalFocus]
    F8 --> F9[Write updated keybindings.json]
    F9 --> F10[Report: 'Shift+Return will now enter a newline.']

    G --> G1{alacritty.toml exists?}
    G1 -- "no valid path" --> G2[Error: 'No valid config path found for Alacritty']
    G1 -- "yes" --> G3{Binding already present? mods=Shift / key=Return}
    G3 -- "yes" --> G4[Report: 'Alacritty Shift+Enter key binding already configured']
    G3 -- "no" --> G5[Backup alacritty.toml]
    G5 -- "fails" --> G6[Error: 'Error backing up existing Alacritty config. Bailing out.']
    G5 -- "ok" --> G7[Append / merge binding into toml]
    G7 --> G8[Report: 'Installed Alacritty Shift+Enter key binding']
    G8 --> G9[Restart notice]

    H --> H1{keymap.json exists?}
    H1 -- "no" --> H2[Initialize empty array]
    H1 -- "yes" --> H3[Read + parse keymap.json]
    H2 & H3 --> H4{shift-enter binding already present?}
    H4 -- "yes" --> H5[Report: 'Zed Shift+Enter key binding already configured']
    H4 -- "no" --> H6[Backup keymap.json]
    H6 -- "fails" --> H7[Error: 'Error backing up existing Zed keymap. Bailing out.']
    H6 -- "ok" --> H8[Append binding: context=Terminal, action=terminal::SendText, key=shift-enter]
    H8 --> H9[Serialize via JSON.stringify + write keymap.json]
    H9 --> H10[Report: 'Installed Zed Shift+Enter key binding']
```

---

## Behavioral Spec

### Main Handler — `terminalSetupHandler` (`HiL`)

`HiL` is an `AsyncFunction` resolved via the `module_id` path (module `m39`).

Analysis basis: CC v2.1.170 bundle.js:+4080377

```
async function terminalSetupHandler(context):
    platform = getPlatform()           // ms.platform

    if platform != "darwin":
        show informational note about Shift+Enter support
        return

    terminalName = detectTerminalEmulator()  // u39 → inspects env vars, process ancestry

    if terminalName matches iTerm2 / iTerm.app:
        enableiTerm2ClipboardAccess()    // u39
    else if terminalName matches vscode / cursor / windsurf / server variants:
        configureVSCodeKeybindings()     // YI_
    else if terminalName matches Apple_Terminal:
        configureAppleTerminal()         // AiL, h39, R39, C39
    else if terminalName matches alacritty:
        configureAlacritty()             // qiL
    else if terminalName matches zed:
        configureZed()                   // KiL
    else:
        // screen, unknown, or natively-supporting terminals
        displayNativeSupport_note()
        // "Note: iTerm2, WezTerm, Ghostty, Kitty, Warp, and Windows Terminal
        //  support Shift+Enter natively."

    // After per-terminal work, invoke post-setup renderer
    renderSetupResults(terminalName)    // h38 sub-graph
```

Analysis basis: CC v2.1.170 bundle.js:+4080573 (call to `u39`), +4081852 (call to `h38`)

---

### Terminal Detection — `detectTerminalEmulator` (`u39`)

```
function detectTerminalEmulator():
    // Inspects environment variables (TERM_PROGRAM, etc.) and
    // process list / working directory for server markers
    // Returns one of: "Apple_Terminal", "vscode", "cursor", "windsurf",
    //                 "alacritty", "zed", "iTerm.app", "screen", or generic string

    check $TERM_PROGRAM and related env vars
    if running inside .vscode-server  → return "vscode"
    if running inside .cursor-server  → return "cursor"
    if running inside .windsurf-server → return "windsurf"
    if running inside .devin-server   → return "cursor"  // treated same as cursor
    return detected terminal string
```

Analysis basis: CC v2.1.170 bundle.js:+4079369 (`u39`), literals at +4077879, +4077909, +4077939, +4077971

---

### Apple Terminal Configuration — `configureAppleTerminal` (`AiL`)

```
async function configureAppleTerminal():
    prefPath = buildPlistPath()           // QoH: ~/Library/Preferences/com.apple.Terminal.plist
    backupOk = backupTerminalPlist(prefPath)   // V38
    if not backupOk:
        throw Error("Failed to create backup of Terminal.app preferences, bailing out")

    defaultProfile = runCommand("defaults", "read", "com.apple.Terminal", 
                                "Default Window Settings")   // h39 + b8
    if defaultProfile is empty:
        throw Error("Failed to read default Terminal.app profile")

    startupProfile = runCommand("defaults", "read", "com.apple.Terminal",
                                "Startup Window Settings")
    if startupProfile is empty:
        throw Error("Failed to read startup Terminal.app profile")

    profiles = deduplicate([defaultProfile.trim(), startupProfile.trim()])

    successfulProfiles = []
    for each profile in profiles:
        ok1 = runPlistBuddy(R39, profile, enable_option_as_meta)
        ok2 = runPlistBuddy(C39, profile, disable_audio_bell)
        if ok1 or ok2:
            successfulProfiles.push(profile)

    if successfulProfiles is empty:
        throw Error("Failed to enable Option as Meta key or disable audio bell for any Terminal.app profile")

    runCommand("killall", "cfprefsd")   // flush macOS preference cache

    output = ["Configured Terminal.app settings:"]
    output.push("- Enabled \"Use Option as Meta key\"")
    output.push("- Switched to visual bell")
    output.push(dim("Shift+Return will now enter a newline."))
    output.push(dim("Option+Enter will now enter a newline."))
    output.push("You must restart Terminal.app for changes to take effect.")
    display(output.join(newline))
```

Analysis basis: CC v2.1.170 bundle.js:+4088034 (`AiL` entry), +4088040 (backup failure message), +4088178 ("Default Window Settings"), +4088355 ("Startup Window Settings"), +4088724 ("killall"), +4088844 (bullet), +4089085 (restart notice)

---

### Apple Terminal Plist Backup — `backupTerminalPlist` (`V38`)

```
async function backupTerminalPlist(prefPath):
    // Checks whether a backup already exists (goH, LI_.stat)
    // Uses hH (shell runner) to export plist via:
    //   "defaults export com.apple.Terminal <backupPath>"
    // Status string: "no_backup", "import", "failed", "restored"
    // Returns true if backup written successfully, false otherwise
```

Analysis basis: CC v2.1.170 bundle.js:+4075645 ("no_backup"), +4075671–4075957 (status literals), +4075734 (`LI_.stat`)

---

### PlistBuddy Invocation — `runPlistBuddy` (`R39`, `C39`)

```
function runPlistBuddyCommand(profile, command):
    // Shells out to /usr/libexec/PlistBuddy -c "<command>" <prefPath>
    // R39 handles Option-as-Meta setting
    // C39 handles audio bell disable
    // Both follow the same pattern: build args, call b8 (shell runner), check exit code
```

Analysis basis: CC v2.1.170 bundle.js:+4087267 ("/usr/libexec/PlistBuddy"), +4087294 ("-c"), +4087360 (`QoH` for pref path)

---

### VS Code / Cursor / Windsurf Keybindings — `configureVSCodeKeybindings` (`YI_`)

```
async function configureVSCodeKeybindings(terminalName):
    // Determine keybindings.json path via jS.join (path utilities)
    keybindingsPath = resolveKeybindingsPath(terminalName)

    try:
        existing = await t2.readFile(keybindingsPath, "utf-8")
    catch ENOENT:
        existing = "[]"

    parsed = parseJSON(existing)    // _z6

    // Check if shift+enter binding already present
    alreadyPresent = parsed.find(entry =>
        entry.key == "shift+enter" &&
        entry.command == "workbench.action.terminal.sendSequence"
    )
    if alreadyPresent: return

    // Backup existing file
    backupSuffix = doH.randomBytes(4).toString("hex")
    await t2.copyFile(keybindingsPath, keybindingsPath + ".backup." + backupSuffix)

    // Build new binding object
    newBinding = {
        key: "shift+enter",
        command: "workbench.action.terminal.sendSequence",
        args: { text: "\x1b\r" },      // ESC + CR sequence
        when: "terminalFocus"
    }

    // Inject using NFA (JSON document editor)
    updated = injectIntoJSONArray(parsed, newBinding)   // NFA

    await t2.writeFile(keybindingsPath, updated, "utf-8")

    display(dim("Shift+Return will now enter a newline."))
```

Analysis basis: CC v2.1.170 bundle.js:+4085912 ("keybindings.json"), +4086380 ("shift+enter"), +4086402 ("workbench.action.terminal.sendSequence"), +4086454 (ESC+CR literal), +4086469 ("terminalFocus"), +4086112 (randomBytes length=4), +4086140 ("hex")

---

### VS Code Settings — `configureVSCodeSettings` (`zI_`)

```
async function configureVSCodeSettings(terminalName):
    // Reads settings.json (defaulting to "{}" if missing)
    // Checks for terminal_setup_gpu_accel and remote_ssh markers
    // Merges / patches relevant keys into the JSON document
    // Backs up and rewrites settings.json on change
    // Status codes: "not_json_object", "write_failed", "backup_failed"
```

Analysis basis: CC v2.1.170 bundle.js:+4082598 ("settings.json"), +4083764 ("terminal_setup_gpu_accel"), +4083791 ("remote_ssh"), +4084020 ("not_json_object"), +4084364 ("write_failed"), +4084585 ("backup_failed")

---

### Alacritty Configuration — `configureAlacritty` (`qiL`)

```
async function configureAlacritty():
    // Build candidate config paths
    candidates = [
        path.join(homedir(), ".config", "alacritty", "alacritty.toml"),
        // platform-specific paths; win32 excluded
    ]
    configPath = candidates.find(p => exists(p))

    if not configPath:
        throw Error("No valid config path found for Alacritty")

    content = await t2.readFile(configPath, "utf-8")

    if content.includes("mods = \"Shift\"") and content.includes("key = \"Return\""):
        display("Alacritty Shift+Enter key binding already configured")
        return

    backupSuffix = doH.randomBytes(4).toString("hex")
    try:
        await t2.copyFile(configPath, configPath + ".backup." + backupSuffix)
    catch:
        throw Error("Error backing up existing Alacritty config. Bailing out.")

    // Append TOML binding block
    await t2.mkdir(path.dirname(configPath), { recursive: true })
    if not content.endsWith("\n"): content += "\n"
    content += tomlBindingBlock   // contains mods="Shift", key="Return", action send newline
    await t2.writeFile(configPath, content, "utf-8")

    display("Installed Alacritty Shift+Enter key binding")
    display("You may need to restart Alacritty for changes to take effect")
```

Analysis basis: CC v2.1.170 bundle.js:+4089729 ("alacritty.toml"), +4089781 (".config"), +4089841 ("win32"), +4090090 (no valid path error), +4090158 (mods literal), +4090188 (key literal), +4090231 (already configured), +4090441 (backup error), +4090815 (success), +4090885 (restart notice)

---

### Zed Configuration — `configureZed` (`KiL`)

```
async function configureZed():
    keymapPath = path.join(homedir(), ..., "keymap.json")
    await t2.mkdir(path.dirname(keymapPath), { recursive: true })

    try:
        raw = await t2.readFile(keymapPath, "utf-8")
        parsed = P9(raw)     // error-tolerant JSON parse
    catch:
        parsed = []

    if not Array.isArray(parsed): parsed = []

    alreadyPresent = parsed.some(entry => entryHasShiftEnterBinding(entry))
    // Checks for "shift-enter" key in Terminal context

    if alreadyPresent:
        display("Zed Shift+Enter key binding already configured")
        return

    backupSuffix = doH.randomBytes(4).toString("hex")
    try:
        await t2.copyFile(keymapPath, keymapPath + ".backup." + backupSuffix)
    catch:
        throw Error("Error backing up existing Zed keymap. Bailing out.")

    // Construct new binding entry:
    // { context: "Terminal", bindings: { "shift-enter": ["terminal::SendText", "\x1b\r"] } }
    parsed.push(newZedBinding)
    serialized = CH(parsed, null, 2)   // JSON.stringify with indent
    await t2.writeFile(keymapPath, serialized, "utf-8")

    display("Installed Zed Shift+Enter key binding")
```

Analysis basis: CC v2.1.170 bundle.js:+4091194 (`jS.join`/`ms.homedir`), +4091244 ("keymap.json"), +4091399 ("q.includes"), +4091410 ("shift-enter"), +4091450 (already configured), +4091654 (backup error), +4091863 ("Terminal"), +4091899 ("terminal::SendText"), +4092010 (success), +4092184–4092219 (String/Error)

---

### iTerm2 Clipboard — `enableiTerm2ClipboardAccess` (`u39`)

```
async function enableiTerm2ClipboardAccess():
    // Reads com.googlecode.iterm2 AllowClipboardAccess preference via `defaults read`
    current = runCommand("defaults", "read", "com.googlecode.iterm2", "AllowClipboardAccess")

    if current.trim() == "1":
        display("iTerm2 clipboard access already enabled")
        return

    result = runCommand("defaults", "write", "com.googlecode.iterm2",
                        "AllowClipboardAccess", "-bool", "true")
    if result indicates failure:
        display("Couldn't update iTerm2 clipboard setting.")
        return

    display("Enabled \"Applications in terminal may access clipboard\" in iTerm2")
    display("Restart iTerm2 for this to take effect. Undo: defaults write ...")
```

Analysis basis: CC v2.1.170 bundle.js:+4079434 ("com.googlecode.iterm2"), +4079458 ("AllowClipboardAccess"), +4079533 (already enabled), +4079621 ("write"), +4079676 ("-bool"), +4079727 (failure), +4079818 (success), +4079901 (undo notice)

---

### Shell Command Runner — `shellRunner` (`b8`)

```
function shellRunner(executable, ...args):
    // Spawns child process, collects stdout/stderr
    // Enforces a 10-item history buffer (lN4: shift/push pattern)
    // Logs errors via go.logError
    // Used by Apple Terminal, iTerm2, and PlistBuddy invocations
```

Analysis basis: CC v2.1.170 bundle.js:+1098789 (`p_` entry), +1098734 (history limit 10), +1099256 (1 000 000 byte buffer cap), +1099683 ("error")

---

### Config File Patcher — `jsonDocumentPatcher` (`NFA`, `$9_`)

```
function injectIntoJSONArray(document, newEntry):
    // Uses a JSON AST editor (f9_, PFA, M9_) to surgically insert
    // newEntry into the parsed array without reformatting unchanged regions
    // Handles: "remove", "insert", "modify" edit operations
    // Throws on overlapping edits or malformed AST
```

Analysis basis: CC v2.1.170 bundle.js:+1149786 (`NFA`), +1144765 ("remove"), +1144793 ("insert"), +1144802 ("modify"), +1142644 ("Can not delete in empty document"), +1142910 ("Malformed AST")

---

### Post-Setup Renderer — `renderSetupResults` (`h38`)

```
function renderSetupResults(terminalName):
    // Collects per-terminal setup functions: YI_, zI_, I38, qiL, KiL, W8
    // Builds a JSX component that shows result lines
    // Uses FoH (onboarding project context), SH (signal/state emitter)
    // Emits "onboarding_project_complete" telemetry via FoH
```

Analysis basis: CC v2.1.170 bundle.js:+4078608 (`h38` → `AiL`), +4079014 (`h38` → `W8`), +4074602 ("onboarding_project_complete")

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_config_auth_loss_prevented` (+3303113), `tengu_feature_ok` (+1014205), `tengu_feature_bad` (+1014267), `tengu_feature_sad` (+1014348), `tengu_daemon_control` (+16566763), `tengu_config_lock_contention` (+3306022), `tengu_config_stale_write` (+3306158), `tengu_config_parse_error` (+3308597) |
| File writes | `keybindings.json` (VS Code/Cursor/Windsurf), `settings.json` (VS Code), `alacritty.toml` (Alacritty), `keymap.json` (Zed); each is backed up with a random 4-byte hex suffix before modification |
| Shell commands | `defaults read/write/export` (Apple Terminal / iTerm2), `/usr/libexec/PlistBuddy -c` (Apple Terminal profile edits), `killall cfprefsd` (flush macOS pref cache) |
| Config lock | `saveGlobalConfig` and `saveCurrentProjectConfig` paths include anti-auth-loss guard (GH #3117 check) before writing |
| onboarding event | `"onboarding_project_complete"` emitted after setup renderer completes (+4074602) |
| Sound | Visual bell is explicitly enabled on Apple Terminal (audio bell disabled); no sound emitted by CC itself |
| appState changes | Preference cache flushed via `cfprefsd` restart; no in-process app state mutation observed at depth-2 |

---

## Version History

| Version | Change |
|---|---|
| v2.1.170 | Initial analysis |

---

## Common Mistakes

1. **Running on non-macOS**: The command only performs meaningful work on `darwin`. On other platforms it exits early with an informational note; invoking it on Linux or Windows will produce no configuration changes.
2. **Terminal not detected**: If the terminal emulator is not one of the seven supported types (Apple Terminal, iTerm2, VS Code, Cursor, Windsurf, Alacritty, Zed), the command falls back to displaying a note that many terminals support Shift+Enter natively — no file is written.
3. **Forgetting to restart**: Apple Terminal requires a restart for plist changes to take effect; Alacritty may also require a restart. The command displays explicit notices, but users sometimes miss them.
4. **Backup file accumulation**: Every invocation that modifies a config file creates a new backup with a random suffix. Running `/terminal-setup` repeatedly produces multiple backup files in the same directory.
5. **PlistBuddy unavailable**: On minimal or sandboxed macOS environments, `/usr/libexec/PlistBuddy` may be missing or restricted. The command will throw the backup-failure error and abort before touching any profile.
6. **VS Code remote server detection**: The command checks for `.vscode-server`, `.cursor-server`, `.windsurf-server`, and `.devin-server` directory markers in the working path. If Claude Code runs in a remote SSH context not matched by these strings, the correct keybindings path may not be resolved.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `HiL` | Main async handler for `/terminal-setup` (`terminalSetupHandler`) |
| `h38` | Post-setup result renderer / JSX component builder |
| `AiL` | Apple Terminal configuration orchestrator |
| `h39` | Reads Apple Terminal pref file path and runs `defaults export` |
| `QoH` | Builds `~/Library/Preferences/com.apple.Terminal.plist` path |
| `b8` | Shell command runner (spawns child processes) |
| `p_` | Core process-spawning primitive with stdout/stderr buffering |
| `C6` | Low-level process spawn helper |
| `snL` | Shell output normalizer / trimmer |
| `W8` | Global config save with lock and auth-loss guard |
| `hH` | Async shell executor with history queue (`lN4`) |
| `jA` | Error coercion utility |
| `_6` | String coercion utility |
| `hq` | Network traffic classifier (`essential-traffic`) |
| `lN4` | Bounded history queue (shift/push, max 10 entries) |
| `q` | Stream / connection manager with `add`/`delete`/`close` |
| `Y1` | CLI error reporter (writes to stderr and exits) |
| `JpH` | Colored error printer using `w6.red` |
| `aj` | Sync file writer for CLI error output |
| `L` | Promise lifecycle manager (`finally`/`close`) |
| `f` | Connection / socket abstraction (`toLowerCase` normalizer) |
| `A` | String normalization helper (`toLowerCase`) |
| `R39` | PlistBuddy runner for Option-as-Meta setting |
| `N` | Telemetry event emitter |
| `PeK` | Telemetry event builder |
| `H` | Random delay / jitter utility |
| `CH` | `JSON.stringify` wrapper |
| `_` | Generic string utility |
| `u4` | Path component extractor (lastIndexOf / slice) |
| `zFH` | Telemetry payload serializer |
| `EeK` | Telemetry network sender (Buffer.byteLength, GQ6.then) |
| `C39` | PlistBuddy runner for audio bell disable |
| `goH` | Global config read helper |
| `yA` | Terminal color/ANSI renderer |
| `UJH` | Full ANSI color palette mapper (w6.*) |
| `vl` | Fallback display renderer |
| `D` | Process exit / abort controller |
| `Qj` | Forced-shutdown signal |
| `z` | Abort/daemon-stop controller |
| `SH` | Daemon stop signal emitter (`tengu_feature_ok`) |
| `xH` | Daemon stop failure handler (`tengu_feature_bad`) |
| `ih` | Daemon control event dispatcher (`tengu_daemon_control`) |
| `ZU` | Parallel process race/all runner |
| `V38` | Apple Terminal plist backup manager |
| `tnL` | Backup path builder |
| `h6` | Config file writer with timestamp / BSL |
| `YI_` | VS Code / Cursor / Windsurf keybindings.json configurator |
| `y38` | Remote-server directory detector (`.vscode-server` etc.) |
| `_z6` | JSON parse utility with prefix stripping |
| `ku` | String prefix stripper (`startsWith`/`slice`) |
| `P9` | Error-tolerant JSON parser (ENOENT / EACCES etc.) |
| `V8` | Permission / filesystem error classifier |
| `XS` | File URL builder (`b39.pathToFileURL`) |
| `a2` | Terminal hyperlink capability detector |
| `HD` | Hyperlink escape builder |
| `NFA` | JSON array document patcher (insert path) |
| `f9_` | JSON AST insertion engine (`PFA`) |
| `PFA` | JSON AST node inserter (slice / pop / dr6) |
| `M9_` | JSON AST segment slicer (`cr6`) |
| `cr6` | Substring-based segment extractor |
| `zI_` | VS Code settings.json configurator |
| `XI_` | Array.isArray guard for parsed JSON |
| `$9_` | JSON document patcher (existing-array path) |
| `I38` | VS Code terminal GPU acceleration settings configurator |
| `s6` | Feature flag signal emitter (`tengu_feature_sad`) |
| `d` | Low-level event emitter base |
| `K6` | Event type router |
| `ff6` | Base event dispatcher |
| `qiL` | Alacritty `alacritty.toml` configurator |
| `KiL` | Zed `keymap.json` configurator |
| `Q6` | Safe `JSON.parse` wrapper |
| `FoH` | Onboarding project context renderer / event emitter |
| `kY` | Onboarding state machine (vJH, h6, Aq) |
| `v39` | Onboarding state resolver (`KI_`) |
| `KI_` | CLAUDE.md workspace context builder |
| `n6` | Filesystem existence check |
| `wr6` | Config directory resolver |
| `fj` | Project config file writer with lock |
| `k78` | Locked config writer with backup and stat check |
| `JE1` | Config snapshot helper (fY_, Object.assign) |
| `B7H` | Config file reader with EEXIST / backup handling |
| `liH` | Config write finalizer |
| `CT_` | Backup directory builder (`$w.join`, `H_`) |
| `V` | String startsWith helper |
| `P` | Stream chunk accumulator (Buffer.concat / indexOf) |
| `E` | Slice range clamper (Math.max / Math.min) |
| `xO6` | Atomic file writer (temp rename + fchmod + fsync) |
| `ZJH` | Config serializer |
| `QP6` | Timestamp recorder (`Date.now`) |
| `I78` | Config directory write-with-lock inner function |
| `PI_` | Generic config file reader |
| `_iL` | Config read path resolver |
| `jI_` | Config write dispatcher (h6, W8) |
| `wI_` | Config read dispatcher (h6) |
| `JI_` | Config accessor (h6) |
| `DI_` | Config initializer (not reachable at depth 2) |
| `u39` | iTerm2 clipboard enabler / terminal env detector |
| `v38` | Terminal name string builder |