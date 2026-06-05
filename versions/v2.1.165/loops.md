---
type: feature-spec
feature: "loops"
cc_version: "2.1.165"
updated: "2026-06-05"
tags: ["loops", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.165 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/loops`

> Analysis basis: CC v2.1.165 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.165

---

## Overview

`/loops` is a local-jsx slash command that provides a unified interface for listing, creating, and deleting **loops** — recurring background tasks driven by cron schedules. The command renders an interactive JSX UI in the terminal, reads loop configurations from the filesystem, dispatches background sessions to execute loop bodies, and manages stop-hook registration for each loop.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `loops` |
| description | `List, create, and delete loops` |
| immediate | `true` |
| module_id | `Q8K` |
| load_inline | `true` |
| loc_byte | `12477107` |
| loc_byte_end | `12477264` |
| loc_line | `8927` |
| arbor_handler.name | `Nhf` |
| arbor_handler.fqn | `claude-2.1.165::Nhf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.165 bundle.js:+12477107

---

## Input Branching

The handler has more than three distinct logical branches based on user intent (list, create, delete, modify cron, manage stop-hooks). A Mermaid flowchart is required.

```mermaid
flowchart TD
    A["/loops invoked"] --> B[Fire tengu_loops_command telemetry]
    B --> C[Load app state via getAppState]
    C --> D[Read loop configs from filesystem via loopConfigReader]
    D --> E{User action in JSX UI}

    E -->|No args / list| F[Enumerate existing loops\nformat schedule labels\nrender loop list]
    F --> G[Display: name · cron schedule · status]

    E -->|Create new loop| H[generateLoopId via randomUUID\nstamp createdAt = Date.now]
    H --> I[Persist loop config\nvia loopFileWriter\nmkdir .claude dir if needed]
    I --> J[Register stop-hook\nvia stopHookAdder\nfire tengu_stop_hook_added]
    J --> K[Dispatch background session\nvia backgroundDispatcher]
    K --> L[Render confirmation UI]

    E -->|Delete loop| M[Locate loop by id\nremove config file\nWD.rm recursive]
    M --> N{Stop-hook present?}
    N -->|Yes| O[Clear stop-hook\nfire tengu_stop_hook_removed\nshow "Stop hook cleared"]
    N -->|No| P[Show "Stop hook not found"]
    O --> Q[Return to list view]
    P --> Q

    E -->|Edit cron schedule| R[Parse cron string\nvia cronParser\nvalidate fields]
    R --> S{Valid cron?}
    S -->|Yes| T[Update loop config\nrewrite file\nshow schedule label]
    S -->|No| U[Show validation error]

    E -->|Set / clear stop-hook| V[stopHookManager\nappend or remove hook entry]
    V --> W[Fire tengu_stop_hook_added\nor tengu_stop_hook_removed]
```

---

## Behavioral Spec

### 1. Entry Point — `loopsCommandHandler` (bundle ident: `Nhf`)

The async handler is resolved via `module_id → Q8K` using the `module_id` resolution path. It is an `AsyncFunction`.

```
async function loopsCommandHandler(context):
    emit telemetry("tengu_loops_command")          // +12476064
    appState = context.getAppState()               // +12476114
    loopConfigs = await loadLoopConfigs(context)   // Z_H +12476102
    sessionMap  = buildSessionMap(context)          // vA6 +12476110

    loopItems = appState.map(...)                  // +12476142
    cronInfo  = loopItems.map(formatCronEntry)     // q.map +12476226

    jsxRoot = nKA.createElement(...)               // +12476867
    return render(jsxRoot)
```

Analysis basis: CC v2.1.165 bundle.js:+12476062

---

### 2. Loop Configuration Loader — `loadLoopConfigs` (bundle ident: `Z_H`)

Reads loop configuration objects from disk. Delegates to the filesystem reader `loopFileReader` (`zkH`) then normalises the result via a feature-gate check (`KE`).

```
async function loadLoopConfigs(context):
    rawConfigs = await loopFileReader(context)     // zkH +4872397
    gated      = featureGate(rawConfigs)           // KE  +4872433
    return gated
```

Analysis basis: CC v2.1.165 bundle.js:+4872397

---

### 3. Filesystem Loop Reader — `loopFileReader` (bundle ident: `zkH`)

Reads the `.claude` directory, parses each loop file, and assembles a typed list of loop records.

```
async function loopFileReader(basePath):
    configPath = pathHelper.join(basePath, ...)    // I7H +4870420
    raw        = await fs.readFile(configPath,     // _.readFile +4870409
                                   encoding="utf-8") // literal +4870437
    parsed     = parseConfigText(raw)              // Q6 +4870390

    if not Array.isArray(parsed):                  // +4870553
        return []

    results = []
    for entry in parsed:
        validated = validateEntry(entry)           // kH +4870481
        if ok:
            schedule = parseScheduleString(entry)  // nI +4870801
            results.push(schedule)                 // L.push +4870896

    serialised = serialise(results)                // SH +4870779
    return serialised
```

Error codes handled: `ENOENT`, `EACCES`, `EPERM`, `ENOTDIR`, `ELOOP`, `EROFS`
(Analysis basis: CC v2.1.165 bundle.js:+176047 – +176116)

---

### 4. Schedule String Parser — `scheduleParser` (bundle ident: `nI`)

Converts a raw schedule string into a structured schedule object. Internally calls `cronFieldParser` (`FrL`) which tokenises cron fields using `parseInt` and `Set` arithmetic.

```
function scheduleParser(raw):
    trimmed = raw.trim()                           // H.trim +4867010
    fields  = cronFieldParser(trimmed)             // FrL +4867096
    result  = []
    result.push(fields)                            // A.push +4867131
    return result
```

```
function cronFieldParser(expr):
    parts = expr.split(...)                        // H.split +4866430
    for part in parts:
        m = part.match(rangePattern)               // L.match +4866450
        if m:
            lo = parseInt(m[1], 10)                // parseInt +4866495
            addRange(lo, ..., accumulator)         // K.add +4866556
    return Array.from(accumulator)                 // Array.from +4866958
```

Numeric limits observed in field parsing: `10` (+4866509), `3` (+4866671), `6` (+4866707), `7` (+4866713), `5` (+4867046), `4` (+4867209).

Analysis basis: CC v2.1.165 bundle.js:+4867010

---

### 5. Cron Display Formatter — `cronDisplayFormatter` (bundle ident: `GN`)

Converts an internal cron schedule object into a human-readable label for display in the loops list.

```
function cronDisplayFormatter(scheduleObj):
    trimmed = scheduleObj.trim()                   // H.trim +4868181
    m       = trimmed.match(minutePattern)         // K.match +4868322
    if m:
        minutes = parseInt(m[1])                   // parseInt +4868357
        if minutes == 0:
            label = "Every hour"                   // literal +4868518
        else:
            label = "Every minute"                 // literal +4868301

    // Weekly schedule parsing
    dayOfWeek = scheduleDate.getUTCDay()           // J.getUTCDay +4869058
    scheduleDate.setUTCDate(...)                   // J.setUTCDate +4869077
    scheduleDate.getUTCDate()                      // J.getUTCDate +4869090
    scheduleDate.setUTCHours(0,0,0,0)             // J.setUTCHours +4869108
    scheduleDate.getDay()                          // J.getDay +4869137

    // Range "1-5" literal for weekday sets
    // literal "1-5" at +4869225

    return formatStr(label, dayStr)                // w.toString +4868555
```

Analysis basis: CC v2.1.165 bundle.js:+4868181

---

### 6. Schedule Precision Calculator — `schedulePrecisionCalc` (bundle ident: `Vhf`)

Computes display precision values (minutes, hours, days) for a cron expression using `Math.max`, `Math.ceil`, `Math.round`.

```
function schedulePrecisionCalc(cronExpr):
    m = cronExpr.match(pattern)                    // H.match +12475650
    n = parseInt(m[1])                             // parseInt +12475687
    capped  = Math.max(n, 1)                       // Math.max +12475772
    ceiled  = Math.ceil(capped / 60)               // Math.ceil +12475783
    rounded = Math.round(ceiled)                   // Math.round +12475856

    // Boundary constants used:
    // 60  at +12475795
    // 59  at +12475829
    // 23  at +12475900
    // 31  at +12475953

    sched = parseScheduleString(rounded)           // nI +12476020
    return sched
```

Analysis basis: CC v2.1.165 bundle.js:+12475650

---

### 7. Loop Creator — `loopCreator` (bundle ident: `xrH`)

Creates a new loop record, assigns a UUID, timestamps it, writes config files, and registers a stop-hook.

```
async function loopCreator(params):
    id        = crypto.randomUUID()                // EY9.randomUUID +4871737
    createdAt = Date.now()                         // Date.now +4871799

    meta = buildLoopMeta(id, createdAt)            // LEH +4871845
    await loopFileReader(meta)                     // zkH +4871889

    M.push(meta)                                   // M.push +4871902

    await registerStopHook(meta)                   // brH +4871996
    emitLoopsS6(meta)                              // S6 +4871934
    await logEntry(meta)                           // nr +4871983
```

Analysis basis: CC v2.1.165 bundle.js:+4871737

---

### 8. Loop File Writer — `loopFileWriter` (bundle ident: `brH`)

Persists loop config to the `.claude` directory tree.

```
async function loopFileWriter(loopMeta):
    dirPath = pathHelper.join(base, ".claude")    // bM8.join +4871567
                                                  // literal ".claude" +4871578
    await fs.mkdir(dirPath, {recursive:true})     // CM8.mkdir +4871557
    encoded = loopMeta.map(serializeEntry)        // H.map +4871618
    await fs.writeFile(targetPath, encoded)       // CM8.writeFile +4871654
    pathHelper2 = I7H(...)                        // I7H +4871668
    checksum    = serialise(encoded)              // SH +4871675
    return pathHelper.join(base,                  // K4 +4871546
                           configFile)
```

Analysis basis: CC v2.1.165 bundle.js:+4871557

---

### 9. Loop List Renderer — `loopListRenderer` (bundle ident: `T_H`)

Filters and renders the active loop list, checking for presence via a Set, then writing updated config when loops have changed.

```
function loopListRenderer(allLoops, activeSet):
    hasLoop = se(allLoops)                         // se +4872067, se→_.has +53236
    filtered = zkH(allLoops)                       // zkH +4872116
    visible  = filtered.filter(l => !activeSet.has(l.id)) // q.filter +4872125
                        .filter(l => A.has(l.id))          // A.has +4872140
    for loop in visible:
        write loop config                           // brH +4872189
    return visible
```

Analysis basis: CC v2.1.165 bundle.js:+4872067

---

### 10. Stop-Hook Manager — `stopHookManager` (bundle ident: `kA6`)

Handles adding or removing stop-hooks associated with loops. Mutates app state and fires telemetry on each change.

```
async function stopHookManager(context, loopId, action):
    S6(context)                                    // S6 +10802567
    sessions = buildSessionMap(context)            // vA6 +10802574
    state    = context.getAppState()               // H.getAppState +10802578

    if action == "add":
        newState = state.setAppState(              // H.setAppState +10802707
            appendStopHook(state, loopId))
        context.applyMessageOp(...)                // H.applyMessageOp +10802776
        uuid = crypto.randomUUID()                 // SCq→kCq.randomUUID +10802927
        emit telemetry("tengu_stop_hook_added")    // +10802461
        goal = createGoalEntry(uuid)               // goal literal +10802867
        context.c(goal)                            // c +10802831
        W6(context)                                // W6 +10802864

    elif action == "remove":
        if hookExists(state, loopId):
            clearHook(state, loopId)
            show "Stop hook cleared"               // literal +12476528
            emit telemetry("tengu_stop_hook_removed") // +10802833
        else:
            show "Stop hook not found"             // literal +12476506
```

Relevant literals: `"stop hook cleared"` (+12476528), `"stop hook not found"` (+12476506), `"append"` (+10802799), `"attachment"` (+10802909), `"goal_status"` (+10802996), `"goal"` (+10802867), `"stophook"` (+12476246).

Analysis basis: CC v2.1.165 bundle.js:+10802567

---

### 11. Loop Deleter — `loopDeleter` (bundle ident: `IA6`)

Removes a loop's config files and cleans up associated state entries.

```
async function loopDeleter(context, loopId):
    H6A(context)                                   // H6A +10802075 (policy gate)
    S6(context)                                    // S6 +10802138
    sessions = buildSessionMap(context)            // vA6 +10802156
    state    = context.getAppState()               // _.getAppState +10802160
    ts       = Date.now()                          // Date.now +10802324
    tokenCount = TD(state)                         // TD +10802349
    context.setAppState(updated)                   // _.setAppState +10802362
    context.applyMessageOp(...)                    // _.applyMessageOp +10802404
    uuid = crypto.randomUUID()                     // SCq +10802446
    context.c(deleteRecord)                        // c +10802459
    W6(context)                                    // W6 +10802512
    hH(context)                                    // hH +10802525
```

Analysis basis: CC v2.1.165 bundle.js:+10802075

---

### 12. Session Map Builder — `buildSessionMap` (bundle ident: `vA6`)

Constructs a keyed map of active background sessions for cross-referencing loop status.

```
function buildSessionMap(context):
    j2H.set(...)                                   // K.set +8984210
    mapped = MOq(context)                          // MOq +8984218
    // MOq maps H.map over session objects         // H.map +8983979
    result.push(mapped)                            // A.push +10801899
    return result
```

Analysis basis: CC v2.1.165 bundle.js:+10801775

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_loops_command` (+12476064) — fired on every `/loops` invocation |
| Telemetry | `tengu_stop_hook_added` (+10802461) — loop stop-hook registered |
| Telemetry | `tengu_stop_hook_removed` (+10802833) — loop stop-hook cleared |
| Telemetry | `tengu_bg_dispatch_sigkill_escalate` (+16133657) — background session SIGKILL escalation |
| Telemetry | `tengu_bg_low_mem_mb` (+13015589) — low-memory warning from background session |
| Telemetry | `tengu_bg_dispatch_low_mem` (+16134258) — dispatch blocked by low memory |
| Telemetry | `tengu_bg_spare_enable` (+16134962) — spare background slot enabled |
| Telemetry | `tengu_bg_spare_claim` (+16135090) — spare slot claimed by loop dispatch |
| Telemetry | `tengu_bg_spare_claim_fail` (+16135356) — spare slot claim failed |
| Telemetry | `tengu_bg_sendclaim_failed` (+16113387) — daemon claim send failed |
| Telemetry | `tengu_bg_state_read_transient` (+4160428) — transient error reading BG session state |
| Telemetry | `tengu_daemon_config_reload` (+16149069) — daemon config reload triggered |
| Telemetry | `tengu_daemon_control` (+16170625) — daemon control signal emitted |
| Telemetry | `tengu_daemon_idle_exit` (+16154322) — daemon exiting due to idle |
| Telemetry | `tengu_bg_adopt_sock_unlinked` (+13489198) — socket unlinked during adopt |
| Telemetry | `tengu_feature_ok` (+1010222) / `tengu_feature_bad` (+1010284) / `tengu_feature_sad` (+1010365) — feature gate outcomes |
| Telemetry | `tengu_mcp_skills` (+6952914) — MCP skill negotiation |
| Telemetry | `tengu_skill_file_changed` (+14158235) — skill file changed event |
| Filesystem writes | Loop configs written under `.claude/` directory via `CM8.writeFile` |
| Filesystem reads | UTF-8 config reads via `_.readFile`; pin config via `I2.readFile` from `pins.json` |
| appState changes | Stop-hook entries appended/removed; `setAppState` / `applyMessageOp` called |
| Background sessions | New background daemon sessions spawned via `Fg.spawn`; existing sessions tracked via `hDA` |
| Hook registration | Stop-hooks registered with key `"stophook"` (literal +12476246); lifecycle: `"active"` (+4167065) |
| Loop lifecycle states | `"done"`, `"killed"`, `"failed"`, `"crashed"`, `"blocked"`, `"working"`, `"bg"`, `"daemon"`, `"idle"`, `"resuming"` |
| Session cleanup timeout | `300000` ms (5 minutes) before idle cleanup (+16141337) |
| Cron type label | `"cron"` (literal +12476160) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.165 | Initial analysis |

---

## Common Mistakes

1. **Providing an invalid cron expression** — the `schedulePrecisionCalc` and `cronFieldParser` functions apply strict numeric bounds (minutes 0–59, hours 0–23, days 1–31). An out-of-range value causes a silent validation failure and the loop is not created.
2. **Expecting instant execution** — `/loops` dispatches background sessions; the loop body runs asynchronously via the daemon infrastructure. The JSX UI returns immediately after registration.
3. **Forgetting stop-hook cleanup on deletion** — if a loop is deleted without the stop-hook being cleared first, subsequent `/loops` invocations may show "Stop hook not found" because the hook entry is already absent from app state.
4. **Using `/loops` in a non-daemon context** — the command depends on the background session daemon infrastructure (`Fg.spawn`, `Fg.claim`, socket IPC). Running in a minimal environment without the daemon will cause `ECONNREFUSED` errors surfaced via `tengu_bg_sendclaim_failed`.
5. **Assuming schedule labels are stable** — `"Every minute"` and `"Every hour"` labels are computed dynamically by `cronDisplayFormatter`; they reflect the parsed minute/hour fields and may differ for complex cron expressions.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Nhf` | Main async handler for `/loops` command (`loopsCommandHandler`) |
| `Z_H` | Loop configuration loader (`loadLoopConfigs`) |
| `zkH` | Filesystem loop config reader (`loopFileReader`) |
| `Q6` | Config text parser (parses raw file bytes into object array) |
| `I7H` | Path helper / config path builder |
| `K4` | Base path resolver |
| `s1` | Utility: error code normaliser |
| `v8` | Utility: v8-level helper (used in error handling) |
| `kH` | Loop entry validator |
| `HA` | Error constructor wrapper |
| `eH` | String coercion helper |
| `Dq` | Essential-traffic filter |
| `qW4` | Queue shift/push helper (sliding window buffer) |
| `vA6` | Session map builder (`buildSessionMap`) |
| `j2H` | Session map setter |
| `MOq` | Session map mapper |
| `S6` | App-state utility / context initialiser |
| `GN` | Cron display formatter (`cronDisplayFormatter`) |
| `w` | Background session lifecycle manager |
| `l8` | Async timer/abort helper |
| `O` | Timer callback wrapper |
| `RH` | Feature-gate OK reporter |
| `P6` | Feature-gate result emitter |
| `hH` | Feature-gate SAD reporter |
| `vb8` | macOS memory check helper |
| `D6` | Dispatcher memory/resource guard |
| `zX6` | Pin config reader |
| `fT_` | Pin config path builder (`pins.json`) |
| `B6` | JSON.parse wrapper |
| `R8` | File-read result normaliser |
| `PBL` | Directory loop reader (reads all loop subdirs) |
| `g` | Background process lifecycle manager |
| `x` | clearInterval wrapper |
| `L4H` | Process output trim helper |
| `C` | Rate-limit enqueue helper |
| `Q` | Supervisor write/timeout helper |
| `j` | Process kill iterator |
| `VDA` | Daemon claim sender |
| `AMA` | Daemon session initialiser (mkdir + writeFile) |
| `D55` | Claim timeout / retry handler |
| `Y55` | Claim frame builder |
| `tf` | v8 type check helper |
| `EH` | String coercion wrapper |
| `zg` | Binary frame encoder (Buffer ops) |
| `hDA` | Background session state manager |
| `yK` | Session path builder |
| `e9` | Session state reader (stat + readFile) |
| `jY` | Active-state checker (`$N`) |
| `ff` | Session serialiser helper |
| `q16` | Session promise/date helper |
| `kMH` | Session path joiner (`HO.join`) |
| `VT` | Session split path helper |
| `Xg` | Session log path builder |
| `Vh6` | Session roster path builder |
| `Y` | Config/state updater (stop/start/updateConfig) |
| `D` | Forced shutdown handler (`process.exit`) |
| `IJ` | Shutdown label emitter |
| `z` | Daemon stop orchestrator |
| `F` | Dispose helper |
| `NKK` | Daemon status reporter |
| `nr` | Log entry writer (`L4H`) |
| `N9` | AsyncLocalStorage store getter |
| `JR6` | Daemon status file path builder (`daemon.status.json`) |
| `J` | Date reference holder for weekly schedule calc |
| `T_H` | Loop list renderer (`loopListRenderer`) |
| `se` | Set presence checker (`_.has`) |
| `brH` | Loop file writer (`loopFileWriter`) |
| `kA6` | Stop-hook manager (`stopHookManager`) |
| `SCq` | UUID generator wrapper (`kCq.randomUUID`) |
| `W6` | Context notify helper (`Nu6`) |
| `Nu6` | Low-level notify primitive |
| `Vhf` | Schedule precision calculator (`schedulePrecisionCalc`) |
| `xrH` | Loop creator (`loopCreator`) |
| `LEH` | Loop metadata builder |
| `M` | MCP server roster manager |
| `AbH` | MCP server connection handler |
| `bl` | MCP connection builder |
| `fk` | MCP transport factory |
| `__` | Underscore utility alias |
| `sk6` | MCP server slot helper |
| `skq` | MCP server start helper |
| `xY8` | MCP bY8/GP helper |
| `RY8` | MCP M4 helper |
| `O8` | MCP debug logger |
| `ts_` | MCP tool invocation handler |
| `es_` | MCP complete-auth handler |
| `Myq` | MCP async tool wrapper |
| `ss_` | MCP error formatter |
| `Lb_` | MCP include-filter |
| `FN` | MCP skill dispatcher (`D6`) |
| `I` | MCP chokidar watcher |
| `T7` | MCP error logger |
| `_yq` | MCP hB helper |
| `zA6` | MCP parseInt helper (slot index) |
| `RI8` | MCP parseInt helper (retry index) |
| `eU8` | MCP connection result applier |
| `_bH` | MCP VXH helper |
| `mk` | MCP cleanup orchestrator |
| `IYA` | MCP server sync/reconcile |
| `pY8` | MCP tool filter (tY7/fb_ sets) |
| `$A6` | MCP VXH initialiser |
| `IA6` | Loop deleter (`loopDeleter`) |
| `H6A` | Policy gate checker |
| `_B` | Policy settings reader (`policySettings`) |
| `x8` | Policy store accessor (`Pl6`, `Kd`) |
| `BD` | Policy store builder |
| `U_` | Trust gate helper |
| `Lf` | Config resolver (`wTL`) |
| `wTL` | Config path walker (`eH`, `qpH`, `Z9`, `y6`) |
| `s6` | Feature SAD reporter (context variant) |
| `TD` | Token count helper (`cmH`, `Object.values`) |
| `nI` | Schedule string parser (`scheduleParser`) |
| `FrL` | Cron field tokeniser (`cronFieldParser`) |
| `A` | Lowercase normaliser array |
| `L` | File watcher / set manager |
| `q` | Socket unlink set |
| `f` | Close/finally helper |
| `KE` | Feature gate wrapper |
| `uv` | Primitive utility (used by `KE`, `S6`) |
| `H` | Bootstrap fetch helper |
| `SH` | JSON.stringify wrapper |
| `J4` | Path/string slicer (`c2A`, `A.slice`) |
| `ppH` | C2A wrapper |
| `acK` | File content reader with byte-length check |
| `icK` | Content type resolver (`Vy`, `ncK`, `DXA`) |
| `v` | Context/message helper (shared symbol, multiple roles) |