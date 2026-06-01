---
type: feature-spec
feature: "loops"
cc_version: "2.1.143"
updated: "2026-06-01"
tags: ["loops", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.143 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/loops`

> Analysis basis: CC v2.1.143 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.143

---

## Overview

The `/loops` command provides a unified management interface for recurring **cron loops** and **stop-hooks** within Claude Code. It allows users to list currently registered loops and stop-hooks, create new cron-schedule loops, and delete existing ones. Internally the handler (`AN7`) reads current app state, parses schedule expressions, writes loop/hook configuration to disk, and reflects changes back into the running session's state.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `loops` |
| description | `List, create, and delete recurring loops and stop-hooks` |
| loc_byte | `11482307` |
| loc_byte_end | `11482489` |
| loc_line | `7075` |
| immediate | `true` |
| module_id | `YWq` |
| load_inline | `true` |
| arbor_handler.name | `AN7` |
| arbor_handler.fqn | `claude-2.1.143::AN7` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.143 bundle.js:+11482307

---

## Input Branching

The command input drives at least five distinct sub-operations (list, create-cron, create-stophook, delete-cron, delete-stophook), plus an implicit "no input / list" path — **Mermaid flowchart is required**.

```mermaid
flowchart TD
    START(["/loops [args]"]) --> PARSE[Parse raw input string\nvia scheduleParser / stopHookParser]
    PARSE --> NOARGS{Arguments\nprovided?}

    NOARGS -- No --> LIST[List all loops\nand stop-hooks]
    LIST --> RENDER[Render JSX table\nvia createElement]

    NOARGS -- Yes --> TYPECHECK{Sub-command\nkeyword}

    TYPECHECK -- "cron …" --> CRONPARSE[Parse cron schedule\nvia cronExpressionParser]
    CRONPARSE --> CRONVALID{Schedule\nvalid?}
    CRONVALID -- No --> ERR_CRON[Return error message\nto user]
    CRONVALID -- Yes --> CREATE_CRON[Generate UUID\nSet creation timestamp\nWrite loop config to .claude/\nUpdate app state\nEmit telemetry: tengu_loops_command]
    CREATE_CRON --> CONFIRM_CRON[Display confirmation]

    TYPECHECK -- "stophook …" --> STOPHOOK_ID{Stop-hook\nidentifier found?}
    STOPHOOK_ID -- Not found --> ERR_SH["Return 'Stop hook not found'"]
    STOPHOOK_ID -- "delete / clear" --> DELETE_SH[Remove stop-hook entry\nUpdate app state\nEmit telemetry: tengu_stop_hook_removed]
    DELETE_SH --> CONFIRM_SH_DEL["Display 'Stop hook cleared'"]
    STOPHOOK_ID -- "set / new" --> SET_SH[Persist stop-hook config\nEmit telemetry: tengu_stop_hook_added]
    SET_SH --> CONFIRM_SH_SET["Display 'Stop hook set'"]

    TYPECHECK -- "delete / remove loop" --> DEL_LOOP[Locate loop by id\nRemove from config file\nUpdate app state]
    DEL_LOOP --> CONFIRM_DEL[Display deletion confirmation]

    TYPECHECK -- Unrecognised --> SKIP[Return without action\n\"skip\" path]
```

Analysis basis: CC v2.1.143 bundle.js:+11481264 (handler entry), +11481394 (schedule parse branch), +11481447 (stophook branch), +11481550 (loop-listing branch)

---

## Behavioral Spec

### 1. Handler Entry (`AN7`)

The main async handler is `AN7` (Arbor-resolved, `AsyncFunction`, via `module_id` resolution).

```
async function loopsCommandHandler(context, args):
    emit telemetry("tengu_loops_command")          // +11481266
    appState = context.getAppState()               // +11481315
    rawInput = args.trim()

    if rawInput is empty:
        return renderLoopList(appState)            // → loopLister (Ct)

    subCommand, rest = parseSubCommand(rawInput)

    switch subCommand:
        case "cron":
            result = createCronLoop(rest, appState)
        case "stophook":
            result = manageStopHook(rest, appState, context)
        case "delete":
            result = deleteCronLoop(rest, appState)
        default:
            return skipAction()                    // literal "skip" +11482173

    applyStateUpdate(context, result)
    return renderResult(result)                    // JSX via createElement +11482067
```

Analysis basis: CC v2.1.143 bundle.js:+11481264, +11481315, +11482173, +11482067

---

### 2. Loop Listing (`Ct` — loopLister)

```
function listLoops(appState):
    existingLoops = readLoopConfigFile(appState)   // → fileReader (vTH)
    filterActiveLoops(existingLoops)               // +4699568 (q.filter)
    stopHooks = appState.stopHooks                 // checked via A.has +4699583
    return buildTableRows(existingLoops, stopHooks)
```

Analysis basis: CC v2.1.143 bundle.js:+11481550, +4699510, +4699559

---

### 3. Loop Config File Reader (`vTH` — loopConfigFileReader)

```
async function loopConfigFileReader(configPath):
    resolvedPath = resolvePath(configPath)         // E1H + FK → GV +4697784
    raw = fs.readFile(resolvedPath, "utf-8")       // +4697853; encoding literal +4697881
    if error.code in ["ENOENT","EACCES","EPERM","ENOTDIR","ELOOP"]:  // +172343–172399
        return emptyConfig()
    parsed = parseJsonOrThrow(raw)                 // C9 → L8 +4697903
    if not Array.isArray(parsed):                  // +4697997
        return emptyConfig()
    validated = parsed.map(validateEntry)          // v +4698176
    return validated
```

Analysis basis: CC v2.1.143 bundle.js:+4697834, +4697853, +4697881, +4697997

---

### 4. Cron Schedule Parser (`HZ` — cronExpressionParser)

Parses a human-readable or numeric cron expression into a structured schedule object.

```
function cronExpressionParser(scheduleString):
    trimmed = scheduleString.trim()                // +4695625

    // Numeric cron fields
    if trimmed matches numeric pattern:
        fields = parseInt(trimmed, ...)            // +4695801
        validate fields:
            minutes: 0–59   (literal 59 +11481031, 60 +11480997)
            hours:   0–23   (literal 23 +11481102)
            days:    1–31   (literal 31 +11481155)
        return {type:"cron", fields}

    // Named shortcuts
    if trimmed matches "Every minute":             // literal +4695745
        return {type:"cron", preset:"every_minute"}
    if trimmed matches "Every hour":               // literal +4695962
        return {type:"cron", preset:"every_hour"}

    // Day-of-week pattern ("1-5" style)           // literal "1-5" +4696669
    dayMatch = trimmed.match(dowPattern)           // +4696036
    if dayMatch:
        dowDate = computeNextDayOfWeek(...)        // j.getUTCDay +4696502
        adjusted = j.setUTCDate / j.getUTCDate / j.setUTCHours  // +4696521,+4696534,+4696552
        return {type:"cron", dow:dayMatch, nextRun:adjusted}

    return null  // invalid
```

Schedule field validation limits:
- Minutes: max **59** (bundle.js:+11481031)
- Hours: max **23** (bundle.js:+11481102)
- Days: max **31** (bundle.js:+11481155)
- Max parse iterations: **60** (bundle.js:+11480997), ceiling/rounding helpers applied (Math.max +11480974, Math.ceil +11480985, Math.round +11481058)

Analysis basis: CC v2.1.143 bundle.js:+4695625, +4695745, +4695801, +4695962, +4696502

---

### 5. Stop-Hook Parser (`SI` — stopHookLineParser)

```
function stopHookLineParser(inputLine):
    trimmed = inputLine.trim()                     // +4694454
    parts = O_4(trimmed)                           // scheduleFieldSplitter +4694540

    // scheduleFieldSplitter (O_4):
    //   splits on whitespace                      // H.split +4693874
    //   regex match per token                     // L.match +4693894
    //   parseInt with base 10                     // +4693939
    //   adds token to accumulator Set K.add       // +4694000
    //   max tokens: 5                             // literal 5 +4694490
    //   base interval minimum: 10                 // literal 10 +4693953
    //   day constants: 3 (Wed), 6 (Sat), 7 (Sun) // +4694115, +4694151, +4694157

    result.push(parts)                             // A.push +4694575
    return result
```

Analysis basis: CC v2.1.143 bundle.js:+4694454, +4694540, +4693874, +4694490

---

### 6. Create Cron Loop (`VFH` — cronLoopCreator)

```
async function cronLoopCreator(scheduleExpr, appState, context):
    uuid = crypto.randomUUID()                     // $n9.randomUUID +4699181
    timestamp = Date.now()                         // +4699243
    loopEntry = buildLoopEntry(uuid, scheduleExpr, timestamp)  // pjH +4699289
    existingLoops = await loopConfigFileReader(...)// vTH +4699333
    existingLoops.push(loopEntry)                  // M.push +4699346
    await writeLoopConfig(existingLoops)           // ZFH +4699440
    notifyAppState(context)                        // V6 +4699378
    applyHookNotification(context)                 // ha +4699427
    return loopEntry
```

Analysis basis: CC v2.1.143 bundle.js:+4699181, +4699243, +4699333, +4699440

---

### 7. Loop Config Writer (`ZFH` — loopConfigFileWriter)

```
async function loopConfigFileWriter(loopArray, configDir):
    resolvedDir = path.join(configDir, ".claude") // literal ".claude" +4699022
    await fs.mkdir(resolvedDir, {recursive:true})  // BH8.mkdir +4699001
    filePath = path.join(resolvedDir, filename)    // FH8.join +4699011
    serialised = loopArray.map(serializeEntry)     // H.map +4699062
    await fs.writeFile(filePath, serialised)       // BH8.writeFile +4699098
    hash = computeFileHash(filePath)               // E1H +4699112
    serialisedStr = JSON.stringify(serialised)     // hH +4699119
```

Analysis basis: CC v2.1.143 bundle.js:+4699001, +4699011, +4699022, +4699098

---

### 8. Stop-Hook Set (`QiH` — stopHookSetter)

```
async function stopHookSetter(hookSpec, context):
    // Gate checks
    hooksGate = checkFeatureGate("hooks_gate")     // literal +9108599
    trustGate  = checkFeatureGate("trust_gate")    // literal +9108653
    goalSet    = checkFeatureGate("goal_set")      // literal +9108731

    if not goalSet:
        showPolicySettings()                       // I8 → "policySettings" +5388645

    current = context.getAppState()                // +9108788
    timestamp = Date.now()                         // +9108952

    // Compute output-token budget (tj)
    tokenBudget = computeOutputTokenBudget()       // tj +9108977; "outputTokens" +41769

    context.setAppState(newState)                  // +9108990
    context.applyMessageOp({type:"append",...})    // +9109032; literal "append" +9109423
    uuid = crypto.randomUUID()                     // Go1 → Po1.randomUUID +9109547
    attachMsg = {type:"attachment", role:"goal"}   // literals +9109529, +9109488, +9109616

    emit telemetry("tengu_stop_hook_added")        // +9109089
    displayMessage("Stop hook set")                // literal +11482024

    return hookEntry
```

Analysis basis: CC v2.1.143 bundle.js:+9108599, +9108703, +9108788, +9108990, +9109089

---

### 9. Stop-Hook Delete (`diH` — stopHookDeleter)

```
async function stopHookDeleter(hookId, context):
    current = context.getAppState()                // +9109202
    hookIndex = findStopHookById(hookId)           // giH +9109198

    if hookIndex === -1:
        displayMessage("Stop hook not found")      // literal +11481706
        return

    context.setAppState(removeHook(current, hookIndex))  // +9109331
    context.applyMessageOp({type:"append",...})    // +9109400
    uuid = crypto.randomUUID()                     // Go1 +9109442

    emit telemetry("tengu_stop_hook_removed")      // +9109457
    displayMessage("Stop hook cleared")            // literal +11481728
```

Analysis basis: CC v2.1.143 bundle.js:+11481688, +11481706, +11481728, +9109457

---

### 10. Loop Table Renderer (`giH` / `KDH` / `pm1`)

```
function buildLoopTableDisplay(loops):
    for each loop in loops:
        row = KDH.set(loop.id, formatRow(loop))    // KDH +8384731
        paddedRow = loop.id.padEnd(width, "  ")    // literal "  " +14526202; width 40 +14528173
        mappedCols = pm1.mapColumns(row)           // pm1 → H.map +8384500

    push rendered rows                             // A.push +9108527
    return tableComponent
```

Analysis basis: CC v2.1.143 bundle.js:+9108403, +8384731, +14526202, +14528173

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_loops_command` | Fired once at handler entry (bundle.js:+11481266) |
| Telemetry: `tengu_stop_hook_added` | Fired when a new stop-hook is successfully persisted (bundle.js:+9109089) |
| Telemetry: `tengu_stop_hook_removed` | Fired when an existing stop-hook is cleared (bundle.js:+9109457) |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Fired from background-worker kill escalation path reachable via process management (bundle.js:+14503217) |
| Telemetry: `tengu_daemon_control` | Fired from daemon-stop path (bundle.js:+14538273) |
| Telemetry: `tengu_feature_ok` / `tengu_feature_bad` / `tengu_feature_sad` | Feature-gate outcome events (bundle.js:+955068, +955126, +955201) |
| Telemetry: `tengu_bg_low_mem_mb` | Low-memory detection in background dispatch (bundle.js:+11972252) |
| Telemetry: `tengu_bg_dispatch_low_mem` | Fired when background dispatch is inhibited by low memory (bundle.js:+14503796) |
| Telemetry: `tengu_daemon_idle_exit` | Daemon idle-exit event (bundle.js:+14522118) |
| Telemetry: `tengu_bg_spare_enable` | Spare background worker enabled (bundle.js:+14504411) |
| Telemetry: `tengu_bg_sendclaim_failed` | Claim-send failure in background worker (bundle.js:+14485198) |
| Telemetry: `tengu_bg_spare_claim` | Spare worker claim attempt (bundle.js:+14504532) |
| Telemetry: `tengu_bg_spare_spawn` | Spare worker spawned (bundle.js:+14502994) |
| Telemetry: `tengu_bg_spare_claim_fail` | Spare worker claim failure (bundle.js:+14504795) |
| Telemetry: `tengu_daemon_yield` | Daemon yields to foreground session (bundle.js:+14521203) |
| Disk writes | Loop config written to `.claude/` directory (bundle.js:+4699022); stop-hook config via `writeFile` (bundle.js:+12417574) |
| App state mutations | `setAppState`, `applyMessageOp` called on create/delete (bundle.js:+9108990, +9109331, +9109400) |
| Hook registration | Stop-hook entries added to/removed from the session's stop-hook roster (bundle.js:+9109022) |
| UUID generation | Each new loop and stop-hook receives a UUID via `crypto.randomUUID` (bundle.js:+4699181, +9109547) |
| JSX rendering | Output rendered via `createElement` (bundle.js:+11482067) |
| Feature gates checked | `hooks_gate`, `trust_gate`, `goal_set` evaluated before stop-hook operations (bundle.js:+9108599, +9108653, +9108731) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.143 | Initial analysis |

---

## Common Mistakes

1. **Omitting the sub-command keyword**: Invoking `/loops` without `cron`, `stophook`, or `delete` will only list current loops; no creation or deletion occurs.
2. **Invalid cron field ranges**: Minutes must be ≤ 59, hours ≤ 23, days ≤ 31 (bundle.js:+11481031, +11481102, +11481155). Out-of-range values cause the parser to reject the schedule silently.
3. **Stop-hook set without goal gate active**: If the `goal_set` feature gate is off, the policy-settings prompt is shown instead of saving; users may believe the hook was saved when it was not.
4. **Expecting immediate execution**: Cron loops are scheduled recurrences — the loop does not fire immediately upon creation; it fires on the next matching schedule tick.
5. **Deleting by name instead of ID**: The delete path identifies loops and stop-hooks by UUID, not by display name. Passing a display string will match "Stop hook not found" (bundle.js:+11481706).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `AN7` | Main async handler for `/loops` command |
| `d` | Low-level utility / logger helper |
| `bt` | Pre-flight setup: reads config and resolves module environment |
| `vTH` | Loop config file reader (reads and validates JSON array from disk) |
| `x6` | Path resolution helper |
| `E1H` | File-hash / config-path builder |
| `FK` | Base directory resolver (calls `GV`) |
| `C9` | JSON parse wrapper |
| `L8` | Structured error / result wrapper |
| `NH` | Network/IPC message dispatcher |
| `v_` | Error normaliser |
| `xH` | String converter utility |
| `zq` | Traffic-class tagger ("essential-traffic") |
| `kNK` | Rolling FIFO queue manager |
| `v` | Message validator / normaliser |
| `G5K` | Message-type classifier |
| `H` | Global state / random-delay helper |
| `hH` | JSON serialiser wrapper |
| `P7` | Prompt-text formatter / redactor |
| `cSH` | Content-sanitisation helper |
| `Z5K` | File-size / buffer writer |
| `SI` | Multi-line stop-hook text parser |
| `O_4` | Schedule field tokeniser (splits, regex-matches, parseInt) |
| `A` | General array accumulator |
| `L` | Promise/stream wrapper with cleanup |
| `q` | Cleanup set / temp-file tracker |
| `f` | Resource handle with finally-cleanup |
| `ME` | Module environment initialiser |
| `GV` | Base-path / home-dir provider |
| `giH` | Stop-hook lookup / loop table builder |
| `KDH` | Loop row formatter (pads IDs) |
| `K` | Map/column formatter |
| `pm1` | Column mapper (H.map) |
| `V6` | App-state notifier / event emitter |
| `HZ` | Cron expression parser |
| `w` | Background worker / process manager |
| `C` | Worker-process kill helper |
| `Z_K` | Real-path + stat resolver |
| `MK5` | Worker metadata builder |
| `z` | Daemon control IPC writer |
| `mH` | Feature-bad event emitter |
| `SH` | Feature-ok event emitter |
| `IG6` | Low-memory probe (macOS, 1024 MB threshold) |
| `G6` | Background dispatch gate (checks mem + dedup set) |
| `x` | Retire-if-settled promise tracker |
| `h` | Sub-task handle |
| `m` | Timer unref helper |
| `Oo_` | Spare-worker claim sender (IPC connect + write) |
| `Gd_` | Worker roster entry writer (mkdir + writeFile JSON) |
| `uq5` | Claim timeout handler (5000 ms, +14485619) |
| `xq5` | Claim frame builder |
| `XH` | String coercion wrapper |
| `mp` | Binary frame serialiser (Buffer.from, writeUInt32BE) |
| `jo_` | Worker job orchestrator (spawn, track, retire) |
| `IK` | Worker ID path builder |
| `s1` | Worker state reader (stat + readFile + cache) |
| `rw` | Active-state filter |
| `Bf` | Work-descriptor serialiser (path.join + hH) |
| `SoH` | Async session hook caller |
| `wLH` | Worker log-path builder |
| `Bk` | Worker exit-code reader |
| `gp` | Worker goal-path builder |
| `zW6` | Worker directory initialiser (mkdir + Ex_) |
| `D` | Daemon lifecycle manager (spawn / retire spare) |
| `$` | Disposable resource tracker |
| `$o_` | Spare worker spawner (Bun.spawn, --bg-spare flag) |
| `J` | Worker-set iterator / kill helper |
| `y` | Worker IPC kill sender |
| `j` | UTC date calculator |
| `Ct` | Loop-listing orchestrator (reads config + filters) |
| `Wo` | Map-has membership checker |
| `ZFH` | Loop config file writer (.claude/ directory) |
| `diH` | Stop-hook deleter |
| `Go1` | UUID generator wrapper |
| `_N7` | Schedule expression field normaliser (Math.max/ceil/round) |
| `VFH` | Cron loop creator (UUID, timestamp, write, notify) |
| `pjH` | Loop entry builder |
| `M` | MCP server manager |
| `SvH` | MCP server connection handler |
| `KHH` | MCP capability merger |
| `rI` | MCP route resolver |
| `H_` | Hook/filter wrapper |
| `f26` | Filter predicate helper |
| `_57` | MCP timestamp updater |
| `v78` | MCP capability key enumerator |
| `I78` | MCP data converter |
| `A8` | MCP debug logger push |
| `Yh_` | MCP OAuth flow initiator |
| `Dh_` | MCP OAuth callback handler |
| `x8q` | MCP result resolver |
| `Oh_` | MCP error handler |
| `NG_` | MCP include-list checker |
| `_7` | MCP error logger |
| `S8q` | MCP yield handler |
| `M26` | MCP integer parser (parseInt) |
| `xh_` | MCP secondary integer parser |
| `THK` | MCP update applier |
| `eY8` | MCP serialisation helper |
| `wv` | MCP cleanup orchestrator |
| `B95` | MCP client reconciler (filter + connect) |
| `k78` | MCP filter set checker |
| `r8` | Retryable timeout wrapper |
| `drH` | MCP debug serialiser |
| `ha` | Hook notification dispatcher |
| `lfH` | Hook notification formatter |
| `Z_H` | Slice/format helper |
| `QiH` | Stop-hook setter (gate checks, state mutation, telemetry) |
| `Yk_` | Gate evaluation orchestrator |
| `bm` | Policy-settings gate reader |
| `I8` | Policy-settings key resolver |
| `aY` | Gate secondary resolver |
| `E_` | Gate error handler |
| `L7` | Gate result formatter |
| `QhL` | Gate pipe/stream reader |
| `J8` | Feature-sad event emitter |
| `tj` | Output-token budget calculator |