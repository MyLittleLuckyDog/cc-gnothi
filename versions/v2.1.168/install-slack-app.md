---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.168"
updated: "2026-06-11"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.168 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.168 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.168

---

## Overview

`/install-slack-app` is a local slash command that opens the Claude Slack application installation page directly in the user's default browser. It records a telemetry event at invocation and then delegates to the platform-aware URL-opener utility, emitting a brief status message to the terminal before opening the URL.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| loc_byte | `11672860` |
| loc_byte_end | `11673046` |
| loc_line | `8174` |
| supportsNonInteractive | `false` |
| module_id | `scq` |
| load_inline | `true` |
| handler_name (arbor) | `YGf` |
| arbor_handler.name | `YGf` |
| arbor_handler.fqn | `claude-2.1.168::YGf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.168 bundle.js:+11672860

---

## Input Branching

This command has a simple, nearly linear flow (no user-supplied argument branching). A numbered pseudocode list is appropriate.

1. User invokes `/install-slack-app` in the CLI.
2. Handler `openSlackInstall` fires; telemetry event `tengu_install_slack_app_clicked` is emitted immediately (bundle.js:+11672466).
3. Handler calls `openUrlInBrowser` (identifier `X8`) to open the Slack-app installation URL (bundle.js:+11672504).
4. `openUrlInBrowser` selects the OS-specific launcher:
   - **macOS** (`darwin`): `open <url>` (bundle.js:+6815071 / +6815245)
   - **Windows** (`win32`): `rundll32 url,OpenURL <url>` (bundle.js:+6815087 / +6815171)
   - **Linux / other**: `xdg-open <url>` (bundle.js:+6815252)
5. Before launching the browser, the handler prints the status text `"Opening Slack app installation page in browser…"` (bundle.js:+11672612) as a `"text"` type output (bundle.js:+11672599).
6. Control returns; no further agent loop interaction takes place.

---

## Behavioral Spec

### Top-level handler — `openSlackInstall`

```
async function openSlackInstall(context):
    emit telemetry("tengu_install_slack_app_clicked")      // bundle.js:+11672466
    print({ type: "text",
            content: "Opening Slack app installation page in browser…" })
    await openUrlInBrowser(SLACK_INSTALL_URL)              // bundle.js:+11672504
    return
```

Analysis basis: CC v2.1.168 bundle.js:+11672464–+11672579

---

### URL-opening utility — `openUrlInBrowser`

```
async function openUrlInBrowser(url):
    platform = detectPlatform()                 // checks process.platform
    if platform == "darwin":
        spawn("open", [url])
    else if platform == "win32":
        spawn("rundll32", ["url,OpenURL", url])
    else:
        spawn("xdg-open", [url])
```

Analysis basis: CC v2.1.168 bundle.js:+3262406 (call entry `X8`), +6815071, +6815087, +6815245, +6815252

---

### Platform-detection guard — `validateUrlScheme`

Inside `openUrlInBrowser`, the URL is validated before use. Strings `"http:"` (bundle.js:+6814762) and `"https:"` (bundle.js:+6814784) are the only accepted schemes. Violations surface via the `_j7` error-constructor path (bundle.js:+6814712).

```
function validateUrlScheme(url):
    scheme = extractScheme(url)
    if scheme not in ["http:", "https:"]:
        throw Error("invalid URL scheme")
```

Analysis basis: CC v2.1.168 bundle.js:+6814762, +6814784, +6814712

---

### Config-lock helper — `saveConfigWithLock`

`openSlackInstall` indirectly calls the config-persistence layer (`sP_`) via `X8`. That layer acquires a filesystem lock before persisting any side-effect state. Relevant guard behaviour:

- If lock acquisition exceeds expected time a warning `"Lock acquisition took longer than expected - another Claude instance may be running"` is logged (bundle.js:+3265503).
- If a re-read of the on-disk config is missing auth data that the in-memory cache holds, the write is refused and `tengu_config_auth_loss_prevented` is emitted to prevent wiping `~/.claude.json` (bundle.js:+3266071). A corresponding log message references GH #3117 (bundle.js:+3265919).
- Config files are read as `"utf-8"` (bundle.js:+3267619) and parsed via JSON (bundle.js:+186041).
- Up to **5** backup copies are retained (bundle.js:+3266522).
- Backup filenames contain the `".backup."` infix (bundle.js:+3266389).
- A 60 000 ms (60 s) timeout is applied to the lock-write cycle (bundle.js:+3266273).

```
function saveConfigWithLock(configData):
    acquireLock()
    if lockTookTooLong:
        log("Lock acquisition took longer than expected …")
        emit telemetry("tengu_config_lock_contention")
    reDisk = readConfigFromDisk()
    if reDisk.auth is missing AND cache.auth is present:
        emit telemetry("tengu_config_auth_loss_prevented")
        log("saveConfigWithLock: re-read config is missing auth …")
        return   // refuse write
    writeConfigAtomically(configData)
    pruneBackupsKeepNewest(5)
```

Analysis basis: CC v2.1.168 bundle.js:+3265292–+3266842

---

### `openUrlInBrowser` — Arbor-resolved call chain

```
openSlackInstall (YGf)
  └─ openUrlInBrowser (X8)
       └─ saveConfigWithFileLock (sP_)
            ├─ acquireLock (_)
            ├─ path.dirname (dD.dirname)
            ├─ logDebug (d6)
            ├─ fs.mkdirSync (L.mkdirSync)
            ├─ buildHttpRequest (v)
            │    ├─ formatHttpHeaders (NUH)
            │    └─ sendHttpRequest (snK)
            ├─ readConfigFile (LwH)
            │    ├─ fs.readFileSync
            │    └─ JSON.parse
            └─ atomicFileWrite (O$6)
                 ├─ fs.openSync / closeSync / fsyncSync / fchmodSync
                 └─ fs.renameSync
