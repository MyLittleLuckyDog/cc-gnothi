---
type: feature-spec
feature: "btw"
cc_version: "2.1.195"
updated: "2026-06-27"
tags: ["btw", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.195 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/btw`

> Analysis basis: CC v2.1.195 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.195

---

## Overview

The `/btw` ("by the way") command lets the user inject a quick side question into a running Claude Code session without derailing the main conversational thread. It is typed as `/btw <question>`, fires immediately (`immediate: true`), and is dispatched as a `control-request` to the thin client, meaning the host process handles it as a lightweight control message rather than a full turn in the primary agentic loop.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `btw` |
| description | Ask a quick side question without interrupting the main conversation |
| argumentHint | `<question>` |
| immediate | `true` |
| thinClientDispatch | `control-request` |
| module_id | `HMl` |
| load_inline | `true` |
| loc_byte | `11408062` |
| loc_byte_end | `11408301` |
| loc_line | `7232` |
| arbor_handler.name | `Cxf` |
| arbor_handler.fqn | `claude-2.1.195::Cxf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.195 bundle.js:+11408062

---

## Input Branching

The command has two primary branches (valid input vs. missing input), making numbered pseudocode appropriate.

1. **User invokes `/btw` with no argument** — the handler detects an empty or missing question string and returns a usage hint string `"Usage: /btw <your question>"` (bundle.js:+11407665).
2. **User invokes `/btw <question>`** — the handler validates the argument, assembles a `system`-role control message (bundle.js:+11407704) containing the question text, and dispatches it through the config-write / lock infrastructure (`gn` → `xZt`) before rendering a JSX confirmation element via `b_.jsx` (bundle.js:+11407773).

```
if userArgument is empty or whitespace:
    return usageHintMessage  // "Usage: /btw <your question>"
else:
    sanitizedQuestion = stripAndNormalize(userArgument)
    controlMessage = buildSystemMessage(sanitizedQuestion)
    acquireConfigLock(configPath)
    dispatchControlRequest(controlMessage)
    return jsxConfirmationElement
```

---

## Behavioral Spec

### 1. Argument Validation and Usage Guard

When the command is invoked, handler `Cxf` (AsyncFunction, `claude-2.1.195::Cxf`) first calls the string-normalization helper (`e` / `t.replace`, bundle.js:+11407663) to strip the raw argument. If the result is empty, it returns the literal usage string `"Usage: /btw <your question>"` (bundle.js:+11407665) and exits immediately without touching the config layer or dispatching any network call.

```
function validateArgument(rawArg):
    cleaned = rawArg.replace(whitespacePattern, "")
    if cleaned is empty:
        return "Usage: /btw <your question>"
    return cleaned
```

Analysis basis: CC v2.1.195 bundle.js:+11407663, +11407665

### 2. System-Role Message Construction

For a valid question, `Cxf` builds a message object with role `"system"` (bundle.js:+11407704). This is the control envelope sent via `thinClientDispatch: "control-request"`, keeping the side question out of the primary conversation message list. The serialization helper `Me` (which calls `JSON.stringify`, bundle.js:+193083) is used downstream when the message is written to disk or forwarded over the IPC channel.

```
function buildControlMessage(question):
    return {
        role: "system",
        content: question
    }
```

Analysis basis: CC v2.1.195 bundle.js:+11407704

### 3. Config Lock Acquisition and Persistence (`gn` → `xZt`)

The `gn` (config-write orchestrator) function is called to persist any session state changes triggered by the command. It delegates to `xZt` (config-with-lock writer), which:

1. Computes the config directory via `bE.dirname` (bundle.js:+14068977).
2. Calls `qt` (path resolver, bundle.js:+14068993) to resolve the lock file path.
3. Creates the directory tree if absent via `s.mkdirSync` (bundle.js:+14068998).
4. Acquires a file-system lock; if contention is detected it emits telemetry event `tengu_config_lock_contention` (bundle.js:+14069271) and logs the warning `"Lock acquisition took longer than expected - another Claude instance may be running"` (bundle.js:+14069182).
5. Reads the existing config with `oTt` (config reader, bundle.js:+14069560), parsing JSON via `Bt` → `JSON.parse` (bundle.js:+193860).
6. If a parse error is encountered during re-read, emits `tengu_config_parse_error` (bundle.js:+14073004) and auto-repairs from the cached config, emitting `tengu_config_auto_repaired` (bundle.js:+14069784) and logging `"saveConfigWithLock: re-read hit a parse error; auto-repairing from cached config under lock. See GH #3117."` (bundle.js:+14069656).
7. If the re-read config is missing auth credentials that the in-memory cache holds, the write is aborted and `tengu_config_auth_loss_prevented` (bundle.js:+14070114) is emitted with log message referencing GH #3117 (bundle.js:+14069962).
8. If the write succeeds, emits `tengu_config_stale_write` on stale-detection paths (bundle.js:+14069407).
9. Releases the lock via `s.finally` → `i.finally` (bundle.js:+17892046), calling `n.close` and `r.close` (bundle.js:+17898885, +17898895).
10. Maintains up to **5** config backups in the `backups/` subdirectory (bundle.js:+14070575); backup filenames include a `.backup.` infix (bundle.js:+14070436). Lock timeout is **60 000 ms** (bundle.js:+14070320). Backup directory permissions are set to octal **600** (`384` decimal, bundle.js:+14070857).

```
async function configWriteWithLock(configPath, updateFn):
    dirPath = dirname(configPath)
    lockPath = resolveLockPath(dirPath)
    mkdirSync(dirPath, recursive=true)

    lock = acquireLock(lockPath, timeoutMs=60000)
    if lock.waitedTooLong:
        emitTelemetry("tengu_config_lock_contention")
        logWarning("Lock acquisition took longer than expected...")

    try:
        existing = readAndParseConfig(configPath)
    catch ParseError:
        emitTelemetry("tengu_config_parse_error")
        existing = cachedConfig
        emitTelemetry("tengu_config_auto_repaired")

    if existing.auth is missing and cachedConfig.auth is present:
        emitTelemetry("tengu_config_auth_loss_prevented")
        return  // abort write

    updated = updateFn(existing)
    writeAtomicWithBackup(configPath, updated, maxBackups=5)
    emitTelemetry("tengu_config_stale_write")  // if stale
    emitTelemetry("tengu_config_fallback_write")  // if fallback path taken
finally:
    releaseLock(lock)
```

Analysis basis: CC v2.1.195 bundle.js:+14065836, +14069271, +14069407, +14069560, +14069656, +14069784, +14070114, +14070320, +14070436, +14070575, +14070857

### 4. Atomic File Write Helper (`aRt`)

The atomic writer `aRt` (bundle.js:+14068708) used by `Mcr` (global-config saver):

1. Resolves the real destination path (following symlinks via `r.readlinkSync`, `jf.resolve`, `Gd` → `e.realpathSync`).
2. Writes content to a temporary file using `Tf.openSync` / `Tf.writeFileSync` (bundle.js:+1103308, +1104239).
3. Sets permissions to match the original file via `Tf.fchmodSync` (bundle.js:+1104301); logs `"Applied original permissions to temp file"` (bundle.js:+1104322).
4. Flushes with `Tf.fsyncSync` (bundle.js:+1104448).
5. Atomically renames the temp file to the destination via `r.renameSync` (bundle.js:+1104779).
6. Falls back to in-place write on `EACCES` (bundle.js:+1104952); logs `"writeFileSyncAndFlush: in-place fallback write failed; content preserved at temp path"` (bundle.js:+1105734) on double failure.
7. Handles symlink loops by catching `ELOOP` / `ENOTDIR` (bundle.js:+1103448, +1103461).
8. Uses 6-byte random suffix for temp file names (bundle.js:+1103807), serialising toString in radix 8 (bundle.js:+1103974).

Analysis basis: CC v2.1.195 bundle.js:+1103056–+1105823

### 5. JSX Confirmation Render

After dispatching, `Cxf` calls `b_.jsx` (bundle.js:+11407773) to return a React element used by the local-jsx renderer to display a brief inline acknowledgement to the user that the side question was submitted.

```
function renderConfirmation(question):
    return jsx(ConfirmationComponent, { question: question })
```

Analysis basis: CC v2.1.195 bundle.js:+11407773

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_config_lock_contention` | Emitted when lock acquisition exceeds expected duration (bundle.js:+14069271) |
| Telemetry: `tengu_config_stale_write` | Emitted when a stale-config condition is detected during write (bundle.js:+14069407) |
| Telemetry: `tengu_config_parse_error` | Emitted when the on-disk config fails JSON parsing during re-read (bundle.js:+14073004) |
| Telemetry: `tengu_config_auto_repaired` | Emitted when the config is auto-repaired from in-memory cache (bundle.js:+14069784) |
| Telemetry: `tengu_config_auth_loss_prevented` | Emitted when write is aborted to protect auth credentials (bundle.js:+14070114) |
| Telemetry: `tengu_daemon_control` | Emitted by daemon control path reachable via `u` / `SF` (bundle.js:+17924594) |
| Telemetry: `tengu_config_fallback_write` | Emitted when the fallback global-config write path is taken in `Mcr` (bundle.js:+14068887) |
| Config file lock | Exclusive file-system lock acquired on config dir; timeout 60 000 ms (bundle.js:+14070320) |
| Config backups | Up to 5 timestamped backups written to `backups/` with `.backup.` infix (bundle.js:+14070436, +14070575) |
| Backup dir permissions | `0600` (384 decimal) applied to backup directory (bundle.js:+14070857) |
| thinClientDispatch | Sends a `control-request` message; does not insert a turn into the primary conversation history |
| appState changes | Side question is dispatched out-of-band; primary conversation state is not modified |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.195 | Initial analysis |

---

## Common Mistakes

1. **Omitting the argument** — invoking `/btw` with no text returns the usage hint `"Usage: /btw <your question>"` and does nothing else. Always supply the question as the argument.
2. **Expecting a full conversation turn** — `/btw` is dispatched as a `control-request`, not as a primary agent turn. The model's response to the side question may arrive via a different channel than normal assistant messages.
3. **Assuming instant delivery under lock contention** — if another Claude instance holds the config lock, delivery can be delayed up to 60 000 ms. The `tengu_config_lock_contention` telemetry event will fire in that scenario.
4. **Confusing `/btw` with `/ask`** — `/btw` is specifically designed to be non-interrupting. Using it for questions that require the agent to pause its current task is not the intended use case.
5. **Expecting config persistence after auth-loss guard** — if the on-disk config is found to be missing auth data that the in-memory cache holds, the write is silently aborted (GH #3117 guard). The question is still dispatched, but config state may not be persisted.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Cxf` | Main handler AsyncFunction for `/btw` (arbor_handler; `claude-2.1.195::Cxf`) |
| `e` | String-normalization / replace helper called by `Cxf` |
| `gn` | Config-write orchestrator; entry point for session-state persistence |
| `xZt` | Config-with-lock writer; manages lock acquire/release and atomic write |
| `qt` | Path resolver utility (used for config and lock paths) |
| `s` | File-system facade (mkdirSync, statSync, readdirStringSync, copyFileSync, unlinkSync) |
| `r` | Secondary file-system / set handle (r.add, r.delete, r.close, r.readFileSync, etc.) |
| `i` | Promise/finally chain holder for lock cleanup |
| `Osi` | Object-assign wrapper for config merging |
| `I3r` | Inner helper called by `Osi`; delegates to `Psi` |
| `T` | API / prompt-building utility (includes, toUpperCase, trim paths) |
| `RYc` | Sub-utility called by `T`; uses `w1`, `eAr`, `Drs` |
| `Me` | JSON serialisation wrapper (`JSON.stringify`) |
| `Lc` | String-redaction / truncation helper (`[REDACTED]` insertion) |
| `jXe` | Prompt-assembly helper; calls `ais` |
| `PYc` | File-content preparation helper (Buffer.byteLength, size limits 1000/100) |
| `W` | Config state accessor / writer (global config object) |
| `on` | Logger / event emitter utility |
| `oTt` | Config file reader and parser (readFileSync + JSON.parse + backup logic) |
| `Bt` | JSON parse wrapper |
| `v5` | String prefix-strip utility (startsWith / slice) |
| `Ojo` | Directory-scanner helper (readdirStringSync, basename, join, dirname) |
| `Ujo` | Path-join + `tr` (path component sanitizer) |
| `m` | Array-filter wrapper with `thr` and `Array.isArray` |
| `sTt` | Config snapshot / state-capture helper |
| `n` | toLowerCase normalizer (40-char truncation constant at bundle.js:+17915470) |
| `y` | Split / message-processing helper |
| `dVe` | TeammateMailbox `markMessagesAsRead` async function |
| `I` | Slice/pagination helper (Math.max, Math.floor) |
| `M` | HTTP request handler / OAuth route dispatcher |
| `A` | Userinfo fetch helper |
| `aRt` | Atomic file write function (temp-write + rename + fsync) |
| `Gd` | Symlink-resolution helper (`realpathSync`) |
| `u` | Daemon control helper (daemon_stop / daemon_stop_failed) |
| `Cn` | Logging wrapper around `on` |
| `ZZe` | fsync-error classifier (EINVAL, ENOTSUP, EPERM, ENOSYS) |
| `lAs` | Object.defineProperty wrapper for property descriptor installation |
| `sUe` | Session/state utility called by `gn` |
| `Djo` | Object.entries iterator helper |
| `wZt` | Timestamp helper (`Date.now`) |
| `vZt` | Config-read wrapper calling `oTt` and `S0` |
| `Mcr` | Global-config saver (calls `aRt`, emits `tengu_config_fallback_write`) |
| `Oe` | UI component renderer entry; calls `OJe` |
| `OJe` | Root JSX component mounted by `Oe` |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.