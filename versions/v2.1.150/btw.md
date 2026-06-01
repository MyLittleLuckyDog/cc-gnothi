---
type: feature-spec
feature: "btw"
cc_version: "2.1.150"
updated: "2026-06-01"
tags: ["btw", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.150 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/btw`

> Analysis basis: CC v2.1.150 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.150

---

## Overview

`/btw` ("by the way") allows the user to pose a quick side question to the agent without disrupting the current main conversation thread. It dispatches the query immediately as a `control-request` through the thin-client layer, injecting the question as a `system`-role message so the agent can answer inline without derailing ongoing work. The command is local-JSX typed, meaning it renders its output directly via a React element returned from the handler.

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
| module_id | `K21` |
| load_inline | `true` |
| loc_byte | `10624025` |
| loc_byte_end | `10624264` |
| loc_line | `8350` |
| arbor_handler.name | `nxL` |
| arbor_handler.fqn | `claude-2.1.150::nxL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.150 bundle.js:+10624025

---

## Input Branching

The handler has two principal branches based on whether the user supplied a non-empty argument:

1. **No argument supplied** — the command prints a usage hint and returns early.
2. **Argument supplied** — the question is packaged as a `system`-role message and dispatched immediately.

This is a two-branch linear flow; pseudocode is used below.

```
function handleBtw(userInput):
    question = userInput.trim()

    if question is empty:
        return renderUsageHint("Usage: /btw <your question>")
    // Analysis basis: CC v2.1.150 bundle.js:+10623622

    messagePayload = buildSystemMessage(question)
    // role = "system"  (bundle.js:+10623661)

    dispatchControlRequest(messagePayload)
    return renderJSXResponse()
```

Analysis basis: CC v2.1.150 bundle.js:+10623620

---

## Behavioral Spec

### 1. Entry Point — `btwHandler` (`nxL`)

`nxL` is an `AsyncFunction` resolved by Arbor via the `module_id` path (`K21`).

```
async function btwHandler(context):
    rawArg = context.args
    if rawArg is blank:
        return jsxUsageHint()        // emits "Usage: /btw <your question>"

    systemMsg = buildSystemMessage(rawArg)
    // buildSystemMessage wraps the argument under role="system"

    result = await dispatchAsControlRequest(systemMsg)
    return createElement(resultView, result)
```

Analysis basis: CC v2.1.150 bundle.js:+10623620–10623730

---

### 2. Randomised Jitter Utility — `jitterHelper` (`H`)

`btwHandler` calls an internal utility (`H`) that combines `Math.random` with `setTimeout`. Its purpose is to introduce a small randomised delay (between 1 and 2 arbitrary units) before proceeding, likely to avoid thundering-herd collisions on the control channel.

```
function jitterHelper(baseDelayMs):
    factor = Math.random() * (2 - 1) + 1
    // literals: 2 @ +13290153, 1 @ +13290169
    wait(baseDelayMs * factor)   // via setTimeout @ +13290192
```

Analysis basis: CC v2.1.150 bundle.js:+10623620 (call edge `nxL → H`)

---

### 3. Config Persistence Layer — `saveConfigWithLock` (`f8` → `$f_`)

The handler invokes a config-save path (`f8`) which delegates to an atomic file-write helper (`$f_`). This path persists any session-state changes triggered by the side question (e.g., recording conversation metadata).

```
async function saveConfigWithLock(configData):
    acquireLock()                        // via mkdirSync lock dir
    try:
        currentConfig = readConfigFromDisk()    // readFileSync, utf-8

        if currentConfig is missing auth that in-memory cache has:
            emitTelemetry("tengu_config_auth_loss_prevented")
            // bundle.js:+3194189
            abort("saveConfigWithLock: re-read config is missing auth ...")
            // literal @ +3194037

        writeAtomically(configData, currentConfig)
        // uses copyFileSync, renameSync, unlinkSync for atomic replace
        // max backup rotation: 5 files @ +3194640
        // file mode: 0o600 (384 decimal) @ +3194922
        // backup files prefixed ".backup." @ +3194507

    finally:
        releaseLock()

function acquireLock():
    deadline = Date.now() + 60000      // 60 s timeout @ +3194391
    loop until lock dir created (mkdirSync) or deadline exceeded:
        if timeout:
            emitTelemetry("tengu_config_lock_contention")
            // bundle.js:+3193710
            logWarning("Lock acquisition took longer than expected ...")
            // literal @ +3193621
            break
```

Analysis basis: CC v2.1.150 bundle.js:+10623684 (call edge `nxL → f8`)

---

### 4. Config Read Helper — `readConfigFile` (`JOH`)

```
function readConfigFile(configPath):
    if configPath not accessible:
        if error.code == "ENOENT":
            return defaultConfig()
        throw error

    raw = fs.readFileSync(configPath, "utf-8")   // literal @ +3195737
    parsed = JSON.parse(raw)                      // via g6 @ +183438

    if parsed is missing ("Config accessed before allowed"):
        // guard literal @ +3195654
        throw Error("Config accessed before allowed.")

    return parsed
```

Analysis basis: CC v2.1.150 bundle.js:+3190893 (call edge `f8 → JOH`)

---

### 5. Message Formatter — `buildMessageContext` (`N`)

```
function buildMessageContext(role, content):
    // role.toUpperCase() @ +202806
    // content serialised via JSON.stringify (CH) @ +182698
    // debug logging @ +202680 (literal "debug")
    formatted = {
        role: role.toUpperCase(),
        content: sanitize(content)    // via X4 @ +194726
    }
    return formatted
```

Analysis basis: CC v2.1.150 bundle.js:+10623684 (transitive: `f8 → N`)

---

### 6. JSX Response Rendering

`btwHandler` calls `Y4.createElement` (React's `createElement`) to build the output view returned to the terminal UI.

```
function renderResponse(data):
    return createElement(ResponseComponent, { data })
```

Analysis basis: CC v2.1.150 bundle.js:+10623730 (call edge `nxL → Y4.createElement`)

---

### 7. Background Process / Daemon Dispatch (`w`)

The `control-request` dispatch path reaches a background-session manager (`w`) that handles daemon process lifecycle. Key behaviours observed within depth-2 traversal:

```
function bgDispatch(request):
    session = activeSessionMap.get(sessionId)

    if session process needs eviction (memory low):
        emitTelemetry("tengu_bg_dispatch_low_mem")   // @ +15261450
        kill(session.process, "SIGKILL")             // literal @ +15260919
        // SIGKILL escalation after 30 s / 15 s thresholds
        //   30 @ +15260826, 15 @ +15260837
        emitTelemetry("tengu_bg_dispatch_sigkill_escalate")  // @ +15260871

    if spare session available:
        emitTelemetry("tengu_bg_spare_claim")        // @ +15262266
        reassignSpare()
    else:
        try spawnNew()
        on failure:
            emitTelemetry("tengu_bg_spare_claim_fail")   // @ +15262529

    recordTimestamp(Date.now())   // @ +15262297
    return dispatchedSession
```

Analysis basis: CC v2.1.150 bundle.js:+15260753 (call edges from `w`)

---

### 8. Atomic File-Write Utility — `atomicWriteFile` (`UK6`)

Used by the config layer to safely persist data:

```
function atomicWriteFile(targetPath, data):
    tmpPath = targetPath + "." + randomBytes(6).toString("hex")
    // 6 bytes @ +1009393, "hex" @ +1009405

    fd = fs.openSync(tmpPath, flags)
    try:
        fs.writeFileSync(fd, data)
        fs.fchmodSync(fd, originalMode)   // preserves permissions
        // log "Applied original permissions to temp file" @ +1009892
        fs.fsyncSync(fd)
    finally:
        fs.closeSync(fd)

    fs.renameSync(tmpPath, targetPath)
    // on ELOOP / ENOTDIR errors: @ +1009034 / +1009047 → throw
```

Analysis basis: CC v2.1.150 bundle.js:+3194880 (call edge `$f_ → UK6`)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_config_lock_contention` | Emitted when config lock acquisition exceeds timeout (bundle.js:+3193710) |
| Telemetry: `tengu_config_stale_write` | Emitted when a stale write is detected during config save (bundle.js:+3193846) |
| Telemetry: `tengu_config_parse_error` | Emitted when config JSON cannot be parsed (bundle.js:+3196285) |
| Telemetry: `tengu_config_auth_loss_prevented` | Emitted when a write would have wiped auth credentials (bundle.js:+3194189) |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Emitted when a background session is force-killed (bundle.js:+15260871) |
| Telemetry: `tengu_bg_dispatch_low_mem` | Emitted when low system memory triggers session eviction (bundle.js:+15261450) |
| Telemetry: `tengu_bg_spare_enable` | Emitted when a spare background session is pre-warmed (bundle.js:+15262145) |
| Telemetry: `tengu_bg_spare_claim` | Emitted when a spare session is successfully claimed (bundle.js:+15262266) |
| Telemetry: `tengu_bg_spare_claim_fail` | Emitted when spare session claim fails (bundle.js:+15262529) |
| thinClientDispatch | Sends the side question as a `control-request` to the thin-client layer |
| Message role | Question injected with role `"system"` (bundle.js:+10623661) |
| Config on-disk | `saveConfigWithLock` may write updated session state; atomic rename preserves integrity |
| Config backup rotation | Maximum 5 backup files retained (bundle.js:+3194640), prefixed `.backup.` |
| Config file permissions | Mode `0o600` (384 decimal) enforced on write (bundle.js:+3194922) |
| Config lock timeout | 60 000 ms (bundle.js:+3194391) |
| React rendering | Returns a JSX element via `Y4.createElement` (bundle.js:+10623730) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.150 | Initial analysis |

---

## Common Mistakes

1. **Omitting the argument** — if no `<question>` is provided, the command immediately returns a usage hint (`"Usage: /btw <your question>"`) and performs no dispatch. Always include the question text.
2. **Expecting conversation-context awareness** — `/btw` injects a `system`-role message, not a `user`-role turn; the agent treats it as out-of-band context rather than a normal dialogue turn.
3. **Assuming synchronous completion** — the handler is an `AsyncFunction` and the dispatch path involves a jitter delay. Do not chain immediate dependent commands assuming instant completion.
4. **Conflating `/btw` with a multi-turn thread** — the command is a single side query, not a sub-conversation. There is no mechanism in the registration to maintain a separate back-and-forth context.
5. **Ignoring config-layer side effects** — each invocation may trigger a `saveConfigWithLock` cycle; in environments where multiple Claude instances run concurrently, lock contention (`tengu_config_lock_contention`) is possible.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `nxL` | Main `btwHandler` entry point (AsyncFunction, resolved via module_id K21) |
| `H` | Jitter/delay helper using `Math.random` + `setTimeout` |
| `f8` | Config save orchestrator (`saveConfigWithLock` top-level) |
| `$f_` | Atomic config write implementation (lock, backup rotation, rename) |
| `_` | Low-level filesystem abstraction (readdirStringSync, statSync) |
| `Q6` | Path/file utility (used across config and file operations) |
| `L` | Filesystem module wrapper (mkdirSync, statSync, unlinkSync, etc.) |
| `q` | Secondary filesystem module (readFileSync, statSync, mkdirSync, etc.) |
| `M` | Stream/resource with close/finally lifecycle; also config module reference |
| `_L9` | Config object initialisation helper (calls `A__`, `Object.assign`) |
| `A__` | Config defaults builder (calls `HL9`) |
| `N` | Message context builder (role, content formatter) |
| `LVK` | Sub-formatter used by message builder (calls `Gv`, `KVK`, `T7A`) |
| `CH` | JSON serialisation helper (`JSON.stringify`) |
| `X4` | Content sanitiser/trimmer (string replace, slice, lastIndexOf) |
| `HbH` | Auxiliary message builder (calls `B5A`) |
| `$VK` | File-write pipeline step (Buffer.byteLength, then-chain, bind) |
| `c` | General utility / context accessor |
| `K8` | Error-code classifier / guard utility |
| `JOH` | Config file reader (`readConfigFile`; handles ENOENT, parse errors, backups) |
| `g6` | JSON parse wrapper |
| `xC` | String prefix stripper (startsWith + slice) |
| `mb9` | Config backup directory scanner (readdirStringSync, basename, join) |
| `Of_` | Path join + file-type resolver |
| `w` | Background session / daemon process manager |
| `f$6` | Config field merge helper |
| `A` | String lowercaser / name normaliser |
| `V` | Versioned string accessor (startsWith filter) |
| `P` | MCP/SDK connection manager (spawn, Promise.all, connection lifecycle) |
| `wh8` | SDK connection initialiser |
| `RH` | Connection result handler (logError, push to results array) |
| `c_` | Error wrapper/constructor (Error, String) |
| `Z` | Backup list slicer (Z.slice for rotation) |
| `UK6` | Atomic file write utility (temp file, randomBytes, rename, fchmod, fsync) |
| `O` | File stat result object (isSymbolicLink) |
| `j8` | Error code extractor (calls `K8`) |
| `OFH` | Config operation flag / option object |
| `ub9` | Object entries iterator for config map |
| `zFH` | Timestamp recorder (`Date.now`) |
| `ff_` | Config file finaliser (dirname, UK6 atomic write) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.