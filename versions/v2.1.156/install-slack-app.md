---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.156"
updated: "2026-06-02"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.156 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.156 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.156

---

## Overview

`/install-slack-app` is a local utility command that triggers the installation flow for the Claude Slack integration. When invoked, it fires a telemetry event, then opens the Slack app installation page in the user's default system browser. The command is intentionally simple: it performs no agent-level reasoning and produces no text output beyond a short status message.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `sS1` |
| load_inline | `true` |
| loc_byte | `11387439` |
| loc_byte_end | `11387625` |
| loc_line | `8478` |
| arbor_handler.name | `NeL` |
| arbor_handler.fqn | `claude-2.1.156::NeL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.156 bundle.js:+11387439

---

## Input Branching

This command has a simple linear flow with no user-input branching; the single meaningful decision is the platform-specific URL-open strategy delegated to `wK` (browser-open helper). Pseudocode is used.

1. User invokes `/install-slack-app` in an interactive session.
2. Handler `NeL` fires immediately — no argument parsing occurs.
3. Telemetry event `tengu_install_slack_app_clicked` is emitted.
4. A status message `"Opening Slack app installation page in browser…"` of type `text` is returned/displayed.
5. `wK` (browser opener) is called; inside it, `xD` validates the URL scheme (`http:` / `https:` guard), then `V8` selects the OS-appropriate open mechanism.
6. Control returns; no further state changes.

---

## Behavioral Spec

### Top-level handler — `NeL`

```
async function installSlackAppHandler(context):
    emit telemetry("tengu_install_slack_app_clicked")   // bundle.js:+11387045
    saveGlobalConfig(context)                           // via configPersist (O8)
    openBrowser(SLACK_INSTALL_URL)                      // via browserOpen (wK)
    return { type: "text",
             content: "Opening Slack app installation page in browser…" }
                                                        // bundle.js:+11387178, +11387191
```

Analysis basis: CC v2.1.156 bundle.js:+11387043–11387158

---

### Config persistence — `O8` (global config save)

`NeL` calls `O8` first (Analysis basis: CC v2.1.156 bundle.js:+11387083), which internally:

```
function saveGlobalConfig(context):
    acquireFileLock(configPath)            // hz_ — uses mkdirSync, statSync
    if lockContentionDetected:
        emit telemetry("tengu_config_lock_contention")
        log warning("Lock acquisition took longer than expected …")
                                           // bundle.js:+3208125
    currentDisk = readConfigFile(utf-8)    // bzH — readFileSync, JSON.parse
    if diskConfig.auth is missing AND cachedConfig.auth is present:
        emit telemetry("tengu_config_auth_loss_prevented")
        log("saveGlobalConfig fallback: re-read config is missing auth …")
                                           // bundle.js:+3205357
        abort write
    if staleWriteCondition:
        emit telemetry("tengu_config_stale_write")
    atomicWrite(newConfig)                 // $L6 — write → fchmod → fsync → rename
    releaseLock()
```

Analysis basis: CC v2.1.156 bundle.js:+3205150 (`hz_`), +3205331 (`bzH`), +3205357, +3208125, +3208541

Notable constants within this path:

- Lock-contention warning string: `"Lock acquisition took longer than expected - another Claude instance may be running"` (bundle.js:+3208125)
- Auth-loss guard message references GH issue #3117 (bundle.js:+3208541, +3205357)
- Config file read encoding: `"utf-8"` (bundle.js:+3210241)
- Config guarded by: `"Config accessed before allowed."` error (bundle.js:+3210158)
- Backup directory name: `"backups"` (bundle.js:+3209726); backup filename filter prefix: `".backup."` (bundle.js:+3209011)
- Maximum backup copies retained: `5` (bundle.js:+3209144)
- Atomic write file permissions (octal): `0o600` = `384` (bundle.js:+3209426)
- Config rewrite timeout: `60000` ms (bundle.js:+3208895)

---

### Browser open — `wK` (URL opener)

```
async function openUrlInBrowser(url):
    validateUrlScheme(url)                 // Yn7: reject if not "http:" or "https:"
                                           // bundle.js:+6590653, +6590675
    xD(url)                                // secondary URL normalisation / logging
    platform = detectPlatform()            // V8 checks process.platform
    if platform == "darwin":
        spawn("open", [url])               // bundle.js:+6591136
    else if platform == "win32":
        spawn("rundll32", ["url,OpenURL", url])
                                           // bundle.js:+6591062, +6591074
    else:                                  // Linux / other POSIX
        spawn("xdg-open", [url])           // bundle.js:+6591143
