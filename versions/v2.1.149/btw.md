---
type: feature-spec
feature: "btw"
cc_version: "2.1.149"
updated: "2026-06-01"
tags: ["btw", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.149 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/btw`

> Analysis basis: CC v2.1.149 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.149

---

## Overview

`/btw` ("by the way") is a lightweight side-channel command that lets the user ask a quick, out-of-band question without disrupting the main conversation context. It dispatches immediately as a `control-request` to the thin client layer, rendering a JSX response inline, and resolves via an async handler (`ixL`) loaded from module `L21`.

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
| module_id | `L21` |
| load_inline | `true` |
| loc_byte | `10624049` |
| loc_byte_end | `10624288` |
| loc_line | `8350` |
| arbor_handler.name | `ixL` |
| arbor_handler.fqn | `claude-2.1.149::ixL` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.149 bundle.js:+10624049

---

## Input Branching

Two distinct runtime paths exist: the user provides a non-empty question argument, or they do not. This is a simple two-branch flow; numbered pseudocode is sufficient.

1. **No argument supplied** — the handler detects an empty or missing argument string and returns the usage hint `"Usage: /btw <your question>"` as a JSX element without contacting the model.
2. **Argument supplied** — the handler constructs a `system`-role side-query, resolves configuration state (with lock acquisition), and dispatches the question immediately as a `control-request` to the thin client.

Analysis basis: CC v2.1.149 bundle.js:+10623646 (usage string), +10623685 (role literal)

---

## Behavioral Spec

### Top-level handler: `ixL` (AsyncFunction, module L21)

```
async function btwCommandHandler(context, args):

    question = args.trim()

    // Guard: no argument
    if question is empty:
        return renderJSX(usageHint)   // "Usage: /btw <your question>"

    // Build side-query message envelope
    envelope = {
        role: "system",
        content: question
    }

    // Acquire configuration (with filesystem lock)
    config = await loadConfigWithLock()   // calls fileSystemConfigLoader (f8)

    // Render JSX response element
    element = createElement(responseComponent, { envelope, config })

    return element
```

Analysis basis: CC v2.1.149 bundle.js:+10623644 (handler entry `ixL → H`), +10623708 (`ixL → f8`), +10623754 (`ixL → Y4.createElement`)

---

### Sub-feature: Usage-hint responder (`H`)

```
function usageHintResponder(seed):
    // H calls Math.random and setTimeout, suggesting a brief
    // randomised display delay before showing the hint string.
    delay = Math.floor(Math.random() * 2) + 1   // 1–2 units
    setTimeout(() => renderHint("Usage: /btw <your question>"), delay)
```

Analysis basis: CC v2.1.149 bundle.js:+13290020 (`Math.random`), +13290034 (literal `1`), +13290018 (literal `2`), +13290057 (`setTimeout`)

---

### Sub-feature: Configuration loader with filesystem lock (`f8`)

```
async function fileSystemConfigLoader(options):

    // Resolve config file path via path utilities
    configPath = resolvePath(baseDir, configFilename)   // $f_ / iY.dirname

    // Acquire filesystem lock; warn on contention
    acquired = acquireLock(configPath)                  // $f_ → L.mkdirSync
    if not acquired within timeout:
        emitTelemetry("tengu_config_lock_contention")
        logWarning("Lock acquisition took longer than expected...")

    try:
        // Read and parse config file
        raw = fs.readFileSync(configPath, "utf-8")      // JOH → q.readFileSync
        config = JSON.parse(raw)                        // g6 → JSON.parse

        // Guard: detect auth loss before write
        if cachedAuthPresent and parsedConfigMissingAuth:
            emitTelemetry("tengu_config_auth_loss_prevented")
            logWarning("saveConfigWithLock: re-read config missing auth...")
            // refuse write; return cached config

        // Validate config schema, apply defaults
        validated = validateAndMerge(config)            // N, _L9, A__

        // Handle backup rotation (up to 5 backups)
        rotateBackups(configPath, maxBackups=5)         // $f_ → L.copyFileSync, L.unlinkSync

        return validated

    catch error if error.code == "ENOENT":
        // Config file does not yet exist; return defaults
        return defaultConfig()

    catch error if error.code == "EEXIST":
        // Concurrent mkdir collision — harmless, continue
        pass

    finally:
        releaseLock(configPath)                         // L → q.delete
```

Analysis basis: CC v2.1.149 bundle.js:+3190712 (`f8 → $f_`), +3193621 (lock contention warning), +3193710 (telemetry `tengu_config_lock_contention`), +3193976 (`"ENOENT"`), +3196499 (`"EEXIST"`), +3194189 (telemetry `tengu_config_auth_loss_prevented`), +3194037 (auth-loss warning string), +3194640 (literal `5` — max backups), +3195737 (`"utf-8"`)

---

### Sub-feature: Config schema validator / merger (`N` and `_L9`)

```
function validateAndMergeConfig(raw):
    // Uppercase role fields where required
    normalised = raw.role?.toUpperCase()               // N → _.toUpperCase

    // Trim whitespace from string values
    trimmed = normalised.trim()                        // N → H.trim

    // Merge with defaults using Object.assign
    merged = Object.assign({}, defaults, trimmed)      // _L9 → Object.assign

    // Serialise for debug logging at "debug" level
    debugLog(JSON.stringify(merged))                    // CH → JSON.stringify

    // Redact sensitive fields before any external emission
    redactSensitive(merged)                             // X4 — "[REDACTED]" literal

    return merged
```

Analysis basis: CC v2.1.149 bundle.js:+202806 (`_.toUpperCase`), +202829 (`H.trim`), +2216798 (`Object.assign`), +182698 (`JSON.stringify`), +194805 (`"[REDACTED]"`), +202680 (`"debug"`)

---

### Sub-feature: Atomic file write with permissions (`UK6`)

```
function atomicWriteFile(targetPath, data):
    // Resolve symlinks recursively; detect ELOOP / ENOTDIR
    resolved = readlinkSync(targetPath)
    if not isAbsolute(resolved):
        resolved = path.resolve(path.dirname(targetPath), resolved)

    // Generate 6-byte random hex suffix for temp file
    suffix = randomBytes(6).toString("hex")
    tempPath = targetPath + "." + suffix

    // Write to temp, apply original permissions (mode 384 = 0o600)
    fd = fs.openSync(tempPath, flags)
    fs.writeFileSync(fd, data)
    fs.fchmodSync(fd, 384)
    logDebug("Applied original permissions to temp file")
    fs.fsyncSync(fd)
    fs.closeSync(fd)

    // Atomic rename
    fs.renameSync(tempPath, targetPath)
```

Analysis basis: CC v2.1.149 bundle.js:+1009377 (`sQ8.randomBytes`), +1009393 (literal `6`), +1009405 (`"hex"`), +1009555 (literal `8`), +1009813 (`Df.writeFileSync`), +1009871 (`Df.fchmodSync`), +1009892 (permissions log string), +1009937 (`Df.fsyncSync`), +1010065 (`q.renameSync`), +3194922 (literal `384`)

---

### Sub-feature: Background daemon dispatcher (`w`)

```
function backgroundSessionDispatcher(request):
    // Escalate stalled processes with SIGKILL after grace period
    // Grace window: 30 s initial, escalate after 15 s
    if processStalled(pid, gracePeriod=30, escalateAfter=15):
        process.kill(pid, "SIGKILL")
        emitTelemetry("tengu_bg_dispatch_sigkill_escalate")

    // Check available memory (threshold: 1024 MB)
    freeMem = os.freemem()
    if freeMem < 1024 * 1024 * 1024:
        emitTelemetry("tengu_bg_dispatch_low_mem")

    // Spare session management
    if spareSessionAvailable:
        emitTelemetry("tengu_bg_spare_claim")
        claimSpareSession()
    else:
        spawnNewSession()
        emitTelemetry("tengu_bg_spare_enable")

    // On claim failure
    on claimError:
        emitTelemetry("tengu_bg_spare_claim_fail")
        logError("report the issue at https://github.com/anthropics/claude-code/issues")
```

Analysis basis: CC v2.1.149 bundle.js:+15260691 (literal `30`), +15260702 (literal `15`), +15260784 (`"SIGKILL"`), +15260736 (telemetry), +15261145 (`mqA.freemem`), +1024 literal at +15261209, +15261315 (telemetry `tengu_bg_dispatch_low_mem`), +15262010 (telemetry `tengu_bg_spare_enable`), +15262131 (telemetry `tengu_bg_spare_claim`), +15262394 (telemetry `tengu_bg_spare_claim_fail`), +15261661 (issue URL)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_config_lock_contention` | Fired when config file lock takes longer than expected (bundle.js:+3193710) |
| Telemetry — `tengu_config_stale_write` | Fired when a stale write attempt is detected on the config file (bundle.js:+3193846) |
| Telemetry — `tengu_config_parse_error` | Fired when JSON parsing of the config file fails (bundle.js:+3196285) |
| Telemetry — `tengu_config_auth_loss_prevented` | Fired when a write would erase cached authentication credentials (bundle.js:+3194189) |
| Telemetry — `tengu_bg_dispatch_sigkill_escalate` | Fired when a background process is force-killed (bundle.js:+15260736) |
| Telemetry — `tengu_bg_dispatch_low_mem` | Fired when free memory falls below threshold during dispatch (bundle.js:+15261315) |
| Telemetry — `tengu_bg_spare_enable` | Fired when a new spare background session is spawned (bundle.js:+15262010) |
| Telemetry — `tengu_bg_spare_claim` | Fired when a spare session is successfully claimed (bundle.js:+15262131) |
| Telemetry — `tengu_bg_spare_claim_fail` | Fired when spare session claim fails (bundle.js:+15262394) |
| thinClientDispatch | Dispatches as `control-request`; bypasses main conversation turn |
| immediate | Set to `true`; the command resolves without waiting for a full agent turn |
| Config filesystem lock | Acquires and releases a directory-based mutex around config reads/writes |
| Config backup rotation | Maintains up to 5 rolling backups of the config file (`.backup.*` naming) |
| Atomic config write | Uses temp-file + fsync + rename pattern with mode `0o600` (384) |
| JSX render | Returns a `Y4.createElement`-constructed element as the command's visual output |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.149 | Initial analysis |

---

## Common Mistakes

1. **Omitting the argument**: Invoking `/btw` with no text returns only the usage hint `"Usage: /btw <your question>"` — no model call is made. Always supply the question text as the argument.
2. **Expecting a conversational reply in the main thread**: `/btw` dispatches as a `control-request`, not a normal user turn. The response appears out-of-band and does not advance the primary conversation context or history.
3. **Assuming synchronous availability**: The handler (`ixL`) is an `AsyncFunction` loaded lazily from module `L21`. In environments with slow module initialisation the first invocation may have a brief startup delay.
4. **Concurrent config writes**: The command's config path goes through a filesystem-mutex lock. Running two Claude Code instances simultaneously may trigger `tengu_config_lock_contention` and produce a warning; only one instance will proceed with the write.
5. **Auth-sensitive config edits**: If an external tool modifies `~/.claude.json` in a way that removes authentication fields while Claude Code holds a cached copy, the `tengu_config_auth_loss_prevented` guard will silently refuse the write — the user's question may still be answered but config changes will be lost.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `ixL` | Top-level async handler for `/btw` command (arbor_handler) |
| `H` | Usage-hint responder / randomised-delay display helper |
| `f8` | Filesystem config loader entry point |
| `$f_` | Core config read-with-lock implementation |
| `_` | Filesystem abstraction (readdir, statSync, etc.) |
| `Q6` | Path existence / accessibility checker |
| `L` | Filesystem module wrapper (mkdirSync, statSync, copyFileSync, unlinkSync, readdirStringSync) |
| `q` | Secondary filesystem operations (readFileSync, statSync, mkdirSync, etc.) |
| `M` | Async resource / connection lifecycle manager |
| `_L9` | Config object merger (Object.assign wrapper) |
| `A__` | Config default-value applicator |
| `N` | Config schema normaliser (role uppercasing, trim, debug log) |
| `MVK` | Config field validator sub-routine |
| `CH` | JSON serialisation helper (JSON.stringify wrapper) |
| `X4` | Sensitive-field redactor |
| `HbH` | Config value sanitiser |
| `OVK` | Config file writer / buffer-length checker |
| `c` | General-purpose utility / helper |
| `K8` | Error classification / code checker |
| `JOH` | Config file reader and backup manager |
| `g6` | JSON.parse wrapper |
| `xC` | String prefix stripper (startsWith / slice) |
| `mb9` | Backup directory enumerator |
| `Of_` | Path joiner helper |
| `w` | Background daemon session dispatcher |
| `f$6` | Config field presence validator |
| `A` | String case-normalisation helper (toLowerCase) |
| `V` | String prefix filter |
| `P` | MCP / SDK connection manager |
| `wh8` | Connection transport initialiser |
| `RH` | Connection result handler |
| `c_` | Error constructor wrapper |
| `Z` | Backup list slice helper |
| `UK6` | Atomic file write with permission preservation |
| `O` | Stat result / symbolic-link type checker |
| `j8` | Error code validator |
| `OFH` | Config options parser |
| `ub9` | Object.entries iterator helper |
| `zFH` | Timestamp recorder (Date.now wrapper) |
| `ff_` | Config file path builder with atomic-write support |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.