---
type: feature-spec
feature: "btw"
cc_version: "2.1.197"
updated: "2026-07-01"
tags: ["btw", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.197 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/btw`

> Analysis basis: CC v2.1.197 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.197

---

## Overview

The `/btw` ("by the way") command allows users to pose a quick side question to the agent without disrupting or context-switching the primary ongoing conversation thread. It is registered as a `local-jsx` type with `immediate: true`, meaning it dispatches synchronously as a control-request to the thin client and renders a JSX result inline. The handler (`NPf`) validates the argument, injects it as a `system`-role side message, and renders a JSX element back to the UI.

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
| module_id | `Z1l` |
| load_inline | `true` |
| loc_byte | `11503125` |
| loc_byte_end | `11503364` |
| loc_line | `7334` |
| arbor_handler.name | `NPf` |
| arbor_handler.fqn | `claude-2.1.197::NPf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.197 bundle.js:+11503125

---

## Input Branching

Two distinct branches exist: the user omits the argument (empty/missing input), or provides a non-empty question string. A simple numbered pseudocode representation is appropriate here.

1. User invokes `/btw` with no argument (or whitespace only) → display usage hint: `"Usage: /btw <your question>"` and return without dispatching to the agent. (Analysis basis: CC v2.1.197 bundle.js:+11502728)
2. User invokes `/btw <question>` with a non-empty argument → sanitize input via string-replace utility, construct a `system`-role side message, and render a JSX element with the result. (Analysis basis: CC v2.1.197 bundle.js:+11502767, +11502836)

---

## Behavioral Spec

### Handler Entry — Side Question Dispatch

```
async function handleBtwCommand(commandInput):
    rawText = commandInput.args  // the text after "/btw"

    // Step 1: Validate argument presence
    sanitized = sanitizeInput(rawText)   // calls string-replace utility (e)
    if sanitized is empty or whitespace:
        return renderUsageError("Usage: /btw <your question>")

    // Step 2: Build side message
    sideMessage = {
        role: "system",
        content: sanitized
    }

    // Step 3: Persist context if needed (config/lock subsystem via Hn)
    configContext = acquireConfigContext()

    // Step 4: Render JSX result element
    return renderJSX(sideMessage, configContext)
```

Analysis basis: CC v2.1.197 bundle.js:+11502726, +11502767, +11502790, +11502836

---

### Input Sanitization

The raw argument string is passed through a string-replace utility (`e`) before use. This function applies a pattern-based substitution (via `t.replace`) to normalize or strip disallowed characters.

```
function sanitizeInput(rawString):
    return rawString.replace(SANITIZE_PATTERN, REPLACEMENT)
```

Analysis basis: CC v2.1.197 bundle.js:+11502726, +17659671

---

### Config Context Acquisition (`Hn` / config subsystem)

The command touches the configuration subsystem (`Hn`) to establish context before rendering. This subsystem handles:

- Acquiring a file-system lock for config access (with lock-contention detection)
- Reading config state from disk via `readFileSync` with UTF-8 encoding
- Creating backup copies (up to 5 kept; backup directory named `"backups"`) if needed
- Detecting and auto-repairing JSON parse errors from a cached config under lock (see GH #3117)
- Refusing writes if auth data would be lost from the cached config (safety guard, see GH #3117)
- Emitting telemetry on anomalies

```
function acquireConfigContext():
    lockHandle = acquireFileLock(configPath)
    if lockAcquisitionExceededThreshold:
        emitTelemetry("tengu_config_lock_contention")
        log("error", "Lock acquisition took longer than expected...")

    try:
        rawJson = fs.readFileSync(configPath, "utf-8")
        parsed = JSON.parse(rawJson)
    except ParseError:
        emitTelemetry("tengu_config_parse_error")
        // Auto-repair from in-memory cache
        emitTelemetry("tengu_config_auto_repaired")
        parsed = cachedConfig

    if cachedConfig.hasAuth and not parsed.hasAuth:
        emitTelemetry("tengu_config_auth_loss_prevented")
        raise Error("Refusing to write — auth would be lost. See GH #3117.")

    return parsed
```

Analysis basis: CC v2.1.197 bundle.js:+14157745, +14161091, +14161180, +14161565, +14161693, +14161871, +14163499, +14163582

---

### Config Write / Lock-Safe Save (`rtn` / `vdr`)

When writing back config state, the subsystem uses atomic write semantics:

- Checks existence of config directory; creates with `mkdirSync` if absent
- Writes to a temporary file, applies original permissions, flushes with `fsyncSync`
- Renames temp file to final destination atomically
- Manages up to 5 numbered backup copies, pruning oldest when limit exceeded
- Emits `tengu_config_stale_write` if a concurrent write is detected
- Emits `tengu_config_fallback_write` on fallback path (e.g. `save_global`)

```
function saveConfigSafely(config, path):
    tmpPath = path + ".backup." + Date.now()
    fs.writeFileSync(tmpPath, JSON.stringify(config))
    fs.fchmodSync(tmpPath, originalPermissions)
    fs.fsyncSync(tmpPath)
    fs.renameSync(tmpPath, path)
    pruneBackupsIfNeeded(backupDir, maxBackups=5)
```

Analysis basis: CC v2.1.197 bundle.js:+14160880, +14160952, +14161316, +14162229, +14162345, +14162484, +14160796

Maximum backup count: **5** (bundle.js:+14162484)  
Lock timeout threshold: **60000 ms** (bundle.js:+14162229)  
File permission constant for temp file: **384** (octal 0o600) (bundle.js:+14162766)

---

### JSX Rendering

After the side message is constructed, the handler calls `b_.jsx` to produce a React/JSX element returned to the CLI rendering layer.

```
function renderSideQuestionResult(message, context):
    return jsx(SideQuestionComponent, {
        message: message,
        context: context
    })
```

Analysis basis: CC v2.1.197 bundle.js:+11502836

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_config_lock_contention` | Fired when config lock acquisition exceeds expected duration (bundle.js:+14161180) |
| Telemetry — `tengu_config_stale_write` | Fired when a concurrent/stale config write is detected (bundle.js:+14161316) |
| Telemetry — `tengu_config_parse_error` | Fired when the on-disk config JSON cannot be parsed (bundle.js:+14164913) |
| Telemetry — `tengu_config_auto_repaired` | Fired when config is auto-repaired from the in-memory cache (bundle.js:+14161693) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a write is blocked to prevent auth data loss (bundle.js:+14162023) |
| Telemetry — `tengu_daemon_control` | Fired in daemon control path (reachable via config subsystem) (bundle.js:+18076516) |
| Telemetry — `tengu_config_fallback_write` | Fired when the global-config fallback write path is used (bundle.js:+14160796) |
| thinClientDispatch | `control-request` — dispatched immediately to the thin client layer |
| immediate | `true` — command executes without waiting for the main conversation turn |
| Config file I/O | Reads and conditionally writes `~/.claude.json`; creates backup copies in a `backups/` subdirectory |
| File locking | Acquires an exclusive filesystem lock during config read/write; lock has a 60 000 ms contention threshold |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | Side question is injected as a `system`-role message; does not replace or clear main conversation state |

---

## Version History

| Version | Change |
|---|---|
| v2.1.197 | Initial analysis |

---

## Common Mistakes

1. **Omitting the argument**: Invoking `/btw` with no text produces a usage error (`"Usage: /btw <your question>"`) and does not send anything to the agent. Always supply a non-empty question string.
2. **Expecting a conversation reset**: `/btw` is designed to be non-interrupting. It does not clear or branch the main conversation context — it inserts a lightweight `system`-role message alongside the existing thread.
3. **Confusing `immediate` with synchronous blocking**: The `immediate: true` flag means the command dispatches as a `control-request` without waiting for a prior agent turn to complete, not that the response will appear instantly.
4. **Assuming no I/O occurs**: Even for a simple side question, the handler touches the config subsystem, which may acquire a filesystem lock and read/write `~/.claude.json`. If another Claude instance holds the lock, there can be a visible delay (up to 60 000 ms before a contention telemetry event fires).
5. **Expecting rich formatting in the result**: As a `local-jsx` command with `thinClientDispatch: control-request`, the rendered output is a JSX element processed by the thin client — markdown or tool-call formatting from the main conversation is not applied to the `/btw` result frame.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `NPf` | Main async handler for the `/btw` command (arbor_handler) |
| `e` | Input sanitization / string-replace utility |
| `Hn` | Config context acquisition orchestrator |
| `rtn` | Atomic config save with lock and backup management |
| `qt` | Config path resolver |
| `nci` | Config object constructor / initializer |
| `b4r` | Config base record builder |
| `T` | Message/context builder (constructs agent-facing message objects) |
| `deu` | Debug/environment utility (produces `"debug"` level output) |
| `Me` | JSON serializer wrapper |
| `Pc` | Path/content normalization utility |
| `KQe` | Config key query helper |
| `geu` | File upload / byte-length utility |
| `V` | Validation helper |
| `rn` | Error normalization / re-throw helper |
| `lIt` | Config file reader with backup and parse logic |
| `Gt` | JSON parse wrapper |
| `q5` | String prefix stripper |
| `mqo` | Directory reader for config/backup scanning |
| `hqo` | Path join helper for backup directories |
| `m` | Array/record filter utility |
| `cIt` | Config integrity checker |
| `n` | String lowercase normalizer |
| `y` | Split/segment utility |
| `lqe` | Teammate mailbox message-marking utility |
| `I` | Scroll/pagination math helper (Math.max / Math.floor) |
| `M` | HTTP request router / OAuth handler |
| `A` | Auth userinfo resolver |
| `mRt` | Atomic file write helper (temp-file + rename pattern) |
| `Gd` | Symlink resolution / realpath utility |
| `u` | Daemon lifecycle handler (daemon_stop events) |
| `Sn` | Error sentinel helper |
| `rtt` | Filesystem error code classifier (EINVAL, EPERM, etc.) |
| `oRr` | Platform/OS detection utility |
| `nIs` | Object property definition helper |
| `zUe` | Config state extractor |
| `pqo` | Object.entries-based config enumerator |
| `ttn` | Timestamp recorder (Date.now) |
| `etn` | Config read+lock entry helper |
| `vdr` | Global config save fallback handler |
| `Oe` | UI/output rendering helper |
| `$Xe` | Root rendering/display primitive |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.