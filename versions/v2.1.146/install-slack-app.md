---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.146"
updated: "2026-06-01"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.146 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.146 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.146

---

## Overview

`/install-slack-app` is a local utility command that opens the Claude Slack app installation page in the user's default browser. It fires a single telemetry event to record the interaction, emits a status message to the UI, and delegates to a platform-aware browser-opener utility to launch the installation URL. There is no model call and no interactive input required.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `Zj1` |
| load_inline | `true` |
| loc_byte | `11112595` |
| loc_byte_end | `11112781` |
| arbor_handler.name | `av7` |
| arbor_handler.fqn | `claude-2.1.146::av7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.146 bundle.js:+11112595

---

## Input Branching

This command has a simple linear flow (no user-supplied arguments; one unconditional code path). A numbered pseudocode list is used.

1. User invokes `/install-slack-app` in the CLI.
2. Handler `av7` fires immediately — no argument validation or branching.
3. Telemetry event `tengu_install_slack_app_clicked` is emitted.
4. The config-with-lock writer (`K8`) is called to persist any pending state.
5. The browser-opener (`MK`) is called with the Slack app installation URL.
6. A text-type result containing the status message `"Opening Slack app installation page in browser…"` is returned to the UI.

---

## Behavioral Spec

### Top-Level Handler (`av7`)

```
async function installSlackAppHandler(context):

    # Step 1 — record intent
    emitTelemetry("tengu_install_slack_app_clicked")
    # Analysis basis: CC v2.1.146 bundle.js:+11112201

    # Step 2 — persist config state (acquires file lock)
    await saveConfigWithLock(context)
    # Analysis basis: CC v2.1.146 bundle.js:+11112239

    # Step 3 — open browser
    await openBrowserToUrl(SLACK_INSTALL_URL)
    # Analysis basis: CC v2.1.146 bundle.js:+11112314

    # Step 4 — return UI message
    return {
        type: "text",
        value: "Opening Slack app installation page in browser…"
    }
    # Analysis basis: CC v2.1.146 bundle.js:+11112334, +11112347
```

---

### Config Save With Lock (`K8`)

Wraps the on-disk config write in an exclusive file-system lock to prevent concurrent Claude instances from corrupting `~/.claude.json`.

```
async function saveConfigWithLock(context):

    lockPath = deriveLockPath(configDir)
    acquireLock(lockPath)          # blocks; warns on contention (see telemetry)

    try:
        currentDiskConfig = readConfigFile()

        # Safety guard (GH #3117): refuse to overwrite if re-read copy
        # is missing auth credentials that the in-memory cache holds.
        if cacheHasAuth AND NOT diskConfigHasAuth:
            emitTelemetry("tengu_config_auth_loss_prevented")
            log warning "saveConfigWithLock: re-read config is missing auth…"
            return   # abort write; do not wipe credentials
            # Analysis basis: CC v2.1.146 bundle.js:+3169039, +3169191

        mergedConfig = mergeWithCache(currentDiskConfig)
        atomicWriteConfig(mergedConfig)   # via writeFileAtomically()

    finally:
        releaseLock(lockPath)
```

Analysis basis: CC v2.1.146 bundle.js:+3165714

**Lock-contention warning**: if lock acquisition takes longer than expected, the string `"Lock acquisition took longer than expected - another Claude instance may be running"` is logged at level `"error"` and telemetry event `tengu_config_lock_contention` is fired.
(Analysis basis: CC v2.1.146 bundle.js:+3168623, +3168712)

**Stale-write guard**: if the on-disk config diverges from the cache after re-read, `tengu_config_stale_write` is emitted.
(Analysis basis: CC v2.1.146 bundle.js:+3168848)

**Parse-error guard**: if `readConfigFile()` produces a JSON parse error, `tengu_config_parse_error` is emitted and the write is aborted.
(Analysis basis: CC v2.1.146 bundle.js:+3171293)

---

### Atomic Config Write (`dK_`)

Used by `saveConfigWithLock` to safely replace the config file.

```
function atomicWriteConfig(data, targetPath):

    tmpPath = targetPath + ".backup." + Date.now()
    # Analysis basis: CC v2.1.146 bundle.js:+3169509, +3168484

    ensure parent directory exists (mkdirSync)

    write data to tmpPath
    apply original file permissions via fchmodSync
    fsyncSync to flush OS buffers

    # Rotate old backups: keep at most 5
    existingBackups = listBackupFiles(targetPath)
    while existingBackups.length > 5:
        unlinkSync(oldest backup)
    # Analysis basis: CC v2.1.146 bundle.js:+3169642

    renameSync(tmpPath, targetPath)   # atomic on POSIX
    # Analysis basis: CC v2.1.146 bundle.js:+3168412
```

Analysis basis: CC v2.1.146 bundle.js:+3165714

---

### Browser Opener (`MK`)

Opens the installation URL in the system default browser using the appropriate platform command.

```
async function openBrowserToUrl(url):

    # Validate URL scheme
    if NOT (url.startsWith("http:") OR url.startsWith("https:")):
        throw Error("invalid URL scheme")
    # Analysis basis: CC v2.1.146 bundle.js:+6447971, +6447993, +6447921

    platform = detectPlatform()   # via DJ

    if platform == "darwin":
        spawn("open", [url])
        # Analysis basis: CC v2.1.146 bundle.js:+6448280, +6448454

    elif platform == "win32":
        spawn("rundll32", ["url,OpenURL", url])
        # Analysis basis: CC v2.1.146 bundle.js:+6448296, +6448380, +6448392

    else:   # Linux / other
        spawn("xdg-open", [url])
        # Analysis basis: CC v2.1.146 bundle.js:+6448461
