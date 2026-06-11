---
type: feature-spec
feature: "passes"
cc_version: "2.1.172"
updated: "2026-06-11"
tags: ["passes", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.172 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/passes`

> Analysis basis: CC v2.1.172 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.172

---

## Overview

The `/passes` command surfaces a UI that allows users to share a free week of Claude Code with friends via guest passes. It is a `local-jsx` command, meaning it renders a JSX component inline rather than dispatching a text prompt to the agent. Execution records a telemetry visit event and constructs the UI from configuration data resolved through the background-session infrastructure.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `passes` |
| description | `Share a free week of Claude Code with friends` |
| module_id | `a7K` |
| load_inline | `true` |
| isHidden | `null` (not hidden) |
| loc_byte | `12672487` |
| loc_byte_end | `12672809` |
| loc_line | `8901` |
| arbor_handler.name | `ld7` |
| arbor_handler.fqn | `claude-2.1.172::ld7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `2` |

Analysis basis: CC v2.1.172 bundle.js:+12672487

---

## Input Branching

The command has a linear invocation flow (no user-supplied argument branches); the only branching occurs internally when resolving session/config state. Two primary sub-flows exist: (1) recording the visit and (2) rendering the JSX panel. A simple numbered list is sufficient.

1. User invokes `/passes` — no arguments are required or consumed.
2. Handler `ld7` fires immediately and emits the `tengu_guest_passes_visited` telemetry event.
3. `ld7` calls `resolvePassesContext` (`Fp8`) to obtain current authentication and subscription context.
4. `ld7` calls `buildSessionContext` (`E8`) to resolve background-session state (config, file-system paths, daemon handles).
5. `ld7` calls a JSX element factory (`F$A.createElement`) to construct and return the passes UI panel, passing resolved context as props.
6. The rendered component is handed back to the CLI shell for display; no further agent invocation occurs.

---

## Behavioral Spec

### Handler entry — `ld7` (AsyncFunction)

```
async function handlePassesCommand(context):
    emit telemetry("tengu_guest_passes_visited")        // bundle.js:+12672310
    passesCtx  = await resolvePassesContext(context)    // Fp8, bundle.js:+12672204
    sessionCtx = await buildSessionContext(context)     // E8,  bundle.js:+12672210
    configData = readCurrentConfig()                    // c,   bundle.js:+12672308
    element    = createJsxElement(PassesPanel, {        // F$A.createElement, bundle.js:+12672359
                     passesCtx,
                     sessionCtx,
                     configData
                 })
    return element
```

Analysis basis: CC v2.1.172 bundle.js:+12672170

---

### Passes context resolution — `resolvePassesContext` (`Fp8`)

Calls into the authentication/session layer (`e4`, `Uw`) to determine whether the current user has a valid OAuth or API-key credential, then forwards that together with the project-root context (`b6`) to the JSX panel.

```
async function resolvePassesContext(ctx):
    authProfile = await resolveAuthProfile(ctx)   // e4 → Uw → vj
    projectRoot = getProjectRoot(ctx)             // b6
    return { authProfile, projectRoot }
```

Analysis basis: CC v2.1.172 bundle.js:+12672204, +12282212, +3268382

---

### Session context construction — `buildSessionContext` (`E8`)

Coordinates config reading, file-system checks, and background-daemon handles needed to populate the passes panel (e.g. subscription tier, remaining passes).

```
function buildSessionContext(ctx):
    configSnapshot = readConfig(ctx)          // W7H — reads ~/.claude.json (utf-8)
    fileSystemInfo = gatherFsInfo(ctx)        // F78 — mkdir, stat, readdir, copy
    backupPaths    = resolveBackupPaths(ctx)  // S_9, XZ_ — "backups" subdirectory
    return { configSnapshot, fileSystemInfo, backupPaths }
```

Key internal operations performed by `buildSessionContext` (`E8`):

| Operation | Detail |
|---|---|
| Config access guard | Throws `"Config accessed before allowed."` if config not yet ready (bundle.js:+3314076) |
| Config read encoding | UTF-8 (bundle.js:+3314159) |
| ENOENT handling | Absent config file is caught; treated as empty state (bundle.js:+3314306) |
| Backup directory name | `"backups"` subdirectory under config root (bundle.js:+3313644) |
| File permission bits | `384` (octal 0o600) applied to written files (bundle.js:+3313344) |
| Max retained backup count | `5` backups (bundle.js:+3313062) |
| Config-lock contention | Emits `tengu_config_lock_contention` and logs a warning (bundle.js:+3312132) |

Analysis basis: CC v2.1.172 bundle.js:+3308889, +3309070, +3311917, +3314132

---

### Authentication profile resolution — `resolveAuthProfile` (`e4` → `Uw`)

```
async function resolveAuthProfile(ctx):
    profile = buildAuthContext(ctx)           // Uw — assembles credentials
    if profile has ANTHROPIC_API_KEY:
        return { kind: "apiKey", ... }
    elif profile has user_oauth:
        return { kind: "user_oauth", ... }   // bundle.js:+3246000
    elif profile is firstParty:
        return { kind: "firstParty", ... }   // bundle.js:+2109620
    else:
        throw Error("ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, ...")
        // full message at bundle.js:+3249695
```

Analysis basis: CC v2.1.172 bundle.js:+3268382, +3246976, +3247074

---

### Config reader — `readConfig` (`W7H`)

```
function readConfig(path):
    if not configAccessAllowed:
        throw new Error("Config accessed before allowed.")   // bundle.js:+3314076
    raw  = fs.readFileSync(path, "utf-8")                   // bundle.js:+3314132, +3314159
    data = JSON.parse(raw)                                   // via n6, bundle.js:+189746
    if data.code === "ENOENT":
        return defaultConfig()                               // bundle.js:+3314306
    if data.code === "EEXIST":
        handleConflict()                                     // bundle.js:+3314921
    return data
```

Analysis basis: CC v2.1.172 bundle.js:+3314070, +3314132

---

### Telemetry visit event

Immediately upon entry the handler emits `tengu_guest_passes_visited` (bundle.js:+12672310). This is the only telemetry event fired from within `ld7` itself; all other telemetry events listed below originate from shared infrastructure called transitively.

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — visit | `tengu_guest_passes_visited` — fired once per `/passes` invocation (bundle.js:+12672310) |
| Telemetry — config lock | `tengu_config_lock_contention` — fired when config write-lock is contested (bundle.js:+3312132) |
| Telemetry — config stale write | `tengu_config_stale_write` — fired when a stale config write is detected (bundle.js:+3312268) |
| Telemetry — config auth loss | `tengu_config_auth_loss_prevented` — fired when a write would have wiped auth credentials (bundle.js:+3312611) |
| Telemetry — config parse error | `tengu_config_parse_error` — fired on JSON parse failure in config reader (bundle.js:+3314707) |
| Telemetry — bg spare enable | `tengu_bg_spare_enable` — fired by background daemon infrastructure on spare-session enable (bundle.js:+16761230) |
| Telemetry — bg spare claim | `tengu_bg_spare_claim` — fired when a spare session is successfully claimed (bundle.js:+16761358) |
| Telemetry — bg spare claim fail | `tengu_bg_spare_claim_fail` — fired when spare-session claim fails (bundle.js:+16761624) |
| Telemetry — bg attach | `tengu_bg_attach` — fired on background-session attach (bundle.js:+16751796) |
| Telemetry — bg attach kick | `tengu_bg_attach_kick` — fired when an existing attach is evicted (bundle.js:+16753939) |
| Telemetry — bg low mem dispatch | `tengu_bg_dispatch_low_mem` — fired when daemon dispatch is skipped due to low memory (bundle.js:+16760526) |
| Telemetry — bg low mem MB | `tengu_bg_low_mem_mb` (macOS) — records free-memory megabytes at dispatch (bundle.js:+13266653) |
| Telemetry — bg SIGKILL escalation | `tengu_bg_dispatch_sigkill_escalate` — fired when SIGTERM escalates to SIGKILL (bundle.js:+16759925) |
| Telemetry — feature ok/bad | `tengu_feature_ok` / `tengu_feature_bad` — fired by feature-flag checks within the call graph (bundle.js:+1016269, +1016336) |
| Telemetry — scheduled task missed | `tengu_scheduled_task_missed` — fired if a background scheduled task is overdue (bundle.js:+16260241) |
| Telemetry — bg send-claim failed | `tengu_bg_sendclaim_failed` — fired when the daemon fails to send a claim (bundle.js:+16738818) |
| Telemetry — bg proto mismatch | `tengu_bg_proto_mismatch` — fired on daemon protocol version mismatch (bundle.js:+16746616) |
| Telemetry — bg dispatch stale drop | `tengu_bg_dispatch_stale_drop` — stale message dropped by dispatcher (bundle.js:+16747984) |
| Telemetry — bg attach legacy respawn | `tengu_bg_attach_legacy_autorespawn` — legacy attach triggers auto-respawn (bundle.js:+16750638) |
| Telemetry — bg attach stall gave up | `tengu_bg_attach_stall_gave_up` — attach stalled and was abandoned (bundle.js:+16752719) |
| Telemetry — bg attach stall respawn | `tengu_bg_attach_stall_respawn` — stalled attach triggers respawn (bundle.js:+16752989) |
| File system | Config read from `~/.claude.json`; backup files written to `backups/` subdirectory with permissions `0o600` (384) |
| appState changes | None directly; the command returns a JSX element for the CLI shell to render |
| Hook registration | `hZA.register` called via `y9` inside file-watcher setup (`Gx4`) during session context build (bundle.js:+63751) |
| Background daemon | May spawn (`Hd.spawn`) or claim a spare session (`B0A`) during session context resolution |
| Sound | None detected in depth-2 traversal |

---

## Version History

| Version | Change |
|---|---|
| v2.1.172 | Initial analysis |

---

## Common Mistakes

1. **Invoking with arguments** — `/passes` accepts no arguments; any text after the command name is ignored by the `local-jsx` handler, which does not parse `argv`.
2. **Expecting agent output** — Because the command type is `local-jsx`, it renders a UI panel rather than sending a prompt to the Claude agent. No conversational response is produced.
3. **Config not yet initialized** — If `/passes` is invoked before the global config file is available, the internal config reader will throw `"Config accessed before allowed."` and the panel will fail to render. This is not a user-facing error message; the CLI will surface it as an internal exception.
4. **Offline / unauthenticated context** — The command still requires valid credentials (API key or OAuth token) to resolve the passes context; running without any auth environment variable causes an `Error` to be thrown deep in the auth-profile resolver.
5. **Assuming pass availability** — The command UI shows the current pass state (remaining passes, eligibility). It does not itself grant passes; availability is determined server-side.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `ld7` | Main handler (`AsyncFunction`) for `/passes` — entry point resolved by Arbor via `module_id` |
| `b6` | Project-root / session-base resolver |
| `o6` | General-purpose logging/output helper |
| `jZ_` | Session state accessor |
| `W7H` | Config file reader (reads `~/.claude.json` with UTF-8 encoding, handles ENOENT/EEXIST) |
| `q` | Node `fs` module wrapper (readFileSync, statSync, mkdirSync, etc.) |
| `$1` | CLI-error exit helper (`process.exit` on `cli_error`) |
| `n6` | JSON.parse wrapper |
| `bu` | String-prefix utility (startsWith / slice) |
| `H` | Random/timer helper (Math.random, setTimeout) |
| `_` | File-system utility (readdirStringSync, statSync, toUpperCase, etc.) |
| `N8` | Notification/signal emitter |
| `S_9` | Backup-path scanner (reads `backups/` directory, filters entries) |
| `XZ_` | Path joiner (WD.join + config-root resolver) |
| `M` | MCP server registry / map manager (get, values, filter) |
| `$` | TwK-backed feature-flag / config map |
| `N` | API-request builder (constructs HTTP request objects, handles auth headers) |
| `g8f` | HTTP sub-request helper (`th`, `Cs8`, `kZA`) |
| `CH` | JSON.stringify wrapper |
| `lf` | Log-line formatter (replaces secrets with `[REDACTED]`) |
| `rFH` | Error-recovery helper (`ovA`) |
| `l8f` | File-upload / byte-length helper (`Buffer.byteLength`, `Us8`) |
| `c` | Config-state accessor / cache |
| `D` | Background-daemon session manager (spawn, claim, kill, attach, retire) |
| `A` | Lowercase-keyed process/session map |
| `b` | Background-session worker (MSH, wW9, P.has/add/X.set) |
| `d8` | Abort-controller / timeout helper (clearTimeout, process abort) |
| `bH` | Feature-flag "bad" reporter |
| `kH` | Feature-flag "ok" reporter |
| `hF8` | Low-memory detector (macOS `freemem`) |
| `l06` | Roster/session-list file reader (GW.readFile, Array.isArray, filter) |
| `SH` | Session-state publisher (JA, Rq, fRf, iQH.push, Ya.logError) |
| `Q` | Background PTY process lifecycle manager (on/once/destroy/connect/unlink) |
| `Y6` | Spare-session enablement controller (rjH, V26, zF) |
| `B0A` | Spare-session claim handler (Hd.claim, socketAuth, Vn8.connect) |
| `l0A` | Session execution / teardown orchestrator (Vw.rm, bx6, rosterEntry, H.delete) |
| `f` | Promise tracking helper (q.add, q.delete, L.finally) |
| `Y` | Forced-shutdown handler (HX, process.exit, z.abort) |
| `A6` | Dispose / cleanup utility (`_56`) |
| `B` | Process-kill helper |
| `Gx4` | File-watcher setup (m78.watchFile/unwatchFile, Lq, wF) |
| `wF` | Watch-event filter/handler |
| `y9` | Hook registration caller (`hZA.register`) |
| `Fp8` | Passes context resolver — delegates to auth-profile builder (`e4`, `b6`) |
| `e4` | Auth + project-root context assembler |
| `Uw` | Auth-profile builder (O7, vj, B4, gA, NP, $O) |
| `O7` | OAuth token reader (`f6`, `EQ6`; supports `--bare` flag) |
| `vj` | Auth profile selector (T_8, ErH, CB, tv, RB, W9, dC, mNH, i89, r89) |
| `B4` | First-party credential builder (`c_`, `"firstParty"`) |
| `NP` | Environment-variable credential builder |
| `$O` | Full auth-resolution pipeline (O26, DFH, PD6, apiKeyHelper, lC, ZrH) |
| `w26` | Error-reporting wrapper for auth (`ErH`) |
| `ErH` | Auth error formatter (`f6`, `J8H`) |
| `E8` | Session context builder (config, FS info, daemon handles) |
| `F78` | File-system orchestrator (mkdir, stat, readdir, copy, unlink, backup rotation) |
| `mV1` | Config-object merger (`dY_`, `Object.assign`) |
| `dY_` | Deep-merge helper (`uV1`) |
| `brH` | Config-write safety guard (auth-loss prevention) |
| `V` | File-entry filter (startsWith `.backup.`) |
| `P` | IPC framing layer (Buffer.concat, indexOf, subarray, I7, x05, EH) |
| `X` | Socket multiplexer (M, q.setTimeout) |
| `j` | Session kill coordinator (A.values, S.kill) |
| `I7` | IPC frame encoder (H.end, CH/JSON.stringify) |
| `x05` | Daemon IPC message dispatcher (ping, nudge, attach, reply, resize, snapshot, etc.) |
| `EH` | String coercion helper |
| `E` | Windowed-buffer manager (Math.max, Math.min, W) |
| `W` | SDK connection wrapper (V76, aS, UN, Promise.all, Yi, nb, SH, JA) |
| `Sz6` | Atomic file writer (readlink, randomBytes, writeFileSync, fchmodSync, fsyncSync, renameSync) |
| `O` | Background-session descriptor (`m8`, `"background session"`) |
| `R8` | Error-code normalizer (`N8`) |
| `L` | Socket/stream lifecycle manager (A.close, q.close) |
| `HJH` | Session-header parser |
| `y_9` | Object.entries iterator for config map |
| `b26` | Timestamp helper (Date.now) |
| `B78` | Config directory initializer (b26, nG, o6, WD.dirname, YX, CH, Sz6, N) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.