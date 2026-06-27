---
type: feature-spec
feature: "terminal-setup"
cc_version: 2.1.195
updated: "2026-06-26"
tags: ["terminal-setup", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
inherited_from: 2.1.193
analysis_basis: "CC v2.1.193 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/terminal-setup`

> Analysis basis: CC v2.1.193 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.193

---

## Overview

`/terminal-setup` installs a `Shift+Enter` key binding (and related terminal quality-of-life settings) into the user's currently detected terminal emulator, enabling newline input without submitting the Claude Code prompt. The command detects the platform and active terminal, then applies the appropriate configuration changes — writing or patching config files such as `keybindings.json` (VS Code / Cursor / Windsurf), `alacritty.toml`, `keymap.json` (Zed), or macOS `com.apple.Terminal` preferences — and reports the result to the user.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `terminal-setup` |
| description | `Install Shift+Enter key binding for newlines` |
| loc_byte | `12621828` |
| loc_byte_end | `12622460` |
| loc_line | `8585` |
| module_id | `y3i` |
| load_inline | `true` |
| arbor_handler.name | `_1d` |
| arbor_handler.fqn | `claude-2.1.193::_1d` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `1` |

Analysis basis: CC v2.1.193 bundle.js:+12621828

---

## Input Branching

The command has 6+ distinct terminal-type branches plus platform checks, requiring a Mermaid flowchart.

```mermaid
flowchart TD
    A["/terminal-setup invoked"] --> B{Platform check\nIte.platform}
    B -->|darwin| C{Detect terminal emulator}
    B -->|win32| W[Windows path — no dedicated handler\nshows generic note]
    B -->|other linux/unix| L[Linux path — no dedicated handler\nshows generic note]

    C -->|Apple_Terminal| D[Terminal.app handler\nmacOS plist approach]
    C -->|vscode / cursor / windsurf\nor server variants| E[VS Code–family handler\nkeybindings.json]
    C -->|alacritty| F[Alacritty handler\nalacritty.toml]
    C -->|zed| G[Zed handler\nkeymap.json]
    C -->|iterm2 / iTerm.app\nor screen| H[iTerm2 handler\nclipboard + Shift+Enter note]
    C -->|unknown / other| I[Generic note:\nnative Shift+Enter terminals]

    D --> D1{Read Terminal.app\ndefaults export}
    D1 -->|success| D2[Export plist → parse profiles]
    D2 --> D3[For each profile: enable\nOption as Meta, visual bell]
    D3 --> D4{Any profile updated?}
    D4 -->|yes| D5[killall cfprefsd\nshow success summary]
    D4 -->|no| D6[Show error: no profile updated]
    D1 -->|failure| D7[Error: failed to create\nbackup / read profile]

    E --> E1{Remote server check\n.vscode-server / .cursor-server\n.windsurf-server / .devin-server}
    E1 -->|remote SSH context| E2[Show warning: VSCode remote]
    E1 -->|local| E3[Locate keybindings.json\nZ$.join path]
    E3 --> E4[Read or init to '[]']
    E4 --> E5{Binding already present?\nshift+enter check}
    E5 -->|yes| E6[Already configured — skip]
    E5 -->|no| E7[Backup → patch JSON\nadd shift+enter → sendSequence ESC+CR]
    E7 --> E8[Write keybindings.json\nReport success]

    F --> F1[Locate alacritty.toml\n~/.config or platform paths]
    F1 -->|not found| F2[Error: no valid config path]
    F1 -->|found| F3{Binding already present?\nmods=Shift / key=Return check}
    F3 -->|yes| F4[Already configured — skip]
    F3 -->|no| F5[Backup → append binding block]
    F5 --> F6{Write success?}
    F6 -->|yes| F7[Report: restart Alacritty needed]
    F6 -->|no| F8[Error: failed to install binding]

    G --> G1[Locate keymap.json\n~/.config/zed]
    G1 --> G2[Read or init to '[]']
    G2 --> G3{shift-enter already present?}
    G3 -->|yes| G4[Already configured — skip]
    G3 -->|no| G5[Backup → insert Terminal\nshift-enter → terminal::SendText ESC+CR]
    G5 --> G6[Write keymap.json\nReport success]

    H --> H1[Enable AllowClipboardAccess\nvia defaults write com.googlecode.iterm2]
    H1 --> H2{Already enabled?}
    H2 -->|yes| H3[Report: already enabled]
    H2 -->|no| H4{defaults write success?}
    H4 -->|yes| H5[Report: enabled + restart note]
    H4 -->|no| H6[Error: could not update setting]
    H --> H7[Show note: Shift+Enter native\nin iTerm2 / WezTerm / Ghostty etc.]
```

Analysis basis: CC v2.1.193 bundle.js:+4143942 (handler entry `_1d`), +4141913 (platform read), +4141930–4142087 (terminal literals)

---

## Behavioral Spec

### Top-level handler (`_1d`)

Handler is an `AsyncFunction` resolved via `module_id` → `y3i`.

```
async function terminalSetupHandler(context):
    platform = getPlatform()           // Ite.platform
    terminalId = detectTerminalType()  // _3i — reads env, TERM_PROGRAM, etc.

    if platform == "darwin":
        if terminalId == "Apple_Terminal":
            result = await appleTerminalSetup()
        else if terminalId in ["vscode","cursor","windsurf"]:
            result = await vscodeKeybindingSetup(terminalId)
        else if terminalId == "alacritty":
            result = await alacrittySetup()
        else if terminalId == "zed":
            result = await zedSetup()
        else if terminalId in ["iterm2","iTerm.app","screen"]:
            result = await iterm2Setup()
        else:
            showGenericNote()
    else if platform == "win32":
        showGenericNote()
    else:
        showGenericNote()

    render result as JSX via Ixn
```

Analysis basis: CC v2.1.193 bundle.js:+4143942 (`_1d` entry), +4144270 (`Exn` branch), +4145418 (`Ixn` renderer)

---

### Terminal detection (`_3i`)

```
function detectTerminalType(env):
    // reads TERM_PROGRAM, process env, home directory context
    // checks for server directories: .vscode-server, .cursor-server,
    //   .windsurf-server, .devin-server (Txn, loc_byte 4141432–4141553)
    // maps to one of:
    //   "Apple_Terminal", "vscode", "cursor", "windsurf",
    //   "alacritty", "zed", "iterm2", "screen", or unknown
    emit dim status line via St.dim
    call Pn (spawn subprocess) if needed
    return terminalId
```

Analysis basis: CC v2.1.193 bundle.js:+4142934 (`_3i`), +4141432 (`Txn` env check), +4141503–4141535 (server dir strings)

---

### Apple Terminal.app setup (`E1d`)

The Terminal.app path is the most complex branch; it uses the macOS `defaults` CLI and `/usr/libexec/PlistBuddy`.

```
async function appleTerminalSetup():
    prefsPath = homedir() + "/Library/Preferences/com.apple.Terminal.plist"
    // export plist to temp file via: defaults export com.apple.Terminal <tmp>
    backupOk = await createBackup(prefsPath)   // cps + p3i
    if not backupOk:
        throw Error("Failed to create backup of Terminal.app preferences, bailing out")
        // literal at loc_byte 4151606

    rawPlist = await readPlist(prefsPath)       // Pn → spawn defaults export
    defaultProfile = rawPlist["Default Window Settings"]   // literal 4151744
    startupProfile = rawPlist["Startup Window Settings"]   // literal 4151921

    if not defaultProfile:
        throw Error("Failed to read default Terminal.app profile")   // literal 4151804
    if not startupProfile:
        throw Error("Failed to read startup Terminal.app profile")   // literal 4151981

    profileNames = deduplicate([defaultProfile, startupProfile])
    successList = []

    for each profileName in profileNames:
        // Use PlistBuddy to set:
        //   UseOptionAsMetaKey = true
        //   VisualBell = true  (disable audio bell)
        ok = await plistBuddyWrite(prefsPath, profileName)   // m3i + g3i
        if ok:
            successList.push(profileName)

    if successList is empty:
        throw Error("Failed to enable Option as Meta key or disable audio bell for any Terminal.app profile")
        // literal 4152191

    // flush macOS preference cache
    spawnSync("killall", ["cfprefsd"])   // literals 4152290, 4152301

    lines = ["Configured Terminal.app settings:"]   // literal 4152343
    for each name in successList:
        lines.push("- Enabled \"Use Option as Meta key\"")   // literal 4152410
        lines.push("- Switched to visual bell")              // literal 4152472

    lines.push("Shift+Return will now enter a newline.")     // literal 4152517
    lines.push("You must restart Terminal.app for changes to take effect.")  // literal 4152651
    return { type: "success", lines }
```

Analysis basis: CC v2.1.193 bundle.js:+4151560 (`E1d` body start), +4152061 (`m3i`), +4152076 (`g3i`), +4152290 (killall)

---

### Plist read helper (`p3i` / `ast`)

```
function readTerminalPlist():
    // Constructs path: homedir + ["Library","Preferences","com.apple.Terminal.plist"]
    //   d3i.join + u3i.homedir  (loc_byte 4138651, 4138660)
    // Runs: defaults export com.apple.Terminal <tmpFile>
    //   via Pn (spawn subprocess)  (loc_byte 4138794)
    // Stats the tmp file to confirm it was created  (DKr.stat, loc_byte 4138874)
    // Renders the result via g1d → mn (JSX rendering helper)
    return plistObject
```

Analysis basis: CC v2.1.193 bundle.js:+4138651, +4138660, +4138794, +4138874

---

### VS Code–family keybinding setup (`FKr`)

```
async function vscodeKeybindingSetup(terminalId):
    isRemote = checkForServerDirs()   // Txn checks .vscode-server etc.
    if isRemote:
        showWarning("VSCode")         // literal "warning" at 4148838, "VSCode" at 4148805
        return

    keybindingsPath = Z$.join(configBase, "keybindings.json")  // literal 4149497
    ensureDir(Z$.dirname(keybindingsPath))   // zv.mkdir, loc_byte 4149527

    existing = await zv.readFile(keybindingsPath, "utf-8")  // loc_byte 4149587
    if not exists: existing = "[]"          // literal 4149560

    parsed = parseJsonWithComments(existing)   // bLt → Vo

    // Check for duplicate
    if parsed.find(entry => entry.key == "shift+enter"):   // literal 4149946, loc_byte 4150054
        show("already configured")
        return

    // Build new entry:
    //   key: "shift+enter"                          literal 4149946
    //   command: "workbench.action.terminal.sendSequence"  literal 4149968
    //   args: { text: "\x1b\r" }                   literal 4150020
    //   when: "terminalFocus"                       literal 4150035
    newEntry = buildKeybindingEntry()

    backup = makeBackup(keybindingsPath)   // lst.randomBytes + zv.copyFile
    patchedJson = insertEntry(parsed, newEntry)   // Bgs / ICr / TCr
    await zv.writeFile(keybindingsPath, patchedJson, indent=4)   // loc_byte 4150446

    hyperlink = buildHyperlink(keybindingsPath)   // eF → qv → Xh
    show("Shift+Return will now enter a newline.")  // literal 4152517
    show("Option+Enter will now enter a newline.")  // literal 4152566
```

Analysis basis: CC v2.1.193 bundle.js:+4148820 (`Txn`), +4149487 (path join), +4149946–4150035 (binding literals), +4150446 (write)

---

### VS Code settings.json GPU-acceleration setup (`$Kr` / `Axn`)

In addition to keybindings, the VS Code branch may also patch `settings.json` (e.g. GPU acceleration setting `terminal_setup_gpu_accel`).

```
async function vscodeSettingsSetup():
    settingsPath = Z$.join(configBase, "settings.json")   // literal 4146164
    existing = await zv.readFile(settingsPath)
    if not exists: existing = "{}"                         // literal 4146191

    parsed = parseJson(existing)
    if parsed is not a plain object:
        recordError("not_json_object")                     // literal 4147586
        return

    // Check/set GPU acceleration key (literal "terminal_setup_gpu_accel" 4147330)
    // Check remote SSH context (literal "remote_ssh" 4147357)
    backup = makeBackup(settingsPath)   // lst.randomBytes + zv.copyFile
    if backup fails:
        recordError("backup_failed")    // literal 4148151
        return

    updated = applySettingsPatch(parsed)
    await zv.writeFile(settingsPath, JSON.stringify(updated, null, 2))
    if write fails:
        recordError("write_failed")     // literal 4147930
```

Analysis basis: CC v2.1.193 bundle.js:+4146157 (`Cxn` path builder), +4147330, +4147586, +4147930, +4148151

---

### Alacritty setup (`S1d`)

```
async function alacrittySetup():
    // Candidate config paths depend on platform (win32 excluded, literal 4153409)
    // Primary: homedir + [".config","alacritty","alacritty.toml"]  (literals 4153295, 4153348)
    // Also checks Ite.homedir  (loc_byte 4153334)

    path = findExistingConfigPath(candidates)
    if not path:
        throw Error("No valid config path found for Alacritty")   // literal 4153658

    content = await zv.readFile(path)   // loc_byte 4153545

    if content.includes('mods = "Shift"') and content.includes('key = "Return"'):
        // literal checks at 4153726, 4153756
        show("Alacritty Shift+Enter key binding already configured")  // literal 4153799
        return

    backup = makeBackup(path)   // lst.randomBytes + zv.copyFile  (loc_byte 4153898, 4153961)
    if backup fails:
        throw Error("Error backing up existing Alacritty config. Bailing out.")  // literal 4154009

    // Append keybinding TOML block to config
    ensureDir(Z$.dirname(path))   // zv.mkdir  (loc_byte 4154157)
    if content does not end with newline:   // s.endsWith  (loc_byte 4154211)
        prepend newline
    append Shift+Enter TOML binding block

    await zv.writeFile(path, updated)   // loc_byte 4154327
    show("Installed Alacritty Shift+Enter key binding")   // literal 4154383
    show("You may need to restart Alacritty for changes to take effect")  // literal 4154453
    if error:
        throw Error("Failed to install Alacritty Shift+Enter key binding")  // literal 4154678
```

Analysis basis: CC v2.1.193 bundle.js:+4153266 (`S1d` body), +4153392 (platform check), +4153545 (readFile), +4153898 (backup)

---

### Zed setup (`A1d`)

```
async function zedSetup():
    keymapPath = Z$.join(homedir(), [".config","zed","keymap.json"])  // literal 4154813, loc_byte 4154762
    ensureDir(Z$.dirname(keymapPath))   // zv.mkdir  (loc_byte 4154838)

    existing = await zv.readFile(keymapPath)   // loc_byte 4154893
    if not exists: existing = "[]"

    parsed = JSON.parse(existing)   // Bt  (loc_byte 4155369)
    if not Array.isArray(parsed):
        parsed = []

    // Check duplicate: any entry keybindings containing "shift-enter"  (literal 4154979)
    if hasShiftEnterBinding(parsed):
        show("Zed Shift+Enter key binding already configured")  // literal 4155019
        return

    backup = makeBackup(keymapPath)   // lst.randomBytes + zv.copyFile  (loc_byte 4155112, 4155175)
    if backup fails:
        throw Error("Error backing up existing Zed keymap. Bailing out.")  // literal 4155223

    // Build new entry:
    //   context: "Terminal"                   literal 4155432
    //   bindings: { "shift-enter": "terminal::SendText" + ESC+CR }  literals 4154979, 4155468
    newEntry = buildZedBinding()
    parsed.push(newEntry)   // s.push  (loc_byte 4155416)

    serialized = JSON.stringify(parsed, null, indent)   // ke  (loc_byte 4155523)
    await zv.writeFile(keymapPath, serialized)   // loc_byte 4155508
    show("Installed Zed Shift+Enter key binding")   // literal 4155579
    if error:
        throw Error("Failed to install Zed Shift+Enter key binding")  // literal 4155788
```

Analysis basis: CC v2.1.193 bundle.js:+4154762 (`A1d` body), +4154813 (keymap.json literal), +4155432–4155468 (context + action)

---

### Backup subsystem (`yxn`)

Used by all terminal handlers to protect existing config files before patching.

```
async function createBackup(targetPath):
    // Checks if a prior backup exists  (DKr.stat, loc_byte 4139223)
    // If no prior backup ("no_backup" sentinel, literal 4139160):
    //   generate random suffix via ist → mn
    //   copy original to backup path  (zv-level copyFile)
    //   record backup metadata in app state via Pn
    // On import failure: mark as "failed"  (literal 4139378)
    // On restore completion: mark as "restored"  (literal 4139460)
    // Returns boolean success
```

Analysis basis: CC v2.1.193 bundle.js:+4139134 (`yxn`), +4139160, +4139186, +4139223, +4139378, +4139460

---

### Subprocess / spawn helper (`Pn` → `Vr`)

```
function spawnWithTimeout(cmd, args, options):
    // Spawns child process  (loc_byte 1142040)
    // Timeout: 10 seconds (constant 10 at loc_byte 1141985)
    // Buffer limit: 1,000,000 bytes (loc_byte 1142595)
    // Retry count: 1  (loc_byte 1142718)
    // On error: emits "error" event  (literal at 1143030)
    // Delegates to Vr which calls I$e, DEu, Kd, an, MEu, xe
    return { stdout, stderr, exitCode }
```

Analysis basis: CC v2.1.193 bundle.js:+1142040 (`Vr`), +1141985, +1142595, +1142718, +1143030

---

### Onboarding / project completion callback (`sst`)

After a successful terminal setup, the command fires an onboarding completion event:

```
function onboardingComplete():
    mg()    // save global config  (loc_byte 4137907)
    a3i()   // write CLAUDE.md workspace marker  (loc_byte 4137952)
    // Emits telemetry event: "onboarding_project_complete"  (literal 4138012)
    we()    // daemon keep-alive signal  (loc_byte 4138009)
```

Analysis basis: CC v2.1.193 bundle.js:+4142898 (`sst` call site in `Ixn`), +4138012

---

### Output renderer (`Ixn`)

```
function renderTerminalSetupUI(resultList):
    // Dispatches per-terminal setup for each detected target:
    //   E1d  → Apple Terminal  (loc_byte 4142173)
    //   FKr  → VS Code family  (loc_byte 4142207)
    //   $Kr  → VS Code settings  (loc_byte 4142232)
    //   Axn  → Windsurf/Cursor variant  (loc_byte 4142257)
    //   S1d  → Alacritty  (loc_byte 4142512)
    //   A1d  → Zed  (loc_byte 4142543)
    //   mn   → JSX render helpers  (loc_byte 4142579)
    //   sst  → onboarding callback  (loc_byte 4142898)
    // Collects results; renders as JSX component
    return <JSX result view>
```

Analysis basis: CC v2.1.193 bundle.js:+4142173–4142579 (`Ixn` dispatch table)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_config_auth_loss_prevented` (loc_byte 13970545), `tengu_feature_ok` (1026754), `tengu_feature_bad` (1026821), `tengu_feature_sad` (1026902), `tengu_daemon_control` (17520352), `tengu_config_lock_contention` (13973651), `tengu_config_stale_write` (13973787), `tengu_config_parse_error` (13977384), `tengu_config_auto_repaired` (13974164), `tengu_config_fallback_write` (13973267) |
| Onboarding event | Literal `"onboarding_project_complete"` emitted on success (loc_byte 4138012) |
| File writes | `keybindings.json` (VS Code family), `settings.json` (GPU accel), `alacritty.toml`, `keymap.json` (Zed), macOS `com.apple.Terminal.plist` (via `defaults` CLI) |
| File backups | Random-suffix backup copies made before any patch (via `lst.randomBytes` + `zv.copyFile`); backup state tracked as `"no_backup"` / `"failed"` / `"restored"` |
| Subprocess spawns | `defaults export`, `defaults write`, `/usr/libexec/PlistBuddy`, `killall cfprefsd` (macOS only) |
| appState changes | Global config save (`mg`/`kt`), CLAUDE.md workspace marker (`a3i`/`MKr`), config lock (via `dXt`/`Qwt`) |
| Sound | None detected |
| Hook registration | None detected |

---

## Version History

| Version | Change |
|---|---|
| v2.1.193 | Initial analysis |

---

## Common Mistakes

1. **Running on non-macOS for Terminal.app / iTerm2 features**: The Apple Terminal and iTerm2 branches are gated by `platform == "darwin"`. On Linux or Windows the command falls back to a generic informational note.
2. **Expecting immediate effect without restart**: Most terminal handlers output an explicit warning that a restart is required (e.g., `"You must restart Terminal.app for changes to take effect."`, `"You may need to restart Alacritty for changes to take effect"`). Changes do not apply to the running session.
3. **Remote VS Code contexts**: When Claude Code is running inside a VS Code remote SSH session (detected by `.vscode-server` / `.cursor-server` / `.windsurf-server` / `.devin-server` home-directory markers), the VS Code keybinding patch is skipped and a warning is shown instead.
4. **Backup failure is fatal**: If the pre-patch backup fails for Terminal.app, the command aborts entirely with `"Failed to create backup of Terminal.app preferences, bailing out"`. Ensure `~/Library/Preferences/` is writable.
5. **Shift+Enter already present — idempotent, not an error**: If the binding is already detected in `keybindings.json`, `alacritty.toml`, or `keymap.json`, the command silently reports success and exits. This is intentional, not a bug.
6. **Terminals with native Shift+Enter support**: iTerm2, WezTerm, Ghostty, Kitty, Warp, and Windows Terminal already support `Shift+Enter` natively (note at loc_byte 4145276). `/terminal-setup` is a no-op or informational for these terminals.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `_1d` | Top-level async handler for `/terminal-setup` (arbor_handler) |
| `_3i` | Terminal-type detection function |
| `Ixn` | UI output renderer / per-terminal dispatcher |
| `E1d` | Apple Terminal.app setup function |
| `p3i` | macOS Terminal plist read helper |
| `ast` | Path builder for Terminal.app plist (homedir + Library/Preferences/…) |
| `Pn` | Subprocess spawn helper (wraps `Vr`) |
| `Vr` | Core child-process execution with timeout/buffer limits |
| `Pt` | Spawn utility sub-layer (calls `Eln`, `mr`) |
| `g1d` | JSX render helper for plist output (`mn`) |
| `mn` | Core JSX component renderer |
| `Vo` | JSON-with-comments parser (maps to `an`) |
| `an` | JSONC / structured data parser |
| `T` | Logging / trace emitter |
| `qFc` | Debug log formatter |
| `ke` | `JSON.stringify` wrapper |
| `Lc` | Log-line formatter (path truncation, redaction) |
| `iYe` | Output display helper (`OXo`) |
| `XFc` | File write helper with hyperlink support |
| `xe` | Error handler / queue (`eo`, `Bi`, `e_u`) |
| `eo` | Error string normalizer |
| `at` | String coercer for error messages |
| `Bi` | Error retry queue (`Rds`) |
| `e_u` | FIFO error-log queue (`fln`) |
| `Is` | Fatal error handler: logs to stderr + writes file + `process.exit` |
| `lKe` | `console.error` wrapper with red styling |
| `OT` | Error file writer (`Lse.writeFileSync`) |
| `m3i` | PlistBuddy writer for default Terminal.app profile |
| `g3i` | PlistBuddy writer for startup Terminal.app profile |
| `ist` | Random-bytes helper for backup filename generation (calls `mn`) |
| `Lo` | Styled-text output helper (foreground/background color dispatch) |
| `oLe` | ANSI color resolver (maps color name strings to chalk `St.*` calls) |
| `F7` | Hyperlink / fallback text renderer |
| `p` | Process-exit / abort wrapper |
| `vT` | Forced-shutdown signal emitter |
| `u` | Abort controller manager |
| `we` | Daemon keep-alive signal (`V`, `Oe`) |
| `Re` | Daemon stop signal (`V`, `Oe`) |
| `R$` | Daemon control dispatcher (`h5`, `ZBe`, `xGr`) |
| `Hj` | Parallel task runner (`Promise.race` / `Promise.all` with timeout) |
| `yxn` | Backup orchestrator (stat → copy → record state) |
| `h1d` | Config-write helper (`kt`) |
| `kt` | Config lock + write with timestamp (`jt`, `Date.now`, `xjf`) |
| `FKr` | VS Code keybindings.json setup function |
| `Txn` | Remote-server directory detector (`.vscode-server` etc.) |
| `bLt` | JSONC parse wrapper (`mcn`, `R4`) |
| `R4` | BOM-stripping string preprocessor |
| `eF` | Hyperlink builder (`qv`, `h3i.pathToFileURL`) |
| `qv` | Terminal hyperlink capability checker (`Xh`) |
| `Xh` | Hyperlink output formatter |
| `Bgs` | JSON keybinding array patcher (insert mode, calls `TCr`, `ICr`) |
| `TCr` | JSON AST node inserter (`Mgs`) |
| `Mgs` | JSON AST structure modifier |
| `ICr` | JSON AST index/property editor (`fcn`) |
| `fcn` | JSON substring extractor |
| `$Kr` | VS Code settings.json patcher |
| `VKr` | Array-type guard for parsed JSON |
| `CCr` | JSONC array entry updater (settings variant) |
| `Axn` | Windsurf/Cursor settings + keybindings combined setup |
| `vt` | Async feature flag checker (`V`, `Oe`) |
| `V` | Feature-flag value reader |
| `Oe` | Feature-flag store |
| `Zze` | Feature-flag initialization |
| `S1d` | Alacritty config setup function |
| `A1d` | Zed keymap setup function |
| `Bt` | Safe `JSON.parse` wrapper |
| `sst` | Onboarding completion callback |
| `mg` | Global config saver (`afe`, `kt`, `va`) |
| `a3i` | CLAUDE.md workspace marker writer (`MKr`) |
| `MKr` | CLAUDE.md file writer (`jt`, `i3i.join`, `Pt`, `Pps`) |
| `jt` | Filesystem path resolver |
| `Pps` | Prompt/content writer helper (`In`) |
| `WA` | Project config saver |
| `dXt` | Config file write-with-lock (mkdir, statSync, copyFileSync) |
| `uXs` | Object merge helper (`Object.assign`) |
| `bSt` | Config read-with-lock (readFileSync, JSON parse, backup) |
| `TSt` | Config lock token manager |
| `p9o` | Backup directory path builder |
| `Qwt` | Atomic file write (temp → rename, fsync, fchmod) |
| `m1e` | Config merge helper |
| `cXt` | Timestamp generator (`Date.now`) |
| `lXt` | Config load-with-lock (`bSt`, `Gx`) |
| `Qor` | Project config saver with lock |
| `qKr` | Config reader variant (`y1d`, `Txn`, `bLt`, `VKr`) |
| `y1d` | Config schema validator |
| `WKr` | Config write variant A |
| `GKr` | Config write variant B |
| `jKr` | Config write variant C |
| `p9e` | Platform + terminal-environment reader |
| `Exn` | Fallback/generic terminal message renderer |
| `BKr` | Additional config write variant |