```

Analysis basis: CC v2.1.146 bundle.js:+6448208

---

### Atomic Symlink-Safe Write Utility (`hq6`)

Low-level helper (called transitively by the config-write path) that writes a file atomically, preserving symlinks and existing permissions.

```
function atomicSymlinkSafeWrite(targetPath, content):

    lstat targetPath → check if symbolic link
    # Analysis basis: CC v2.1.146 bundle.js:+1001660

    if symlink:
        resolvedPath = readlinkSync + resolve to absolute
        # Analysis basis: CC v2.1.146 bundle.js:+1001265, +1001285

    tmpName = randomBytes(6).toString("hex") + suffix
    # Analysis basis: CC v2.1.146 bundle.js:+1001890, +1001906, +1001918

    fd = openSync(tmpName, flags)
    writeFileSync via fd
    fchmodSync to match original permissions (octal 0o600 = 384 decimal)
    # Analysis basis: CC v2.1.146 bundle.js:+1002384, +3169924
    fsyncSync(fd)
    closeSync(fd)

    renameSync(tmpName, resolvedPath)
    # Analysis basis: CC v2.1.146 bundle.js:+1002578

    on error ELOOP or ENOTDIR: surface as structured error
    # Analysis basis: CC v2.1.146 bundle.js:+1001551, +1001564
```

Analysis basis: CC v2.1.146 bundle.js:+1001178

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_install_slack_app_clicked` fired on every invocation (bundle.js:+11112201) |
| Telemetry — config lock | `tengu_config_lock_contention` if lock acquisition is slow (bundle.js:+3168712) |
| Telemetry — stale write | `tengu_config_stale_write` if on-disk config drifted (bundle.js:+3168848) |
| Telemetry — parse error | `tengu_config_parse_error` on JSON parse failure (bundle.js:+3171293) |
| Telemetry — auth guard | `tengu_config_auth_loss_prevented` if write would wipe credentials (bundle.js:+3169191) |
| Telemetry — bg session | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_spare_spawn` (background daemon subsystem, reachable transitively via `W8`/`V_`) |
| Config write | Acquires exclusive file lock; writes `~/.claude.json` atomically with backup rotation (max 5 backups) |
| Browser launch | Spawns OS-native opener process (`open` / `rundll32` / `xdg-open`) |
| UI output | Returns a `text`-type result with the message `"Opening Slack app installation page in browser…"` (bundle.js:+11112334) |
| Hook registration | None detected in depth-2 traversal |
| Sound | None detected in depth-2 traversal |
| supportsNonInteractive | `false` — must be run in an interactive session |

---

## Version History

| Version | Change |
|---|---|
| v2.1.146 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode**: `supportsNonInteractive` is `false`. Invoking this command in a scripted or piped non-interactive session will not work as expected.
2. **No browser installed / headless environment**: The command unconditionally calls the OS browser opener. On headless servers without a browser or display, the spawned process (`xdg-open`, etc.) will fail silently or produce an error in the shell; the CLI itself will still return the success text message.
3. **Expecting model output**: This is a `local`-type command — it never calls the Claude model. The only output is the fixed status string.
4. **Concurrent Claude instances holding the config lock**: If another Claude instance is already writing config, this command's `saveConfigWithLock` call will stall briefly and emit `tengu_config_lock_contention`. This is expected behavior; the command will complete after the lock is released.
5. **Platform detection edge cases**: On Linux distributions where `xdg-open` is absent, the browser-launch step will fail. The command does not fall back to printing the URL directly.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `av7` | Top-level async handler for `/install-slack-app` (arbor_handler) |
| `c` | Telemetry emit helper |
| `K8` | Save-config-with-lock orchestrator |
| `dK_` | Atomic config file writer (backup + rename) |
| `_` | Filesystem abstraction / virtual FS layer |
| `Q6` | Path utility / config path resolver |
| `L` | Primary filesystem module (fs-like) |
| `q` | Secondary filesystem module (fs-like) |
| `f` | File handle / stream abstraction |
| `jA9` | HTTP request builder |
| `os8` | HTTP transport base |
| `N` | Shell command executor |
| `$wK` | Shell output formatter |
| `H` | Random / retry utility |
| `CH` | JSON serializer wrapper |
| `O4` | String/path manipulation helper |
| `NRH` | Error normalizer |
| `YwK` | HTTP response stream handler |
| `L8` | Structured error constructor |
| `Y$H` | Config file reader / parser |
| `g6` | JSON parse wrapper |
| `AC` | String prefix stripper |
| `rI9` | Directory listing / config discovery |
| `SH` | Subprocess result handler |
| `cK_` | Backup path composer |
| `w` | Background process / daemon manager |
| `if6` | Config backup rotator |
| `A` | Case-normalization / lookup map |
| `Z` | Prefix-check target string |
| `X` | MCP server connector |
| `Yv8` | MCP transport initializer |
| `n_` | Error factory |
| `V` | Slice / window over result set |
| `hq6` | Atomic symlink-safe file write utility |
| `O` | Stat result wrapper |
| `J8` | Error code mapper |
| `bUH` | Config cache reader |
| `iI9` | Config entry iterator |
| `xUH` | Config timestamp tracker |
| `QK_` | Config hash / integrity helper |
| `MK` | Platform-aware browser opener |
| `cVL` | URL scheme validator |
| `DJ` | Platform detector |
| `W8` | Background session launcher |
| `V_` | Daemon spawn coordinator |
| `v2H` | Daemon process factory |
| `D` | Background session lifecycle manager |
| `lpK` | String coercion utility |
| `JI` | Session ID generator |
| `x6` | Async-local-storage context accessor |
| `Wb6` | Store getter wrapper |
| `D_` | User-visible context resolver |