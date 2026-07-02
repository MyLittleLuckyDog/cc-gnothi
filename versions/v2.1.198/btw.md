---
type: feature-spec
feature: "btw"
cc_version: "2.1.198"
updated: "2026-07-02"
tags: ["btw", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.198 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/btw`

> Analysis basis: CC v2.1.198 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.198

---

## Overview

`/btw` ("by the way") lets the user pose a quick side question to Claude without disrupting the flow of the main conversation. The command accepts a single free-text argument, dispatches it as a `control-request` through the thin-client layer, and renders inline JSX output — making it a lightweight, non-blocking inquiry mechanism sitting alongside an active session.

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
| module_id | `N2l` |
| load_inline | `true` |
| loc_byte | `11669317` |
| loc_byte_end | `11669556` |
| loc_line | `7636` |
| arbor_handler.name | `u2f` |
| arbor_handler.fqn | `claude-2.1.198::u2f` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.198 bundle.js:+11669317

---

## Input Branching

The handler has two primary branches — a missing-argument guard and the normal dispatch path — so numbered pseudocode is used here.

1. **Guard — empty argument**: If the user supplies no argument after `/btw`, the handler immediately emits the usage hint `"Usage: /btw <your question>"` (bundle.js:+11668920) and returns without dispatching.
2. **Normal path — argument present**: The trimmed question text is packaged into a `system`-role message (bundle.js:+11668959) and forwarded to the agent via the `control-request` thin-client dispatch channel. A JSX element is rendered inline to surface the response (call to `I_.jsx`, bundle.js:+11669028).

---

## Behavioral Spec

### Top-level handler (`handlerMain`)

Analysis basis: CC v2.1.198 bundle.js:+11668918

```
async function handlerMain(commandInput, appContext):
    question = sanitizeText(commandInput)          // calls string-replace helper (e→t.replace)

    if question is empty:
        return renderUsageHint("Usage: /btw <your question>")

    systemMessage = buildMessage(role="system", content=question)

    configSnapshot = loadConfigWithLock(appContext) // calls configLoader (_n)

    dispatchControlRequest(systemMessage, configSnapshot)

    return renderInlineJSX(question, configSnapshot) // I_.jsx call
```

### Configuration loader (`configLoader`)

Analysis basis: CC v2.1.198 bundle.js:+11668982

The handler invokes the config-loader subsystem (`_n → Onn`) to obtain a consistent config snapshot before dispatch. This subsystem:

```
function configLoader(context):
    acquireLock(configPath)          // Onn → s.mkdirSync lock directory

    if lockContentionDetected:
        emitTelemetry("tengu_config_lock_contention")
        log("Lock acquisition took longer than expected - another Claude instance may be running")

    snapshot = readConfigFile(configPath, encoding="utf-8")

    if snapshot has parse error:
        emitTelemetry("tengu_config_parse_error")
        attemptAutoRepair(cachedConfig)   // SCt repair path
        emitTelemetry("tengu_config_auto_repaired")

    if snapshot is missing auth that cache holds:
        emitTelemetry("tengu_config_auth_loss_prevented")
        refuseWrite()   // safety guard — see GH #3117

    return snapshot
```

Key literals surfaced during config loading:

- Lock-contention warning text: `"Lock acquisition took longer than expected - another Claude instance may be running"` (bundle.js:+14255347)
- Guard message regarding auth-loss prevention references GH issue #3117 (bundle.js:+14256127)
- Config pre-access guard string: `"Config accessed before allowed."` (bundle.js:+14257755)
- Parse re-read repair note references GH issue #3117 (bundle.js:+14255821)
- Maximum lock wait: 60 000 ms (bundle.js:+14256485)
- Backup rotation keeps up to 5 copies (bundle.js:+14256740)
- Config files read with `"utf-8"` encoding (bundle.js:+14257838)

### Config save path (`configPersist`)

Analysis basis: CC v2.1.198 bundle.js:+14254873

When the command triggers any config write (e.g. session state update), the save routine (`Kfr → BMt`) performs an atomic write:

```
function configPersist(data, path):
    validate(data)
    tmpPath = buildTempPath(path)           // v7o → sy.join
    writeToTempFile(tmpPath, data)          // BMt → du.writeFileSync
    applyOriginalPermissions(tmpPath)       // du.fchmodSync
    fsync(tmpPath)                          // du.fsyncSync
    atomicRename(tmpPath, path)             // du.renameSync / r.renameSync
    cleanupStaleBackups(backupDir, keep=5)
```

Backup directory segment: `"backups"` (bundle.js:+14257323).
File mode constant: `384` (bundle.js:+14257022), corresponding to `0o600`.

### Inline JSX render

Analysis basis: CC v2.1.198 bundle.js:+11669028

```
function renderInlineJSX(question, config):
    element = I_.jsx(BtwResponseComponent, { question, config })
    return element
```

Because the registration type is `local-jsx` and `immediate: true`, the rendered element is displayed synchronously in the CLI pane without waiting for a full agent turn.

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_config_lock_contention` (bundle.js:+14255436) |
| Telemetry | `tengu_config_stale_write` (bundle.js:+14255572) |
| Telemetry | `tengu_config_parse_error` (bundle.js:+14259169) |
| Telemetry | `tengu_config_auto_repaired` (bundle.js:+14255949) |
| Telemetry | `tengu_config_auth_loss_prevented` (bundle.js:+14256279) |
| Telemetry | `tengu_config_fallback_write` (bundle.js:+14255052) |
| Telemetry | `tengu_bg_dispatch_sigkill_escalate` (bundle.js:+18374756) |
| Telemetry | `tengu_bg_dispatch_low_mem` (bundle.js:+18375462) |
| Telemetry | `tengu_bg_spare_enable` (bundle.js:+18376152) |
| Telemetry | `tengu_bg_spare_claim` (bundle.js:+18376280) |
| Telemetry | `tengu_bg_spare_claim_fail` (bundle.js:+18376546) |
| Telemetry | `tengu_daemon_config_reload` (bundle.js:+18392244) |
| Dispatch channel | `control-request` via thin-client layer |
| Config lock | Directory-based mutex; max wait 60 000 ms; contention logged and telemetered |
| Config backup | Rotates up to 5 backups under `"backups"` subdirectory |
| Auth-loss guard | Refuses config write if in-memory auth is absent from re-read snapshot (GH #3117) |
| Rendering | Synchronous inline JSX (`I_.jsx`); no new agent turn created |
| Process listeners | Background-dispatch path registers `process.on("exit", ...)` handler (bundle.js:+217658) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| appState changes | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.198 | Initial analysis |

---

## Common Mistakes

1. **Omitting the argument**: Typing `/btw` with no text returns the usage hint `"Usage: /btw <your question>"` and does not dispatch anything — always supply the question text.
2. **Expecting a new conversation turn**: `/btw` uses `thinClientDispatch: "control-request"` and renders inline JSX immediately; it does not create a regular assistant turn, so the main conversation context is not affected.
3. **Assuming blocking behavior**: The `immediate: true` flag means the command resolves synchronously in the UI. Long-running side questions should use a different command that supports full async agent turns.
4. **Concurrent Claude instances and config lock**: If another Claude Code process holds the config lock, the `/btw` command's config-load path will wait up to 60 000 ms and emit a `tengu_config_lock_contention` event before proceeding; users may observe a momentary delay.
5. **Auth-wipe risk on corrupted config**: The handler's config layer will refuse to persist a new snapshot if the re-read config is missing authentication data that the in-memory cache holds, to prevent accidental credential loss (see GH #3117).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `u2f` | Top-level async handler for `/btw` (arbor_handler) |
| `e` | Text sanitization / string-replace helper |
| `_n` | Config-loader entry point (calls `Onn`) |
| `Onn` | Core config-load-with-lock implementation |
| `zt` | Path resolution utility |
| `s` | Filesystem operations wrapper (mkdirSync, statSync, etc.) |
| `r` | Secondary filesystem / stream operations (readFileSync, copyFileSync, etc.) |
| `i` | Stream / resource close handler |
| `sfi` | Config snapshot factory |
| `uGr` | Config object builder (called by `sfi`) |
| `T` | Message/prompt construction utility |
| `Hiu` | Message format helper |
| `Me` | JSON serialization helper |
| `Oc` | Content-block builder |
| `YZe` | Output-block helper |
| `biu` | Background subprocess / run-loop manager |
| `V` | Validation / value-check utility |
| `en` | Error normalization helper |
| `SCt` | Config file read + auto-repair routine |
| `Gt` | JSON parse wrapper |
| `c6` | String prefix stripper |
| `I7o` | Directory scanner for config lookup |
| `v7o` | Path join helper |
| `m` | Array/filter utility |
| `ACt` | Auth consistency checker |
| `n` | String case-conversion helper |
| `_` | Session-message builder |
| `g` | Background daemon / process manager |
| `h` | Queue / collection push helper |
| `vgm` | UUID generator wrapper |
| `xn` | Session-ID generator |
| `HC` | Session handle / context holder |
| `I` | Scroll / slice position calculator |
| `R` | HTTP request router (OAuth/API) |
| `A` | User-info fetcher |
| `BMt` | Atomic file write implementation |
| `Wd` | Symlink-aware realpath resolver |
| `d` | Supervisor / watcher controller |
| `mn` | Error enrichment helper |
| `zws` | Locked file-write helper |
| `$Mt` | File-open-with-lock helper |
| `ant` | Permission error handler |
| `$Dr` | Rename-with-retry helper |
| `eLs` | Property-definition utility |
| `TFe` | Config timestamp tracker |
| `b7o` | Object-entries iterator |
| `Dnn` | Config modification timestamp recorder |
| `Mnn` | Config merge helper |
| `Kfr` | Config save-with-lock orchestrator |
| `Pe` | Logging / output helper |
| `OQe` | Log sink / output queue |