---
type: feature-spec
feature: "loops"
cc_version: "2.1.150"
updated: "2026-06-01"
tags: ["loops", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.150 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/loops`

> Analysis basis: CC v2.1.150 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.150

---

## Overview

`/loops` is a local JSX slash command that provides an interactive management interface for recurring loops (cron-scheduled agent tasks) and stop-hooks (post-session trigger scripts). It supports listing currently active loops and stop-hooks, creating new ones, and deleting existing entries, all rendered as a JSX component within the Claude Code terminal UI.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `loops` |
| description | `List, create, and delete recurring loops and stop-hooks` |
| immediate | `true` |
| module_id | `Fm1` |
| load_inline | `true` |
| loc_byte | `12099551` |
| loc_byte_end | `12099733` |
| loc_line | `9852` |
| arbor_handler.name | `yH5` |
| arbor_handler.fqn | `claude-2.1.150::yH5` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.150 bundle.js:+12099551

---

## Input Branching

The command dispatches across 5+ distinct modes (list, create-cron, create-stophook, delete-cron, delete-stophook) plus sub-branching for cron schedule parsing, making a Mermaid flowchart the appropriate representation.

```mermaid
flowchart TD
    A(["/loops invoked"]) --> B[Fire tengu_loops_command telemetry]
    B --> C[Load loops registry via readLoopsFile]
    C --> D[Load stop-hooks from .claude config dir]
    D --> E{Input argument present?}

    E -- No --> F[Render JSX list view\nshowing all cron loops\nand stop-hooks]

    E -- Yes --> G{Argument keyword?}

    G -- '"stophook"' --> SH[Parse stop-hook subcommand]
    SH --> SH1{Sub-action?}
    SH1 -- create --> SH2[createStopHook:\nGenerate UUID, write hook file\nvia pdH, emit tengu_stop_hook_added]
    SH1 -- delete --> SH3[deleteStopHook:\nLocate hook by ID, unlink\nfile, emit tengu_stop_hook_removed]
    SH1 -- unknown --> SH4[Render stop-hook help / list]

    G -- '"cron"' --> CR[Parse cron expression\nvia cronScheduleParser]
    CR --> CR1{Schedule valid?}
    CR1 -- Yes --> CR2[Validate fields:\nminutes 0-59, hours 0-23,\ndays 1-31]
    CR2 --> CR3[createLoop:\nGenerate UUID via OAq.randomUUID,\ntimestamp via Date.now,\nwrite registry via writeLoopsFile,\ninvoke MCP update path f]
    CR1 -- No --> CR4[Return parse error\nto user]

    G -- delete ID --> DEL[deleteLoop:\nRemove entry from registry,\npersist via writeLoopsFile,\nstop running daemon worker uqA]

    G -- list / default --> F

    SH2 --> Z([Return JSX response])
    SH3 --> Z
    CR3 --> Z
    CR4 --> Z
    DEL --> Z
    F --> Z
```

---

## Behavioral Spec

### Main Handler — `loopsCommandHandler` (bundle ident: `yH5`)

The handler is an `AsyncFunction` resolved via `module_id` → `Fm1`.

```
async function loopsCommandHandler(context):
    emit telemetry("tengu_loops_command")           // bundle.js:+12098508
    cronLoops  = await readLoopsRegistry(context)   // bHH → GVH
    stopHooks  = await loadStopHooks(context)        // rtH → hjH
    appState   = context.getAppState()              // bundle.js:+12098558
    baseUrl    = resolveBaseUrl(appState)            // S6

    parsedInput = parseLoopArgument(context.input)  // tZ / kH5

    if parsedInput.type == "cron":
        loop = await createLoop(parsedInput, appState, cronLoops)  // UdH
        return renderJSX(loop)

    if parsedInput.type == "stophook":
        result = await handleStopHook(parsedInput, appState, stopHooks)  // CHH
        return renderJSX(result)

    if parsedInput.type == "delete":
        await deleteEntry(parsedInput.id, cronLoops, stopHooks)
        return renderJSX(confirmation)

    // default: list view
    return renderJSX(
        go_.createElement(listComponent, { loops: cronLoops, stopHooks })
    )                                               // bundle.js:+12099311
```

Analysis basis: CC v2.1.150 bundle.js:+12098506

---

### Loops Registry I/O — `readLoopsFile` (bundle ident: `GVH`)

Reads and parses the persistent loops registry file. File encoding is UTF-8 (bundle.js:+4761635).

```
async function readLoopsFile(configPath):
    resolvedPath = pathResolver(configPath)         // UKH → Rq8.join, rK
    rawContent   = await fs.readFile(resolvedPath, "utf-8")
    parsed       = parseConfig(rawContent)          // s9 → K8
    validated    = validateSchema(parsed)           // RH → c_, mH, G1, xiK
    if not Array.isArray(validated):
        return []
    normalized   = normalizeEntries(validated)      // N → LVK, CH, X4, vN
    return normalized
```

Error codes handled: `ENOENT`, `EACCES`, `EPERM`, `ENOTDIR`, `ELOOP`, `EROFS` (bundle.js:+173712–173781). On any such error the function logs via `ll.logError` (bundle.js:+968915) and returns an empty list.

Analysis basis: CC v2.1.150 bundle.js:+4761588

---

### Cron Schedule Parser — `cronScheduleParser` (bundle ident: `kH5`)

Parses a human-readable or numeric cron expression and validates its fields.

```
function cronScheduleParser(inputString):
    trimmed = inputString.trim()
    parts   = trimmed.match(cronRegex)

    minutes = parseInt(parts.minutes)
    if minutes > 59:                        // limit: bundle.js:+12098273
        clamp(minutes, 0, 59)

    hours = parseInt(parts.hours)
    if hours > 23:                          // limit: bundle.js:+12098344
        clamp(hours, 0, 23)

    days = parseInt(parts.days)
    if days > 31:                           // limit: bundle.js:+12098397
        clamp(days, 0, 31)

    // Special labels
    if expression matches "Every minute":   // bundle.js:+4759499
        return { type: "cron", schedule: "* * * * *" }
    if expression matches "Every hour":     // bundle.js:+4759716
        return { type: "cron", schedule: "0 * * * *" }

    // Math helpers used: Math.max, Math.ceil, Math.round
    normalizedSchedule = buildCronString(minutes, hours, days)
    return { type: "cron", schedule: normalizedSchedule }
```

Cron field parsing also handles day-of-week sets and range expressions (e.g., `"1-5"` at bundle.js:+4760423) via `OP7` (splits on separators, uses `parseInt`, adds values to a `Set`, then emits via `Array.from`).

Analysis basis: CC v2.1.150 bundle.js:+12098094

---

### Loop Creation — `createLoop` (bundle ident: `UdH`)

```
async function createLoop(parsedSchedule, appState, existingLoops):
    id        = OAq.randomUUID()            // bundle.js:+4762935
    createdAt = Date.now()                  // bundle.js:+4762997
    entry     = buildLoopEntry(id, createdAt, parsedSchedule)  // T2H

    updatedList = [...existingLoops, entry]
    await writeLoopsFile(updatedList)       // GVH write path

    // Trigger MCP integration / background worker registration
    mcpResult = await f(entry, appState)    // f → UyH, gDK
    if mcpResult.error:
        log error

    await persistRegistry(updatedList)      // pdH → Sq8.writeFile, UKH, CH
    return entry
```

The `.claude` directory is used as the storage root for loop configuration files (bundle.js:+4762776).

Analysis basis: CC v2.1.150 bundle.js:+4762935

---

### Stop-Hook Management — `handleStopHook` (bundle ident: `CHH`)

Stop-hooks are scripts executed at the end of an agent session ("Stop" event, bundle.js:+10453608). Sub-command routing:

```
async function handleStopHook(parsedInput, appState, existingHooks):
    hookExists = zs(existingHooks, parsedInput.id)  // bundle.js:+4763265 → _.has

    if parsedInput.action == "create":
        hookConfig = buildHookConfig(parsedInput)
        await pdH(hookConfig)                   // mkdir .claude, writeFile
        emit telemetry("tengu_stop_hook_added") // bundle.js:+10454286
        appendHookToConversation(appState)      // atH → applyMessageOp, goal/attachment ops

    if parsedInput.action == "delete":
        if not hookExists:
            return errorMessage("Stop hook not found")  // bundle.js:+12098950
        await removeHookFile(parsedInput.id)
        emit telemetry("tengu_stop_hook_removed")       // bundle.js:+10454654
        return successMessage("Stop hook cleared")      // bundle.js:+12098972

    return renderHookList(existingHooks)
```

The `atH` function appends a `system`-role message (bundle.js:+12098839) with `goal` and `goal_status` content blocks (bundle.js:+10454685, 10454813) and uses message type `append` (bundle.js:+10454620). A random UUID is generated per invocation via `pJ1.randomUUID` (bundle.js:+10454744).

Analysis basis: CC v2.1.150 bundle.js:+4763265

---

### Background Worker / Daemon Dispatch — `daemonWorkerDispatch` (bundle ident: `uqA`)

When a loop is created or deleted, the background daemon layer is notified. Session state transitions are mapped to string tokens:

| State Token | Meaning |
|---|---|
| `"done"` | Session completed normally (bundle.js:+15266068) |
| `"killed"` | Session forcibly killed (bundle.js:+15266086) |
| `"stopped"` | Session stopped cleanly (bundle.js:+15266095) |
| `"failed"` | Session encountered error (bundle.js:+15266105) |
| `"crashed"` | Session process crashed (bundle.js:+15266252) |
| `"blocked"` | Session waiting on permission (bundle.js:+15266306) |
| `"working"` | Session actively processing (bundle.js:+15266413) |
| `"bg"` | Session running in background (bundle.js:+15266577) |
| `"daemon"` | Managed by daemon (bundle.js:+15266897) |
| `"idle"` | Session idle (bundle.js:+15267012) |
| `"resuming"` | Session resuming (bundle.js:+15267849) |

The timeout for re-adopting a session after foreground yield is 300,000 ms (5 minutes) at bundle.js:+15267635.

Analysis basis: CC v2.1.150 bundle.js:+15265996

---

### Cron Execution Path — `cronRunner` (bundle ident: `tZ`)

```
async function cronRunner(loopEntry, processMap):
    schedule = loopEntry.schedule.trim()         // bundle.js:+4759379

    // Compute next fire time
    nextDate = new Date()
    parsedFields = parseScheduleFields(schedule) // K.match, parseInt
    nextDate.setUTCDate(...)                      // bundle.js:+4760275
    nextDate.setUTCHours(...)                     // bundle.js:+4760306
    nextDate.getDay()                             // bundle.js:+4760335

    // Kill existing worker if running
    existingWorker = processMap.get(loopEntry.id) // w → A.get, C.kill
    if existingWorker:
        existingWorker.kill("SIGKILL")            // bundle.js:+15260919

    // Spawn new background session worker
    newWorker = spawnDaemonWorker(loopEntry)      // D → kqA → Bun.spawn
    processMap.set(loopEntry.id, newWorker)
    return nextDate.toString()
```

Memory guard: available system memory is checked via `mqA.freemem()` (bundle.js:+15261280); on macOS a 1024 MB floor is applied (bundle.js:+12607184). Low-memory events emit `tengu_bg_low_mem_mb` (bundle.js:+12607162) and `tengu_bg_dispatch_low_mem` (bundle.js:+15261450).

Analysis basis: CC v2.1.150 bundle.js:+4759379

---

### Loop Deletion — `deleteLoop` (derived from `uqA` + registry write path)

```
async function deleteLoop(id, cronLoops, processMap):
    entry = cronLoops.find(e => e.id == id)
    if not entry:
        return errorMessage("Loop not found")

    // Stop the running worker
    worker = processMap.get(id)
    if worker:
        worker.kill("SIGTERM")
        processMap.delete(id)

    // Persist updated registry
    updatedList = cronLoops.filter(e => e.id != id)
    await writeLoopsFile(updatedList)

    return successMessage("Loop deleted")
```

Analysis basis: CC v2.1.150 bundle.js:+15267621

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_loops_command` | Fired on every `/loops` invocation (bundle.js:+12098508) |
| Telemetry: `tengu_stop_hook_added` | Fired when a new stop-hook is successfully created (bundle.js:+10454286) |
| Telemetry: `tengu_stop_hook_removed` | Fired when a stop-hook is deleted (bundle.js:+10454654) |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Fired when a background worker is SIGKILL-escalated (bundle.js:+15260871) |
| Telemetry: `tengu_daemon_control` | Fired on daemon start/stop operations (bundle.js:+15296981) |
| Telemetry: `tengu_feature_bad` / `tengu_feature_ok` / `tengu_feature_sad` | Feature flag health signals (bundle.js:+963479, 963421, 963556) |
| Telemetry: `tengu_bg_low_mem_mb` | Emitted when system free memory falls below threshold (bundle.js:+12607162) |
| Telemetry: `tengu_bg_dispatch_low_mem` | Emitted when low-memory guard prevents dispatch (bundle.js:+15261450) |
| Telemetry: `tengu_bg_spare_enable` | Emitted when spare background session pool is enabled (bundle.js:+15262145) |
| Telemetry: `tengu_bg_spare_spawn` | Emitted when a spare session is spawned (bundle.js:+15260564) |
| Telemetry: `tengu_bg_spare_claim` | Emitted when a spare session is claimed for a loop (bundle.js:+15262266) |
| Telemetry: `tengu_bg_spare_claim_fail` | Emitted when spare claim fails (bundle.js:+15262529) |
| Telemetry: `tengu_bg_sendclaim_failed` | Emitted when sending claim to daemon fails (bundle.js:+15241972) |
| Telemetry: `tengu_daemon_config_reload` | Emitted on daemon config reload (bundle.js:+15275657) |
| Telemetry: `tengu_daemon_yield` | Emitted when daemon yields to foreground (bundle.js:+15279828) |
| Telemetry: `tengu_bg_session_create` | Emitted on background session creation (bundle.js:+15261181) |
| Telemetry: `dup_retry_exhausted` (literal) | Logged when duplicate retry budget runs out (bundle.js:+15261208) |
| Filesystem writes | Loop registry JSON file written under `.claude/` config directory; stop-hook scripts written via `Sq8.writeFile` |
| Filesystem reads | Registry file read with UTF-8 encoding; pins read from `pins.json` (bundle.js:+4064168) |
| appState changes | `getAppState` / `setAppState` called; `applyMessageOp` appends `system`-role goal messages when a stop-hook is created or removed |
| Background process management | `Bun.spawn` used to start background sessions (bundle.js:+15240677); `SIGKILL` / `SIGTERM` used to stop them |
| Daemon IPC | Unix socket connection via `Vh8.connect`; claim frames serialized with `Buffer.allocUnsafe` + `writeUInt32BE` + `writeUInt8`; send-claim timeout: 5000 ms (bundle.js:+15242393) |
| Sound | None observed in depth-2 traversal |
| Hook registration | `hooks_gate` (bundle.js:+10453796) and `trust_gate` (bundle.js:+10453850) feature gates checked before hook operations |

---

## Version History

| Version | Change |
|---|---|
| v2.1.150 | Initial analysis |

---

## Common Mistakes

1. **Supplying an invalid cron expression**: The parser (`kH5`) clamps out-of-range minute (>59), hour (>23), and day (>31) values silently. Users expecting an error on bad input may be confused; validate expressions before submitting.
2. **Deleting a stop-hook that was never created**: The handler returns the literal string `"Stop hook not found"` (bundle.js:+12098950) rather than an exception, so callers should check the return value rather than catching errors.
3. **Expecting immediate loop execution**: `/loops` schedules cron-based recurring loops; the loop will only fire at the next scheduled cron tick, not immediately upon creation.
4. **Confusing `cron` loops with `stophook` entries**: These are distinct sub-commands. Passing `stophook` arguments to the cron path (or vice versa) results in a no-op list render, not an error.
5. **Platform-specific memory limits on macOS**: The background dispatcher enforces a 1024 MB free-memory floor only on `"macos"` (bundle.js:+12607135); on other platforms the threshold differs. Loop dispatch may be silently deferred under low-memory conditions.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `yH5` | Main handler function for `/loops` command (AsyncFunction) |
| `c` | Core context / utility reference |
| `bHH` | Loads loops registry and config (calls `GVH`, `F0`) |
| `GVH` | `readLoopsFile` — reads and validates the loops registry from disk |
| `Q6` | Config path resolver helper |
| `UKH` | Path join wrapper using `Rq8.join` and `rK` |
| `rK` | Path normalization utility (calls `Dv`) |
| `s9` | Config parser (calls `K8`) |
| `K8` | Schema/type validator |
| `RH` | Entry validator with error logging (`c_`, `mH`, `G1`, `xiK`, `ll.logError`) |
| `c_` | Error constructor wrapper |
| `mH` | String coercion utility |
| `G1` | Traffic classification helper (`essential-traffic`) |
| `xiK` | Circular-buffer queue helper (`Hm6.shift`, `Hm6.push`) |
| `N` | Entry normalizer (calls `LVK`, `CH`, `X4`, `vN`) |
| `LVK` | Field normalizer sub-routine |
| `H` | Global utility / random / timeout reference |
| `CH` | `JSON.stringify` wrapper |
| `X4` | String path trimmer with `lastIndexOf` / `slice` |
| `HbH` | Normalization helper (`B5A`) |
| `$VK` | File content reader with byte-length check (`Buffer.byteLength`, `fMA`) |
| `vN` | Cron expression pre-processor (calls `OP7`) |
| `OP7` | Cron field tokenizer (split, match, `parseInt`, `Set`) |
| `A` | Generic array / collection reference |
| `L` | Promise/cleanup chain helper |
| `q` | Set-like collection |
| `M` | Stream / process handle |
| `F0` | Secondary config loader (calls `Dv`) |
| `Dv` | Low-level config directory resolver |
| `rtH` | Stop-hooks loader (calls `hjH`) |
| `hjH` | Stop-hooks map builder (`K.set`, `Oeq`) |
| `K` | Map collection reference |
| `Oeq` | Stop-hooks entry mapper |
| `S6` | Base URL / app state resolver (calls `Dv`) |
| `tZ` | `cronRunner` — computes next fire time, kills old worker, spawns new one |
| `w` | Background worker process wrapper (spawn, kill, memory checks) |
| `C` | Daemon process class (uses `KXK`, `Dz`, `N`, `RH`, `kk5`) |
| `KXK` | Filesystem realpath+stat resolver |
| `Dz` | Daemon state helper |
| `kk5` | Daemon IPC setup helper |
| `z` | Daemon write/stop stream (`bH`, `uH`, `Rk`, `pu`) |
| `uH` | IPC write helper (calls `c`) |
| `bH` | IPC write helper variant (calls `c`) |
| `Kv8` | Platform memory guard (macOS 1024 MB threshold) |
| `V6` | Memory pressure dispatcher |
| `Oz6` | Pins file reader (`pins.json`, `V37`) |
| `wD_` | Pins path resolver |
| `g6` | `JSON.parse` wrapper |
| `j8` | Error classifier (`K8`) |
| `V37` | Directory-based pins reader |
| `g` | Session retirement helper |
| `v6` | MCP prefix filter (`mcp__`, `Cf`) |
| `VH` | Orphaned-permission checker |
| `yqA` | Daemon claim sender (IPC socket, `bB.claim`, 5000 ms timeout) |
| `yHA` | Session config writer (`KAH.writeFile`, `JSON.stringify`) |
| `Hk5` | Claim timeout guard (`Date.now`, 5000 ms, `Error`) |
| `eI5` | Claim frame builder (`bB.buildClaimFrame`) |
| `EH` | String coercion utility |
| `MB` | Binary frame serializer (`Buffer.from`, `allocUnsafe`, `writeUInt32BE`, `writeUInt8`) |
| `uqA` | `daemonWorkerDispatch` — manages worker lifecycle on create/delete |
| `bK` | Session path builder |
| `cq` | Session file cache manager (`XzH`, `vP.stat`, `vP.readFile`) |
| `Bw` | Session state normalizer (`gZ`, `"active"`) |
| `x5` | Session output writer (`SO`, `NP.join`, `CH`, `Uw`) |
| `keH` | Post-session hook executor (`Date.now`, `JgL`) |
| `hLH` | Hook path builder (`w$.join`, `ShH`) |
| `ny` | Hook argument builder (`a6`, `w$.join`, `H.split`) |
| `wB` | Hook environment builder (`Al_`, `NeH`) |
| `VZ6` | Hook directory creator (`w$.join`, `Ll_`) |
| `Y` | Daemon loop manager (start/stop/updateConfig/kill cycle) |
| `D` | Session dispatch orchestrator (memory check → spawn → retry) |
| `$` | Disposable resource handle (`HQ1`) |
| `kqA` | Bare process spawner (`Bun.spawn`, `yJK.randomBytes`, `iB.mkdir`) |
| `S` | Session resource disposable |
| `j` | Process map iterator (kill all) |
| `y` | Transient worker wrapper (`z.write`, `c`) |
| `J` | Date/schedule wrapper (references worker `w`) |
| `CHH` | `handleStopHook` — routes create/delete/list for stop-hooks |
| `zs` | Set membership checker (`_.has`) |
| `pdH` | Stop-hook file writer (`Sq8.mkdir`, `Rq8.join`, `Sq8.writeFile`, `UKH`, `CH`) |
| `atH` | Conversation goal appender (`applyMessageOp`, `setAppState`, `FJ1`) |
| `FJ1` | UUID generator for messages (`pJ1.randomUUID`) |
| `kH5` | `cronScheduleParser` — parses/validates cron field values |
| `UdH` | `createLoop` — generates UUID, timestamps entry, writes registry, triggers MCP |
| `T2H` | Loop entry builder |
| `f` | MCP server update dispatcher (`UyH`, `gDK`, `lv5`) |
| `UyH` | MCP connection manager (per-server connect/disconnect) |
| `j6H` | MCP server config adapter |
| `bN` | MCP transport builder |
| `t8` | MCP utility (`_`) |
| `HE6` | MCP server filter helper |
| `VkL` | MCP connection attempt handler (`vF_`, `y78`, `Date.now`) |
| `h78` | MCP auth token helper (`y78`, `JX`) |
| `k78` | MCP frame key helper (`FK`) |
| `z8` | MCP debug logger (`dxH.push`, `ll.logMCPDebug`) |
| `hB_` | OAuth flow handler (authorize URL, `hNL`, `nF`, `INL`) |
| `SB_` | OAuth callback handler (`kNL`, `wtH`, `JtH`) |
| `IY1` | MCP tool invoker (`vF_`, `A1`, `EW8`) |
| `kB_` | MCP error frame builder (`JX`, `FK`) |
| `lT_` | MCP transport filter (`f8`) |
| `CL` | MCP error logger (`dxH.push`, `ll.logMCPError`) |
| `ZY1` | MCP result mapper (`li`) |
| `_E6` | MCP integer parser |
| `NF_` | MCP integer parser variant |
| `gDK` | MCP state update applier (`applyMcpUpdate`, `ZW8`, `OI`) |
| `ZW8` | MCP state diff serializer |
| `OI` | MCP cleanup orchestrator (`ytH`, `K.cleanup`) |
| `lv5` | MCP server list reconciler (`Object.entries`, `UyH`, `gDK`) |
| `R78` | MCP capability checker (`Cm7.has`, `bm7.has`) |
| `r8` | Retry-with-timeout utility (`Error`, `setTimeout`, `clearTimeout`) |
| `ytH` | MCP channel serializer (`CH`) |
| `Pn` | Message formatter (`vqH`) |
| `vqH` | Message trimmer/slicer (`Bs`, `_.trim`) |
| `Bs` | Content slicer (`H.slice`, `CGA`, `x6`) |
| `otH` | Goal-set handler (`JQ_`, `setAppState`, `applyMessageOp`, `Date.now`) |
| `JQ_` | Gate checker (`Dp`, `rY`, `y_`, `uL`) |
| `Dp` | Policy settings gate (`p8`) |
| `p8` | Policy resolver (`gp6`, `rF`) |
| `rY` | Trust gate (`p8`, `TA`) |
| `y_` | Secondary gate helper |
| `uL` | Permission resolver (`Xt4`) |
| `Xt4` | Permission context builder (`mH`, `ECH`, `bq`, `m6`, `DFH`, `gF`, `x6`) |
| `_8` | Error wrapper (calls `c`) |
| `Vw` | Output token counter (`zCH`, `Object.values`) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.