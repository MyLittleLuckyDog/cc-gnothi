---
type: feature-spec
feature: "install-slack-app"
cc_version: "2.1.169"
updated: "2026-06-11"
tags: ["install-slack-app", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.169 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/install-slack-app`

> Analysis basis: CC v2.1.169 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.169

---

## Overview

`/install-slack-app` is a local slash command that opens the Claude Slack app installation page in the user's default browser. It fires a telemetry event, emits a status message to the terminal, and then delegates to a platform-aware URL-opener utility. The command requires an interactive session (`supportsNonInteractive: false`) and performs no persistent state mutations of its own.

---

## Registration

| Field | Value |
|---|---|
| type | `local` |
| name | `install-slack-app` |
| description | `Install the Claude Slack app` |
| supportsNonInteractive | `false` |
| module_id | `toq` |
| load_inline | `true` |
| loc_byte | `11790791` |
| loc_byte_end | `11790977` |
| loc_line | `8217` |
| arbor_handler.name | `OIf` |
| arbor_handler.fqn | `claude-2.1.169::OIf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.169 bundle.js:+11790791

---

## Input Branching

The command has a simple linear flow (no user-supplied arguments are consumed; branching is limited to the platform detection inside the URL-opener). Numbered pseudocode is appropriate here.

1. User invokes `/install-slack-app` in an interactive Claude Code session.
2. Handler `OIf` fires immediately — no argument parsing.
3. A telemetry event is emitted.
4. A status string is printed to the terminal output stream.
5. The URL-opener utility (`aK`) is called with the Slack app installation URL.
6. Inside `aK`, the URL scheme is validated (must start with `http:` or `https:`); otherwise an error is raised via `L$7`.
7. Platform detection chooses the system open command: `rundll32 url,OpenURL` on `win32`, `open` on `darwin`, `xdg-open` on Linux.
8. The chosen command is spawned via `b8` → `U_` → `gVH`.
9. Control returns; the handler resolves.

---

## Behavioral Spec

### Main Handler — `OIf`

```
async function installSlackAppHandler(context):
    emit telemetry event "tengu_install_slack_app_clicked"
    // Analysis basis: CC v2.1.169 bundle.js:+11790397

    print to output stream:
        kind  = "text"
        value = "Opening Slack app installation page in browser…"
    // Analysis basis: CC v2.1.169 bundle.js:+11790530, +11790543

    await openURL(<slack-installation-url>)
    // delegates to aK; see §URL Opener below
```

Analysis basis: CC v2.1.169 bundle.js:+11790395 – +11790977

---

### URL Opener — `aK`

```
async function openURL(url):
    if NOT (url.startsWith("http:") OR url.startsWith("https:")):
        throw urlSchemeError via errorConstructor()
        // Analysis basis: CC v2.1.169 bundle.js:+6210802, +6210852, +6210874

    call platformBrowserOpen(url) via b8
    // Analysis basis: CC v2.1.169 bundle.js:+6211089 – +6211102

async function platformBrowserOpen(url):
    platform = process.platform

    if platform == "win32":
        spawn("rundll32", ["url,OpenURL", url])
        // Analysis basis: CC v2.1.169 bundle.js:+6211177, +6211261, +6211273
    else if platform == "darwin":
        spawn("open", [url])
        // Analysis basis: CC v2.1.169 bundle.js:+6211161, +6211335
    else:   // Linux / other POSIX
        spawn("xdg-open", [url])
        // Analysis basis: CC v2.1.169 bundle.js:+6211342

    // spawn is performed by processSpawner (b8 → U_ → gVH)
    // Analysis basis: CC v2.1.169 bundle.js:+6211210
```

Analysis basis: CC v2.1.169 bundle.js:+6211089

---

### Process Spawner — `b8` / `U_` / `gVH`

```
async function spawnProcess(command, args):
    build SpawnOptions (inherits env, detached, stdio)
    // gVH assembles full options set including:
    //   oUA, mA_, pA_, BA_, qUA (option builders)
    //   HUA.bind / _UA.bind (stream binders)
    //   xpA, RUA, vO6 (lifecycle hooks)

    invoke U_ with assembled options
    // U_ enforces 1 000 000 µs (1 second) max spawn latency check
    // Analysis basis: CC v2.1.169 bundle.js:+1098977

    on spawn error:
        log via hH (error reporter) → bo.logError
        // Analysis basis: CC v2.1.169 bundle.js:+1099419

    on success:
        resolve with child process handle
```

Analysis basis: CC v2.1.169 bundle.js:+1098510

---

### Config Lock (reachable via `X8` save path — not on hot path for this command)

The call graph shows `OIf` also calls `X8` (globalConfig writer), which internally uses `UL8` (locked file writer). These are invoked only if the command needs to persist state; no persistent config mutation is documented for this command at depth-2, but the machinery is reachable.

```
function saveWithLock(path, data):
    acquire file lock
    if lock takes unexpectedly long:
        emit telemetry "tengu_config_lock_contention"
        warn: "Lock acquisition took longer than expected…"
        // Analysis basis: CC v2.1.169 bundle.js:+3272182, +3272225

    read back config before writing
    if re-read is missing auth that cache holds:
        emit "tengu_config_auth_loss_prevented" / "tengu_config_stale_write"
        abort write (GH #3117 guard)
        // Analysis basis: CC v2.1.169 bundle.js:+3272641, +3272793

    write atomically via WO6 (safe-write utility):
        open temp file with mode 0o600 (decimal 384)
        write content
        fchmod to original permissions
        fsync
        rename temp → target
        // Analysis basis: CC v2.1.169 bundle.js:+3273526, +1061556, +1061614, +1061680
```

Analysis basis: CC v2.1.169 bundle.js:+3269128

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry (primary) | `tengu_install_slack_app_clicked` — fired on every invocation (bundle.js:+11790397) |
| Telemetry (config subsystem) | `tengu_config_lock_contention`, `tengu_config_stale_write`, `tengu_config_parse_error`, `tengu_config_auth_loss_prevented` — emitted by lock/write helpers if triggered |
| Telemetry (background daemon) | `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail`, `tengu_bg_proto_mismatch`, `tengu_bg_dispatch_stale_drop`, `tengu_bg_attach_legacy_autorespawn`, `tengu_bg_attach`, `tengu_bg_attach_stall_gave_up`, `tengu_bg_attach_stall_respawn`, `tengu_bg_attach_kick` — emitted by daemon/process-management infrastructure reachable via the process spawner |
| Terminal output | Prints `"Opening Slack app installation page in browser…"` (kind: `"text"`) before spawning (bundle.js:+11790543) |
| Browser side-effect | Opens the Slack app installation URL in the default OS browser via platform-specific command |
| appState changes | None documented at depth-2 traversal |
| File system | Atomic config writes via `WO6` if config save path is exercised; max 5 backup files retained (bundle.js:+3273244); backup dir named `"backups"` (bundle.js:+3273826) |
| Hook registration | None identified for this command directly |
| Sound | None identified |
| Non-interactive | Command refuses to run in non-interactive mode (`supportsNonInteractive: false`) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.169 | Initial analysis |

---

## Common Mistakes

1. **Running in non-interactive / headless environments** — `supportsNonInteractive` is `false`; invoking this command in a CI pipeline or `--no-interactive` session will result in the command being rejected before the handler fires.
2. **Expecting browser auto-confirmation** — the command only *launches* the installation page; completing the Slack OAuth flow is a separate, manual browser step.
3. **Firewall / sandbox blocking `xdg-open` / `open` / `rundll32`** — on restricted Linux environments without a desktop environment, `xdg-open` may silently fail; the command itself will still report success once the spawn resolves.
4. **Confusing URL-scheme errors** — the URL opener (`aK`) validates that the target URL begins with `http:` or `https:`. Any redirect to a custom scheme will throw before the browser is invoked (bundle.js:+6210852, +6210874).
5. **Assuming config is written** — the config-lock infrastructure appears in the call graph but is not proven to be exercised on the hot path for this command at depth-2; do not expect a config file change after running `/install-slack-app`.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `OIf` | Main async handler for `/install-slack-app` (Arbor-resolved entry point) |
| `d` | Debug/logging utility (called at telemetry emit sites) |
| `X8` | Global config writer / save helper |
| `UL8` | Locked atomic file writer |
| `_` | File-system primitive wrapper (lstat / readdirStringSync etc.) |
| `l6` | Path resolution / normalization helper |
| `L` | Filesystem module reference (mkdirSync, statSync, etc.) |
| `q` | Secondary filesystem or IPC module |
| `f` | Stream or resource handle |
| `hT1` | Config serialization helper |
| `Tz_` | Config transform / merge utility |
| `N` | HTTP request builder / fetch utility |
| `ItK` | HTTP response parser |
| `H` | Bootstrap fetch / config loader |
| `CH` | JSON serializer wrapper |
| `R4` | HTTP header / auth-token formatter |
| `rBH` | String encoding helper |
| `StK` | File write with byte-length check |
| `E8` | Error code / errno helper |
| `y7H` | Config read utility (reads, parses, and optionally backs up config file) |
| `F6` | JSON parse wrapper |
| `Vu` | String prefix stripper |
| `ke1` | Config backup directory scanner |
| `yG_` | Backup path joiner |
| `w` | Background daemon session manager |
| `ViH` | Config validation / schema checker |
| `A` | String case normalizer (toLowerCase) |
| `V` | String prefix filter |
| `P` | IPC stream framer / chunked buffer reader |
| `X` | Timeout-aware message reader |
| `J` | Process kill manager |
| `Df` | IPC frame encoder |
| `Lj5` | Daemon message dispatcher / multiplexer |
| `EH` | Error-to-string converter |
| `E` | Array slice / bounds helper |
| `G` | SDK connection manager |
| `WO6` | Atomic safe-write utility (temp → rename) |
| `O` | Stream / socket handle |
| `k8` | Errno classifier |
| `OJH` | Config path resolver |
| `Ie1` | Object-entries iterator |
| `MP6` | Timestamp utility (Date.now wrapper) |
| `pL8` | Config save fallback path handler |
| `aK` | URL opener — validates scheme, selects platform command |
| `L$7` | URL scheme error constructor |
| `HD` | Open-URL dispatch helper |
| `b8` | Process spawner facade |
| `U_` | Async process spawn core |
| `gVH` | Spawn options builder / child-process wrapper |
| `D` | Forced-shutdown / process-exit utility |
| `Ik4` | Spawn argument stringifier |
| `J3` | Spawn result handler |
| `hH` | Error reporter / logger (bo.logError) |
| `C6` | Async-local-storage context accessor |
| `Wi6` | Store getter (Pi6.getStore) |
| `G_` | Context initializer (xZ) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.