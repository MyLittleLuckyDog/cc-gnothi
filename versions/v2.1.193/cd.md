---
type: feature-spec
feature: "cd"
cc_version: "2.1.193"
updated: "2026-06-26"
tags: ["cd", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.193 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/cd`

> Analysis basis: CC v2.1.193 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.193

---

## Overview

The `/cd` command moves the active Claude Code session to a new working directory supplied by the user as a path argument. It validates and resolves the target path, optionally prompts for trust confirmation when the destination has not been visited in the current session, then performs the directory change and reloads all context (configuration, memory files, tool permissions, and transcript storage) that is anchored to the working directory.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `cd` |
| description | Move this session to a new working directory |
| argumentHint | `<path>` |
| module_id | `jTl` |
| load_inline | `true` |
| loc_byte | `11369578` |
| loc_byte_end | `11369738` |
| loc_line | `7153` |
| arbor_handler.name | `vff` |
| arbor_handler.fqn | `claude-2.1.193::vff` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.193 bundle.js:+11369578

---

## Input Branching

The command has more than three distinct execution paths (no argument, invalid/inaccessible path, untrusted-directory trust gate, and successful directory change), so a Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/cd <path> invoked"]) --> B{Argument present?}
    B -- No --> C["Display usage: 'Usage: /cd <path>'\nReturn without action"]
    B -- Yes --> D["Resolve path\n(expand ~, handle relative refs,\nnormalize NFC, check null bytes)"]
    D --> E{Path resolution error?\nNull bytes / TypeError?}
    E -- Yes --> F["Display error message\n(e.g. 'Path contains null bytes')\nReturn"]
    E -- No --> G["fs.stat() the resolved path"]
    G --> H{stat() error code?}
    H -- "ENOENT" --> I["Report: directory not found"]
    H -- "ENOTDIR" --> J["Report: not a directory"]
    H -- "EACCES / EPERM" --> K["Report: permission denied"]
    H -- No error --> L["fs.realpath() to canonicalize"]
    L --> M{Destination already\ntrusted / visited\nthis session?}
    M -- Yes --> N["Skip trust prompt\nProceed to directory change"]
    M -- No --> O["Render JSX trust-confirmation dialog\n('This session hasn\u2019t worked here before…'\nYes/No buttons + keyboard: enter/escape)"]
    O --> P{User choice}
    P -- "No / escape / cancel" --> Q["Abort; stay in current directory"]
    P -- "Yes / enter / confirm" --> N
    N --> R["Execute directory change\n(process.chdir to real path)"]
    R --> S["Emit path-change event\n(Bk → npr.emit)"]
    S --> T["Reanchor shell CWD state\n(YH → KTr store update)"]
    T --> U["Reload config + CLAUDE.md memory files\n(xo.refreshConfig, Tff/rFt/nFt)"]
    U --> V["Relocate transcript storage\n(X0o: beginTranscriptRelocation → mkdir → rename/copy → endTranscriptRelocation)"]
    V --> W["Emit tengu_cd_command telemetry"]
    W --> X["Render success UI\n('Moving to a new directory: <bold path>')"]
    X --> Y["Add new system message to conversation\n(stale-context notice referencing previous directory)"]
    Y --> Z([Done])
    I --> Z
    J --> Z
    K --> Z
    F --> Z
    C --> Z
    Q --> Z
```

---

## Behavioral Spec

### 1. Path Resolution (`ds` — path sanitizer)

The handler first validates and normalizes the raw path argument before any filesystem access.

```
function sanitizePath(rawArg):
    if rawArg is null or undefined:
        raise TypeError

    if rawArg includes null byte ("\0"):
        raise Error("Path contains null bytes")   // bundle.js:+1096964

    trimmed = rawArg.trim()
    normalized = Unicode NFC normalize(trimmed)   // bundle.js:+66394

    if platform is "windows":                     // bundle.js:+1097161
        handle Windows-specific path forms

    if normalized starts with "~/":               // bundle.js:+1097092
        replace "~/" prefix with os.homedir() + path separator

    if path.isAbsolute(normalized):
        resolved = path.resolve(normalized)
    else:
        resolved = path.resolve(currentCwd, normalized)

    return resolved
```

Analysis basis: CC v2.1.193 bundle.js:+1096913

---

### 2. Usage Guard (inside `vff`)

When the command is invoked without an argument, the handler short-circuits immediately.

```
function handleCdCommand(args, context):
    if args is empty or missing:
        render("Usage: /cd <path>")   // bundle.js:+11368101
        return
    ...
```

Analysis basis: CC v2.1.193 bundle.js:+11368081

---

### 3. Filesystem Validation (`vff` main body)

After path resolution, the handler performs a two-step filesystem check.

```
function validateTarget(resolvedPath):
    try:
        stat = await fs.stat(resolvedPath)        // bundle.js:+11368192
    catch error:
        switch error.code:
            case "ENOENT":  report not-found      // bundle.js:+11368386
            case "ENOTDIR": report not-a-dir      // bundle.js:+11368400
            case "EACCES":  report permission     // bundle.js:+11368415
            case "EPERM":   report permission     // bundle.js:+11368429
        return FAIL

    realPath = await fs.realpath(resolvedPath)    // bundle.js:+11368572
    return realPath
```

Analysis basis: CC v2.1.193 bundle.js:+11368192

---

### 4. Trust Confirmation Dialog (`GTl` / JSX component)

For directories that have not been visited in the current session, a JSX confirmation dialog is rendered before any directory change is performed.

```
function renderTrustDialog(targetPath, onConfirm, onCancel):
    display message:
        "This session hasn't worked here before. Is this a directory
         you created or one you trust?"            // bundle.js:+11365293 / +11365317
    display sub-message:
        "Claude Code will be able to read, edit, and execute files here."
                                                   // bundle.js:+11365435
    show link: "Security guide"                   // bundle.js:+11365679
        href: "https://code.claude.com/docs/en/security"  // bundle.js:+11365627

    buttons:
        primary:   "Yes, move here"  → onConfirm  // bundle.js:+11365773
        secondary: "No, stay put"    → onCancel   // bundle.js:+11365802

    keyboard bindings:
        "enter" / "confirm" → onConfirm           // bundle.js:+11366003 / +11366018
        "escape" / "cancel" → onCancel            // bundle.js:+11366047 / +11366063
```

Analysis basis: CC v2.1.193 bundle.js:+11365230

---

### 5. Directory Change and Shell State Update (`Iff`)

The core directory-change logic runs after trust is confirmed.

```
async function performDirectoryChange(realPath):
    currentCwd = getCwd()                         // bundle.js:+11368605 (Pt)
    process.chdir(realPath)                       // bundle.js:+11366654

    // Update shell CWD in async-context store
    updateShellCwd(realPath)                      // bundle.js:+11366671 (YH)
        // normalizes absolute path, updates yln store (KTr), emits internal event

    // Emit filesystem path-change event
    emitPathChange(realPath)                      // bundle.js:+11366677 (Bk → npr.emit +46832)

    // Update transcript storage location
    await relocateTranscriptStorage(realPath)     // bundle.js:+11366705 (X0o)

    // Invalidate bypass-permissions mode if active
    disableBypassPermissionsIfNeeded()            // bundle.js:+11366949 ($4i)

    // Re-anchor memory/rules filesystem watchers
    reanchorMemoryWatchers()                      // bundle.js:+11366959 (yz → aie.reanchor +1154777)

    // Reload configuration for new directory
    await refreshConfig()                         // bundle.js:+11367010 (xo.refreshConfig)

    // Emit primary command telemetry
    emit("tengu_cd_command")                      // bundle.js:+11367031

    // Rebuild CLAUDE.md memory tree for new root
    rebuildMemoryFiles()                          // bundle.js:+11367066 (Tff)
```

Analysis basis: CC v2.1.193 bundle.js:+11366642

---

### 6. Transcript Relocation (`X0o`)

This sub-operation migrates transcript files from the old session storage directory to a new location derived from the target path.

```
async function relocateTranscriptStorage(newCwd):
    newStoragePath = path.join(storageRoot, "cd", ...)  // bundle.js:+13457087
    permissions = 448  // octal 0o700                   // bundle.js:+13457248

    transcriptManager.beginTranscriptRelocation()        // bundle.js:+13457162
    await transcriptManager.flush()                      // bundle.js:+13457202
    await fs.mkdir(newStoragePath, {mode: permissions})  // bundle.js:+13457218

    // Move or copy transcript files
    await moveTranscriptFiles(oldPath, newStoragePath)   // bundle.js:+13457264 (eYl)
        // handles EEXIST, EBUSY, ENOTEMPTY, EXDEV, EISDIR, ENOTSUP

    transcriptManager.endTranscriptRelocation()          // bundle.js:+13457480
```

Analysis basis: CC v2.1.193 bundle.js:+13457024

---

### 7. Memory File Tree Rebuild (`Tff`)

After the directory change is committed, the handler rebuilds the CLAUDE.md instruction tree for the new working directory hierarchy.

```
function rebuildMemoryFileTree(newCwd):
    // Walk directory ancestry, collecting CLAUDE.md files
    ancestors = []
    currentDir = parse(newCwd)
    while currentDir is not root:
        ancestors.push(currentDir)
        currentDir = dirname(currentDir)
    ancestors.reverse()                           // bundle.js:+11366560

    for each ancestor in ancestors:
        push project-level memory entries         // CLAUDE.md  (+5205252)
        push local memory entries                 // CLAUDE.local.md (+5205420)
        push rules directory entries              // .claude/rules (+5205319)

    // Also scan workspace files
    scanWorkspaceMemoryFiles(newCwd)              // bundle.js:+11366607 (nFt)
```

Analysis basis: CC v2.1.193 bundle.js:+11366447

---

### 8. Success UI and Stale-Context Notice (`Cff`, `vff`)

After a successful directory change the command renders a success banner and injects a system message into the conversation to mark prior tool results as stale.

```
function renderSuccessUi(oldCwd, newRealPath):
    displayBanner("Moving to a new directory: " + bold(newRealPath))
                                                   // bundle.js:+11366183 / +11367526

    // Build display path (abbreviate home as ~)
    displayPath = prettifyPath(newRealPath)        // bundle.js:+11368705 (FTl / $H)

    // Inject system message into conversation context
    systemMsg = buildSystemMessage(oldCwd, newRealPath)  // bundle.js:+11368956 (T)
        // message references: "previous directory — that information is stale.
        //                      All tool calls and …"   (+11367225)
    appendMessage(systemMsg, role="system")        // bundle.js:+11368919
```

Analysis basis: CC v2.1.193 bundle.js:+11368781

---

### 9. Path Display Formatting (`FTl` / `$H` — pretty-printer)

The display path shown in UI and messages abbreviates the home directory with `~`.

```
function prettifyPath(absolutePath):
    home = os.homedir()                            // bundle.js:+195957
    if absolutePath starts with home:
        return "~" + absolutePath.slice(home.length)  // bundle.js:+196056
    return absolutePath

    // Symlinks are resolved before this point (hXn.realpath +11368572)
    // Path is normalized with NFC before display  (NH +1097020)
```

Analysis basis: CC v2.1.193 bundle.js:+195957

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_cd_command` (bundle.js:+11367031) — fired on every completed directory change |
| Telemetry — shell CWD | `tengu_shell_set_cwd` (bundle.js:+7198876) — emitted when async-context store is updated |
| Telemetry — bypass-permissions | `tengu_disable_bypass_permissions_mode` (bundle.js:+3405833) — emitted if bypass mode was active and is cleared on cd |
| Telemetry — config lock | `tengu_config_lock_contention`, `tengu_config_stale_write`, `tengu_config_parse_error`, `tengu_config_auto_repaired`, `tengu_config_auth_loss_prevented`, `tengu_config_fallback_write` (bundle.js:+13973651–+13973267) — emitted during config reload |
| Telemetry — daemon/bg (indirect) | `tengu_daemon_config_reload`, `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable/claim/claim_fail`, `tengu_daemon_control`, `tengu_bg_state_read_transient` — reached through deep call paths during session management |
| Telemetry — memory files | `tengu_claude_rules_md_permission_error`, `tengu_paper_halyard` — emitted during CLAUDE.md tree rebuild |
| process.cwd() mutation | `process.chdir(realPath)` is called; changes the Node.js process working directory globally (bundle.js:+11366654) |
| Async-context store | Shell CWD entry in `yln` async-local-storage store is updated to the new canonical path (bundle.js:+1062014) |
| Path-change event | Internal event emitted via `npr.emit` (bundle.js:+46832) to notify listeners of the CWD change |
| Transcript storage | Transcript files relocated from old storage directory to a new directory derived from the new CWD; permissions set to `0o700` (448 decimal) (bundle.js:+13457218, +13457248) |
| Memory watchers | `aie.reanchor` called to reattach filesystem watchers for CLAUDE.md files to the new directory tree (bundle.js:+1154777) |
| Configuration reload | `xo.refreshConfig()` re-reads all settings layers (user, project, local, policy, flag settings) from the new directory context (bundle.js:+11367010) |
| CLAUDE.md tree | Fully rebuilt for the new working directory ancestry, including `CLAUDE.md`, `CLAUDE.local.md`, and `.claude/rules/` entries (bundle.js:+11366447) |
| Bypass-permissions mode | Cleared if active when the working directory changes (bundle.js:+11366949, +4299077) |
| Conversation context | A `system`-role message is appended to the conversation marking all prior tool results from the old directory as stale (bundle.js:+11368919) |
| Hook registration | `a7o.register` called during transcript relocation (bundle.js:+68040 via `Ei`) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.193 | Initial analysis |

---

## Common Mistakes

1. **Omitting the argument entirely.** Running `/cd` with no path displays `Usage: /cd <path>` and does nothing. Always supply an explicit path, e.g. `/cd ~/projects/myapp`.
2. **Using a file path instead of a directory path.** If the target resolves to a regular file, `fs.stat` will succeed but the `isDirectory()` check will fail (ENOTDIR-class error). The command only accepts directories.
3. **Assuming relative paths are resolved from the shell's cwd.** The path is resolved relative to the session's current working directory at the time `/cd` is invoked, which may differ from a spawned sub-shell's cwd.
4. **Expecting instant tool-result validity after `/cd`.** The command injects a system message marking all prior tool outputs as stale. Claude's understanding of files and paths from before the `cd` is explicitly invalidated and must be re-queried.
5. **Dismissing the trust dialog without reading it.** Choosing "No, stay put" silently aborts the command. If the directory change appears to have had no effect, the trust dialog may have been dismissed via the Escape key or "No" button.
6. **Using `~` expansion on Windows without accounting for path separator.** The tilde expansion uses `~/` (forward slash) as the trigger; on Windows paths the handler applies special casing (bundle.js:+1097161) but mixing separators in the argument can cause unexpected resolution.
7. **Relying on bypass-permissions mode persisting across a `/cd`.** The command explicitly clears bypass-permissions mode when the working directory changes (bundle.js:+11366949).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `vff` | Main async handler for `/cd` command (AsyncFunction, Arbor-resolved) |
| `e` | Random-jitter / setTimeout utility (used in retry paths) |
| `ds` | Path sanitizer and resolver (null-byte check, NFC normalize, tilde expand, platform handling) |
| `Pt` | Get current working directory helper |
| `Eln` | Async-context store accessor (reads yln store) |
| `kK` | CWD value extractor from store |
| `mr` | Platform / process CWD accessor |
| `Rx` | Process object reference |
| `jt` | Logging / debug utility |
| `n` | Various local iteration variables across call sites |
| `i` | Stream / iterator variable (multiple contexts) |
| `r` | Filesystem or path variable (multiple contexts) |
| `s` | Utility set / state variable (multiple contexts) |
| `NH` | Unicode NFC normalizer |
| `an` | Error logger / reporter |
| `FTl` | Path display formatter (abbreviates home, builds pretty display path) |
| `es` | JSX element factory helper |
| `$H` | Home-directory-aware path prettifier (expands/contracts `~`) |
| `t` | Generic local variable (multiple contexts) |
| `Gc` | Path segment getter |
| `$p` | Path part processor |
| `KI` | Path component iterator (split, push, pop for `..` resolution) |
| `Ggr` | Symlink-aware path resolution utility |
| `c` | Stat result / callback variable (multiple contexts) |
| `d` | Daemon/supervisor process variable |
| `l` | Set / list variable (multiple contexts) |
| `C8l` | Background session state reader |
| `wse` | Recursive symlink resolver with cycle detection |
| `f` | Background session process object |
| `o` | Output formatter / array accumulator |
| `Md` | Real-path resolver (wraps realpathSync) |
| `Rqt` | Tilde-prefix stripper for display |
| `Aff` | Permission pattern evaluator for path-allow-list |
| `xqt` | Glob-pattern-to-regex converter |
| `O9f` | Combined path resolution and permission source lookup |
| `xVe` | Pattern normalization utility |
| `bff` | Permission-check result builder |
| `cq` | Deny-rule evaluator |
| `o3o` | Rule-list iterator |
| `ug` | Pattern matcher / glob helper |
| `GSe` | Allow-rule evaluator |
| `SQl` | Allow-rule set builder |
| `t8e` | Shell type detector / classifier |
| `oTo` | Shell name resolver |
| `fWt` | Shell detection cache initializer |
| `gWt` | Shell name normalizer |
| `rTo` | Shell category mapper |
| `Ur` | App-state reader (retrieves current working_directory, allowed_tools, etc.) |
| `F7n` | Allowed-tools app-state extractor |
| `B7n` | Disallowed-tools app-state extractor |
| `F$` | Bypass-permissions-mode state accessor |
| `it` | Telemetry event emitter |
| `KPt` | Telemetry payload builder |
| `zPt` | Telemetry transport |
| `H5` | Telemetry batch flusher |
| `lCn` | Telemetry deduplication guard |
| `kt` | Core telemetry emit function |
| `Cff` | Success-UI renderer (banner + bold path display) |
| `Lp` | Text bold formatter |
| `AAu` | HTML-entity replacer |
| `PPe` | Path display component |
| `Ggs` | Display-path string builder |
| `Iff` | Directory-change executor (process.chdir + all post-change side effects) |
| `YH` | Shell CWD async-context store updater |
| `In` | Error constructor helper |
| `KTr` | CWD store writer (updates yln async-local-storage) |
| `ZQ` | Store value normalizer |
| `V` | Void / no-op return sentinel |
| `Bk` | Path-change event emitter (wraps npr.emit) |
| `Wbt` | Path normalization before event emission |
| `X0o` | Transcript storage relocator |
| `Lt` | Storage root resolver |
| `Kc` | Hook registrar for transcript events |
| `Ei` | Hook/event system register |
| `b9` | Transcript path builder |
| `at` | String coercion helper |
| `fYl` | Transcript file namer |
| `s4` | Session ID accessor |
| `jFe` | Transcript writer initializer |
| `cA` | Storage event emitter |
| `zzo` | Storage event formatter |
| `Kzo` | Nen event dispatcher |
| `eYl` | Transcript file mover (rename/copy with fallback) |
| `yYl` | Recursive directory copier |
| `T` | System message builder / conversation appender |
| `qFc` | Message-role formatter |
| `ke` | JSON serializer |
| `Lc` | Content redactor (replaces sensitive data with `[REDACTED]`) |
| `iYe` | Message metadata tagger |
| `XFc` | Full message pipeline (format + redact + send) |
| `xe` | Error log writer |
| `eo` | Error formatter |
| `Bi` | Log destination selector |
| `e_u` | Log ring-buffer manager |
| `$4i` | Bypass-permissions-mode clearer |
| `$y` | Bypass-permissions state deleter |
| `Gi` | Background session state writer |
| `a` | State accessor variable |
| `u` | Session process utility |
| `qd` | Error reporter helper |
| `Bt` | JSON parser helper |
| `$d` | Config persistence helper |
| `Nm` | Atomic file writer (randomBytes temp → rename) |
| `Uf` | Config write coordinator |
| `be` | String coercion for config values |
| `yz` | Memory-watcher re-anchor caller |
| `Zy` | Post-cd cleanup step |
| `Tff` | CLAUDE.md memory-file tree rebuilder |
| `GT` | Path normalizer for memory file paths |
| `rFt` | Directory ancestry walker for CLAUDE.md discovery |
| `Sm` | Config source resolver |
| `r6` | Memory-file entry builder |
| `o0e` | Recursive directory scanner for `.md` memory files |
| `Z$t` | Relative-path filter for memory file scanner |
| `nFt` | Workspace memory file scanner |
| `HXn` | HTML-entity encoder (ampersand, angle brackets, carriage return, newline) |
| `Iw` | Post-change notification step |
| `d_t` | Current-directory telemetry payload builder |
| `oW` | Path normalizer (normalize + platform separator replacement) |
| `Dqt` | New-directory telemetry payload builder |
| `mn` | Global config saver |
| `dXt` | Config file writer with lock and backup rotation |
| `uXs` | Config lock token generator |
| `bSt` | Config reader with access-guard |
| `TSt` | Config backup manager |
| `p9o` | Backup directory path builder |
| `v` | Local variable (multiple contexts) |
| `y` | Local variable (multiple contexts) |
| `I` | UI scroll/layout variable |
| `Qwt` | Atomic file-write-and-flush (temp file → fsync → rename) |
| `m1e` | Config merge utility |
| `l9o` | Config entries iterator |
| `cXt` | Config timestamp recorder |
| `lXt` | Config backup loader |
| `Qor` | Config save-with-lock orchestrator |
| `Oe` | Async scheduler / microtask helper |
| `GTl` | Trust-confirmation JSX dialog component |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.