```

Analysis basis: CC v2.1.168 bundle.js:+3262406, +11672504

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_install_slack_app_clicked` (bundle.js:+11672466) — fired unconditionally on command invocation |
| Telemetry — config lock | `tengu_config_lock_contention` (bundle.js:+3265592) — if lock acquisition is slow |
| Telemetry — stale write | `tengu_config_stale_write` (bundle.js:+3265728) — if on-disk config became stale |
| Telemetry — auth loss | `tengu_config_auth_loss_prevented` (bundle.js:+3266071) — if write refused to protect auth |
| Telemetry — config parse error | `tengu_config_parse_error` (bundle.js:+3268167) — if config JSON cannot be parsed |
| Telemetry — bg dispatch | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail` — background worker lifecycle (reachable via daemon infra in call graph) |
| Telemetry — daemon | `tengu_daemon_control`, `tengu_daemon_config_reload` — daemon control plane |
| Telemetry — bg memory | `tengu_bg_retire_pinned_low_mem`, `tengu_bg_prewarm_per_sweep` — background worker memory management |
| Hook registration | None observed at depth ≤ 2 |
| appState changes | None observed; command is read-only from the session perspective |
| Filesystem side effect | Config lock file created/deleted under config directory; up to 5 backup files retained |
| Sound | None |
| Browser side effect | Opens default OS browser to Slack app installation page |
| Non-interactive support | `supportsNonInteractive: false` — command must run in an interactive terminal session |

---

## Version History

| Version | Change |
|---|---|
| v2.1.168 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive / CI environments**: `supportsNonInteractive` is `false`; invoking `/install-slack-app` in a headless or scripted context will fail or be silently skipped because there is no browser to open.
2. **Assuming a URL argument is accepted**: The command takes no user-supplied arguments — the destination URL is hardcoded inside the handler. Passing extra text after `/install-slack-app` has no effect.
3. **Expecting agent output**: The command prints a single status line (`"Opening Slack app installation page in browser…"`) and exits; it does not start an agent turn or stream any model response.
4. **Confusing with MCP tool calls**: This is a local CLI slash command (`type: local`), not an MCP prompt or tool. It does not involve the model or the MCP protocol.
5. **Ignoring the config-lock warning**: If the log shows `"Lock acquisition took longer than expected …"`, another Claude Code instance may be holding the config lock, which can delay the command's indirect config write path.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `YGf` | Top-level async handler for `/install-slack-app` (`openSlackInstall`) |
| `l` | General logging / output helper |
| `X8` | Platform-aware URL opener (`openUrlInBrowser`) |
| `sP_` | Config save with filesystem lock (`saveConfigWithLock`) |
| `_` | Filesystem lock acquisition helper |
| `d6` | Debug logger |
| `L` | Filesystem abstraction (sync ops: `mkdirSync`, `statSync`, `copyFileSync`, `unlinkSync`, `readdirStringSync`) |
| `q` | Secondary filesystem abstraction (sync ops: `unlinkSync`, `readFileSync`, `statSync`, `mkdirSync`, `readdirStringSync`, `copyFileSync`, `renameSync`) |
| `f` | File handle / stream object |
| `R21` | Config object builder / merge helper |
| `QM_` | Config schema validator |
| `v` | HTTP request builder / sender |
| `snK` | HTTP send helper |
| `H` | Bootstrap fetch / API client |
| `RH` | JSON serialiser wrapper |
| `G4` | String path/URL normaliser |
| `EUH` | Error formatter |
| `_iK` | Atomic file write sequencer |
| `V8` | Error categoriser / re-throw helper |
| `LwH` | Config file reader (reads, parses, validates) |
| `U6` | JSON parse wrapper |
| `Hu` | String prefix-strip utility |
| `No1` | Config backup directory enumerator |
| `tP_` | Path join utility for backup filenames |
| `w` | Background daemon session manager |
| `aj6` | Auth-presence checker (guards stale-write detection) |
| `A` | String case-normaliser (`.toLowerCase`) |
| `V` | Background worker start/stop controller |
| `P` | Vim-mode / editor input processor (reached via daemon infra) |
| `J` | Worker wrapper |
| `j` | Worker kill helper |
| `z` | Daemon stop controller |
| `Y` | Supervisor / daemon config reload handler |
| `h` | Background sweep / memory-pressure handler |
| `EOA` | Vim motion registry |
| `C` | Rate-limit event executor |
| `E` | Background worker lifecycle manager |
| `O$6` | Atomic file write primitive (temp-rename pattern) |
| `O` | Symbolic-link stat helper |
| `h8` | Error code classifier for filesystem errors |
| `dlH` | Config directory resolver |
| `Vo1` | Object-entries iterator helper |
| `qK8` | Timestamp / cache-key generator |
| `aP_` | Config atomic-write orchestrator |
| `CK` | URL-open dispatcher (platform switch) |
| `_j7` | URL scheme validator / error thrower |
| `nY` | Platform string reader (`process.platform`) |
| `R8` | Browser-launch orchestrator |
| `C_` | Child-process spawner for browser |
| `YZH` | Spawn options builder |
| `D` | Force-shutdown / process.exit handler |
| `QE4` | Spawn argument stringifier |
| `O$` | Output channel writer |
| `hH` | Error accumulator / logger |
| `u6` | Async-local-storage context reader |
| `pc6` | Store accessor |
| `W_` | Telemetry event dispatcher (`tv`) |