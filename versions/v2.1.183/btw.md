---
type: feature-spec
feature: "btw"
cc_version: "2.1.183"
updated: "2026-06-19"
tags: ["btw", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.183 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/btw`

> Analysis basis: CC v2.1.183 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.183

---

## Overview

`/btw` ("by the way") allows the user to ask a quick side question without disrupting the primary conversation flow. The command is dispatched immediately as a control request via the thin-client dispatch layer, injecting a system-role message that carries the user's question into the agent context. It is implemented as a `local-jsx` command, meaning its result is rendered as a JSX element rather than plain text.

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
| module_id | `nol` |
| load_inline | `true` |
| loc_byte | `11193242` |
| loc_byte_end | `11193481` |
| loc_line | `6919` |
| arbor_handler.name | `$6p` |
| arbor_handler.fqn | `claude-2.1.183::$6p` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.183 bundle.js:+11193242

---

## Input Branching

The command has a clear linear guard followed by an immediate dispatch; there are two distinguishable branches: **missing argument** and **argument present**.

```
1. User invokes /btw [question]
2. IF question is absent or empty:
      → display usage hint: "Usage: /btw <your question>"
         (bundle.js:+11192835)
      → return early (no dispatch)
3. ELSE:
      → build system-role message containing the question text
         (bundle.js:+11192874)
      → dispatch via thinClientDispatch = "control-request"
      → render result as JSX element via createElement
         (bundle.js:+11192943)
      → return rendered component
```

Because there are only two branches, numbered pseudocode is the appropriate representation here.

---

## Behavioral Spec

### Handler Entry — `asyncBtwHandler` (`$6p`)

The Arbor-resolved handler is the async function `$6p`, reached via `module_id → "nol"` resolution.

Analysis basis: CC v2.1.183 bundle.js:+11192833

```
async function asyncBtwHandler(commandInput, context):

    # 1. Argument validation
    question = commandInput.args.trim()
    IF question is empty:
        emit usage message "Usage: /btw <your question>"
        return earlyExitJsxElement(usageMessage)

    # 2. Build the injected message
    message = {
        role: "system",           # literal "system" at bundle.js:+11192874
        content: question
    }

    # 3. Dispatch as a side-channel control request
    #    thinClientDispatch = "control-request" (registration field)
    result = await dispatchControlRequest(message, context)

    # 4. Render and return JSX
    return createElement(BtwResponseComponent, { result })
```

Analysis basis: CC v2.1.183 bundle.js:+11192874, +11192943

---

### Jitter Helper — `jitterDelay` (`e`)

Called from the handler at `bundle.js:+11192833`. Introduces a randomised back-off before retrying or settling.

```
function jitterDelay(baseMs, spreadFactor):
    # Uses Math.random (bundle.js:+14290351)
    # Literal values: factor 2 (bundle.js:+14290349),
    #                 delta  1 (bundle.js:+14290365)
    offset = Math.floor(Math.random() * spreadFactor)
    await setTimeout(baseMs + offset)
```

Analysis basis: CC v2.1.183 bundle.js:+14290351, +14290388

---

### Config Persistence — `saveConfigWithLock` (`pn`) and `writeConfigFile` (`W7n`)

The handler chain calls `pn` (config-save coordinator) which in turn calls `W7n` (locked file writer). This subsystem is responsible for persisting any state changes resulting from the side-question dispatch.

```
async function saveConfigWithLock(configData):
    acquire fileLock()            # W7n → s.mkdirSync, vS.dirname
    timestamp = Date.now()        # bundle.js:+13966517

    TRY:
        IF reReadConfig is missing auth that cache holds:
            emit telemetry: tengu_config_auth_loss_prevented
            # Warning literal at bundle.js:+13967072
            return WITHOUT writing

        writeConfigFile(configData, timestamp)

    CATCH lockContention:
        emit telemetry: tengu_config_lock_contention
        # bundle.js:+13966745
        log "Lock acquisition took longer than expected..."
        # literal at bundle.js:+13966656

    FINALLY:
        release fileLock()
```

Analysis basis: CC v2.1.183 bundle.js:+13963318, +13966517, +13966745

---

### Config File Writer — `writeConfigFile` (`W7n`)

```
function writeConfigFile(configData, timestamp):
    targetDir = vS.dirname(configPath)
    s.mkdirSync(targetDir, { recursive: true })

    # Back-up rotation (keeps last 5 backups)
    # literal ".backup." at bundle.js:+13967542
    # literal 5         at bundle.js:+13967675
    backupDir = vS.join(targetDir, "backups")   # literal at bundle.js:+13968257
    rotateBackups(configPath, backupDir, maxCount=5)

    # Atomic write via temp-rename (MSt)
    atomicWriteSync(configPath, JSON.stringify(configData))

    IF statSync shows mtime changed unexpectedly:
        emit telemetry: tengu_config_stale_write   # bundle.js:+13966881
```

Analysis basis: CC v2.1.183 bundle.js:+13966451, +13966472, +13966517, +13966881

---

### Config Read — `readConfigFile` (`q_e`)

```
function readConfigFile(configPath):
    IF config accessed before initialisation allowed:
        throw Error("Config accessed before allowed.")
        # literal at bundle.js:+13968689

    raw = r.readFileSync(configPath, "utf-8")   # literal at bundle.js:+13968772

    TRY:
        parsed = JSON.parse(raw)                 # via Gt → bundle.js:+192069
    CATCH parseError:
        emit telemetry: tengu_config_parse_error # bundle.js:+13969320
        RETURN default config

    IF prefix check fails (V9):                  # bundle.js:+1185565
        strip prefix and re-validate

    RETURN parsed
```

Analysis basis: CC v2.1.183 bundle.js:+13968683, +13968772, +13969320

---

### Atomic File Write — `atomicWriteSync` (`MSt`)

```
function atomicWriteSync(targetPath, content):
    tmpPath = targetPath + "." + lmr.randomBytes(8).toString("hex")
    # literal "hex" at bundle.js:+1096982, count 8 at bundle.js:+1097137

    fd = Qf.openSync(tmpPath, flags)
    Qf.writeFileSync(fd, content)
    Qf.fchmodSync(fd, 0o600)           # mode 384 decimal, bundle.js:+13967957
    Qf.fsyncSync(fd)
    Qf.closeSync(fd)

    RESOLVE symlinks if target is a symlink (r.readlinkSync, pm.isAbsolute)
    r.renameSync(tmpPath, resolvedTarget)

    IF rename fails with EACCES:
        # fallback: in-place write
        # warning literal at bundle.js:+1098768
        writeInPlace(targetPath, content)
```

Analysis basis: CC v2.1.183 bundle.js:+1096954, +1096982, +1097395, +1097813

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_config_lock_contention` (bundle.js:+13966745) — lock wait exceeded threshold |
| Telemetry | `tengu_config_stale_write` (bundle.js:+13966881) — config mtime changed unexpectedly |
| Telemetry | `tengu_config_parse_error` (bundle.js:+13969320) — malformed config JSON |
| Telemetry | `tengu_config_auth_loss_prevented` (bundle.js:+13967224) — blocked write that would wipe auth |
| Telemetry | `tengu_config_fallback_write` (bundle.js:+13966361) — fallback write path taken |
| Telemetry | `tengu_bg_dispatch_sigkill_escalate` (bundle.js:+17275023) — background dispatch SIGKILL escalation |
| Telemetry | `tengu_bg_dispatch_low_mem` (bundle.js:+17275624) — low memory detected during dispatch |
| Telemetry | `tengu_bg_spare_enable` / `_claim` / `_claim_fail` (bundle.js:+17276321, +17276449, +17276715) — background spare-session lifecycle |
| Telemetry | `tengu_bg_proto_mismatch` (bundle.js:+17260790) — protocol version mismatch |
| Telemetry | `tengu_bg_dispatch_stale_drop` (bundle.js:+17262189) — stale dispatch dropped |
| Telemetry | `tengu_bg_attach` family (bundle.js:+17266238, +17267168, +17267438, +17268435) — background attach lifecycle |
| Telemetry | `tengu_bg_attach_legacy_autorespawn` (bundle.js:+17265079) — legacy client auto-respawn |
| Telemetry | `tengu_daemon_control` (bundle.js:+17311864) — daemon control events |
| thinClientDispatch | Sends a `"control-request"` message to the daemon layer |
| message role | Injected message uses role `"system"` (bundle.js:+11192874) |
| Config lock | Acquires and releases a filesystem-level directory lock around config writes |
| Config backups | Rotating backup files written to `backups/` subdirectory (max 5 copies) |
| Atomic writes | Temp-file + rename strategy with `fsync`; fallback in-place write on `EACCES` |
| JSX render | Returns a React element via `ru.createElement` (bundle.js:+11192943) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.183 | Initial analysis |

---

## Common Mistakes

1. **Omitting the argument**: Invoking `/btw` with no text after it triggers the usage hint (`"Usage: /btw <your question>"`) and does nothing else. Always supply `<question>`.
2. **Expecting a conversational reply in-thread**: `/btw` injects a `system`-role message rather than a `user`-role turn. The question is dispatched as a control request and the response surface may differ from a normal chat reply.
3. **Confusing `immediate: true` with synchronous execution**: The handler (`$6p`) is an `AsyncFunction`. `immediate` means the command is dispatched without waiting for a prior agent turn to complete, but the handler itself still runs asynchronously.
4. **Assuming config writes always succeed silently**: The write path includes lock contention detection and auth-loss guards that can silently abort a write; the only signal is a telemetry event, not a user-visible error.
5. **Using `/btw` as a replacement for `/ask` or a normal message**: The command is intended for lightweight side queries; using it for complex multi-step questions may produce incomplete responses because the system-role injection path has different context availability than a normal user turn.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `$6p` | Main async handler for `/btw` (arbor-resolved entry point) |
| `e` | Jitter-delay helper (Math.random + setTimeout) |
| `pn` | Config-save coordinator (`saveConfigWithLock`) |
| `W7n` | Locked config file writer (`writeConfigFile`) |
| `t` | Internal file-system accessor (context-dependent) |
| `jt` | Path existence / stat utility |
| `s` | Secondary file-system handle (mkdirSync, statSync, etc.) |
| `r` | Primary file-system handle (readFileSync, renameSync, etc.) |
| `i` | Stream / lock-handle object |
| `C3s` | Config metadata assembler (Object.assign wrapper) |
| `_wr` | Inner config record builder |
| `T` | Logging / message-formatting utility |
| `QHc` | Output formatter / renderer |
| `Pe` | JSON stringify wrapper |
| `Kc` | String sanitiser / redactor |
| `Hqe` | Schema validator helper |
| `n_c` | File content chunker / buffer-length checker |
| `j` | General async task scheduler |
| `dn` | Error normaliser / logger |
| `q_e` | Config file reader (`readConfigFile`) |
| `Gt` | JSON parse wrapper |
| `V9` | Prefix-strip / version-prefix checker |
| `RFl` | Backup file locator (readdirStringSync + basename) |
| `Sko` | Path join + transform utility |
| `f` | Background daemon session manager |
| `AAt` | Auth token cache accessor |
| `n` | String case normaliser (toLowerCase) |
| `I` | Scroll / viewport math helper (Math.max, Math.floor) |
| `k` | Terminal supervisor writer |
| `E` | Viewport clamp helper (Math.max, Math.min) |
| `g` | IPC buffer splitter (Buffer.concat + indexOf) |
| `h` | Socket timeout handler |
| `m` | Session kill coordinator |
| `Qp` | Stream end / flush helper |
| `T6f` | Main IPC message dispatcher / PTY protocol handler |
| `Ee` | String coercion wrapper |
| `MSt` | Atomic sync file writer (`atomicWriteSync`) |
| `jp` | Symlink real-path resolver |
| `u` | Daemon lifecycle controller |
| `Mn` | Error-with-code constructor |
| `vKe` | Unsupported-operation error guard |
| `LMe` | Config schema version migrator |
| `_ko` | Config entries iterator (Object.entries) |
| `oWt` | Timestamp recorder (Date.now) |
| `j7n` | Per-project config writer |
| `Ue` | Startup / init utility |
| `ogt` | Application bootstrap entry |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.