```

Analysis basis: CC v2.1.156 bundle.js:+11387158 (call site), +6590890 (`Yn7`), +6590903 (`xD`), +6591011 (`V8`)

---

### Background session / daemon subsystem — `D`, `w` (reached transitively via `W_`)

The call chain `V8 → W_ → ZGH` pulls in the daemon background-session dispatcher. This subsystem is not unique to `/install-slack-app`; it is shared infrastructure. Relevant constants observed during traversal:

- SIGKILL escalation delay — 30 s / 15 s thresholds (bundle.js:+15478820, +15478831)
- Spare session label: `"spare"` (bundle.js:+15479635)
- Low-memory threshold denominator: `1024` (bundle.js:+15479338)
- Version string embedded in daemon: `"2.1.156"` (bundle.js:+15479963)
- Build commit: `"de3d672b5e8c35ae78d81c9dd83844d334ec63af"` (bundle.js:+15480083)
- Build timestamp: `"2026-05-28T18:30:33Z"` (bundle.js:+15480052)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_install_slack_app_clicked` (bundle.js:+11387045) — fired once per invocation of `/install-slack-app` |
| Telemetry — config lock | `tengu_config_lock_contention` (bundle.js:+3208214) — fired if lock acquisition is slow |
| Telemetry — stale write | `tengu_config_stale_write` (bundle.js:+3208350) — fired when on-disk config diverges from cache in a way that would cause a stale overwrite |
| Telemetry — config parse error | `tengu_config_parse_error` (bundle.js:+3210789) — fired if config file cannot be parsed |
| Telemetry — auth loss prevented | `tengu_config_auth_loss_prevented` (bundle.js:+3208693) — fired when write is aborted to protect auth credentials |
| Telemetry — bg dispatcher | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_spare_spawn` — shared daemon infra, not specific to this command |
| Non-interactive support | `false` — command must be run in an interactive session |
| File system side effects | Global config may be written/re-written atomically; backup files created under `"backups"` subdirectory with `.backup.` prefix |
| Browser side effect | Opens default system browser with the Slack app installation URL |
| Output message | `"Opening Slack app installation page in browser…"` returned as a `text`-type message (bundle.js:+11387178, +11387191) |
| appState changes | None observed in depth-2 traversal beyond config persistence |
| Sound | None observed |
| Hook registration | None observed |

---

## Version History

| Version | Change |
|---|---|
| v2.1.156 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive mode** — `supportsNonInteractive` is `false`; invoking `/install-slack-app` in a scripted or headless context will fail or produce no useful result.
2. **Expecting agent output** — This command produces only the fixed status string `"Opening Slack app installation page in browser…"`. It does not invoke the model or return anything further.
3. **Network-less environments** — The command opens a browser URL; in environments without a desktop or browser (e.g., SSH sessions without X-forwarding on Linux), `xdg-open` may fail silently or error.
4. **Assuming URL customisation** — The Slack installation URL is compiled into the bundle. There is no argument accepted by this command; any text typed after `/install-slack-app` is ignored.
5. **Config lock contention** — If another Claude Code instance holds the global-config lock, the config-save step may block, emitting `tengu_config_lock_contention`. This is transient and resolves when the other instance releases the lock.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `NeL` | Main async handler for `/install-slack-app` (AsyncFunction, fqn `claude-2.1.156::NeL`) |
| `d` | Generic debug/logging utility |
| `O8` | Global config save entry point |
| `hz_` | Config file lock-and-write core (mkdirSync, statSync, copyFileSync, unlinkSync) |
| `_` | Filesystem abstraction (readdirStringSync, statSync) |
| `B6` | Path resolution / existence check helper |
| `L` | Filesystem wrapper with temp-file tracking (statSync, mkdirSync, copyFileSync, readdirStringSync, unlinkSync) |
| `q` | Another filesystem namespace (readFileSync, mkdirSync, readdirStringSync, copyFileSync, statSync, unlinkSync, renameSync) |
| `f` | File handle / stream with `finally`-cleanup (close, toLowerCase) |
| `o$q` | Config object merge/assign helper |
| `k1_` | Config read sub-routine |
| `N` | HTTP request builder (includes debug-level logging, UUID generation) |
| `URK` | HTTP fetch sub-step (mI, pRK, $$A) |
| `H` | Retry-with-jitter helper (Math.random, setTimeout) |
| `RH` | JSON serialisation helper (JSON.stringify) |
| `v4` | URL path manipulation (replace, at, lastIndexOf, slice) |
| `HuH` | Request header builder (yzA) |
| `gRK` | HTTP response handler (kxH, cMH, Buffer.byteLength, FRK, _9) |
| `J8` | Error construction / wrapping utility |
| `bzH` | Config file read + backup management (readFileSync, mkdirSync, copyFileSync) |
| `m6` | JSON parse wrapper |
| `kb` | String prefix stripping helper (startsWith, slice) |
| `UBq` | Backup directory scanner (readdirStringSync, fD.basename, fD.join) |
| `Sz_` | Backup path builder (fD.join, l8) |
| `w` | Background process / daemon worker (spawn, SIGKILL, freemem, hH, setTimeout) |
| `uz6` | Config update merge helper |
| `A` | String normalisation utility (toLowerCase) |
| `V` | Version / filename string with `.startsWith` usage |
| `P` | MCP server/connection manager (Vb8, mh, ou, GAH, ld, hH, F_) |
| `Vb8` | MCP connection factory |
| `hH` | Tool / hook loader (F_, xH, q1, D84, QmH, Li.logError) |
| `F_` | Error factory (Error, String) |
| `E` | Array/buffer slice source |
| `$L6` | Atomic file writer (randomBytes, writeFileSync, fchmodSync, fsyncSync, renameSync, unlinkSync) |
| `O` | Symbolic-link stat result wrapper (isSymbolicLink, k8) |
| `P8` | Error code extractor (J8, errno) |
| `jQH` | Config field accessor |
| `pBq` | Config entry enumerator (Object.entries) |
| `JQH` | Timestamp recorder (Date.now) |
| `yz_` | Local config writer ($L6, RH, K0, B6) |
| `wK` | Browser URL opener (Yn7, xD, V8) |
| `Yn7` | URL scheme validator (rejects non-http/https; throws Error) |
| `xD` | URL normalisation / secondary open step |
| `V8` | Platform-specific browser spawn (W_, C6; checks darwin/win32/linux) |
| `W_` | Browser spawn executor (ZGH, D, gA4, Wz, N, J8, hH) |
| `ZGH` | OS open-command builder (WNA, li8, ni8, ri8, kvA, zL6, ci8, ANA, NvA, IvA, VvA, vvA, qvA, HNA, jL6, tvA, evA, RvA) |
| `D` | Background session dispatcher (E6, eI8, k5A.freemem, n6, P5A, Wz, N, J8, hH) |
| `gA4` | String coercion utility (String) |
| `Wz` | Warning/log emitter |
| `C6` | Async-local-storage context accessor (YB6, $_) |
| `YB6` | Store getter (zB6.getStore, kn) |
| `$_` | Context resolver (ov) |