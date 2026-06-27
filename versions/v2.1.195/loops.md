---
type: feature-spec
feature: "loops"
cc_version: "2.1.195"
updated: "2026-06-27"
tags: ["loops", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.195 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/loops`

> Analysis basis: CC v2.1.195 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.195

---

## Overview

The `/loops` command provides a management interface for **scheduled loops** (recurring automated tasks) within Claude Code. It allows users to list existing loops, create new loops with cron-style or human-readable schedules, and delete loops. The command renders a JSX-based interactive UI and dispatches operations including stop-hook management, cron schedule parsing, and loop file persistence.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `loops` |
| description | `List, create, and delete loops` |
| loc_byte | `12815205` |
| loc_byte_end | `12815362` |
| loc_line | `8797` |
| immediate | `true` |
| module_id | `Yzl` |
| load_inline | `true` |
| arbor_handler.name | `Rjf` |
| arbor_handler.fqn | `claude-2.1.195::Rjf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.195 bundle.js:+12815205

---

## Input Branching

The handler processes several distinct operation modes depending on the user's subcommand input, parsed schedule strings, and existing loop/stop-hook state. There are more than three distinct branches.

```mermaid
flowchart TD
    A["/loops invoked"] --> B[Emit tengu_loops_command telemetry]
    B --> C[Read existing loops via loopFileReader]
    C --> D[Parse cron/schedule via cronScheduleParser]
    D --> E{User subcommand?}

    E -->|list / no args| F[Map and render loop list as JSX]
    E -->|create| G[Parse schedule string]
    G --> G1{Schedule type?}
    G1 -->|cron expression| G2[validateCronFields: minutes 0-59, hours 0-23, days 0-31]
    G1 -->|"Every minute" / "Every hour"| G3[Map human-readable to cron fields]
    G2 --> G4[createLoopRecord: generate UUID, timestamp, write to .claude dir]
    G3 --> G4
    G4 --> G5[Attach stop hook via stopHookAdder]
    G5 --> G6[Emit tengu_stop_hook_added]
    G6 --> H[Render updated JSX loop list]

    E -->|delete| I{Stop hook present?}
    I -->|hook found| J[Remove stop hook via stopHookRemover]
    J --> J1[Emit tengu_stop_hook_removed]
    J1 --> K[Delete loop file via loopFileDeleter]
    I -->|hook not found| L[Display 'Stop hook not found' message]
    L --> M[Emit 'Stop hook cleared' confirmation]

    E -->|stophook subcommand| N[setAppState / applyMessageOp for stop hook]
    N --> O[Render result with goal_status / attachment message type]

    H --> Z[Return JSX component via Jzl.jsx]
    F --> Z
    K --> Z
    O --> Z
```

Analysis basis: CC v2.1.195 bundle.js:+12814170 – +12815039

---

## Behavioral Spec

### Handler Entry Point

The primary handler is the async function `Rjf` (resolved via `module_id → Yzl`, Arbor `resolution_path: module_id`).

```
async function loopsCommandHandler(context):
    emit telemetry("tengu_loops_command")           // +12814172
    loops = await readAllLoops(context)             // Nue → bct
    cronData = buildCronTable(context)              // cEt → JPe, Zll
    appState = context.getAppState()                // +12814222
    renderedList = loops.map(renderLoopItem)        // +12814250
    parsedSchedule = parseLoopScheduleInput(input)  // iO
    filteredLoops = filterLoopsByState(loops)       // Oue
    // branch on subcommand:
    if subcommand == "create":
        newLoop = createLoop(parsedSchedule, context) // Tct
    elif subcommand == "delete":
        result = deleteLoop(loopId, context)          // dEt or uEt
    // render and return JSX component
    return Jzl.jsx(LoopsComponent, { loops, ... })  // +12814975
```

Analysis basis: CC v2.1.195 bundle.js:+12814170

---

### Loop File Reader (`Nue` → `bct`)

Reads the loop configuration files from the `.claude` directory on disk.

```
async function readAllLoops(context):
    dir = pathJoin(configDir, ".claude")             // oEe → G1n.join
    raw = await fs.readFile(loopFilePath, "utf-8")   // bct → t.readFile, "utf-8" literal +5065747
    if error.code in ["ENOENT","EACCES","EPERM","ENOTDIR","ELOOP","ENAMETOOLONG","EROFS"]:
        return []                                    // qo → on, xe → Zr
    parsed = JSON.parse(raw)
    if not Array.isArray(parsed):                    // +5065863
        parsed = normalize(parsed)                   // T, VN
    return parsed
```

Analysis basis: CC v2.1.195 bundle.js:+5067708

---

### Cron Schedule Parser (`iO`)

Parses user-supplied schedule strings into structured cron fields.

```
function parseLoopScheduleInput(inputStr):
    trimmed = inputStr.trim()                        // +5063491
    if trimmed.match(/every minute/i):               // +5063632
        return { label: "Every minute", ... }        // literal +5063611
    if trimmed.match(/every hour/i):
        return { label: "Every hour", ... }          // literal +5063828
    // parse numeric cron parts
    parts = trimmed.match(cronRegex)                 // +5063902
    minutes = parseInt(parts[0])                     // +5063667
    // validate ranges:
    //   minutes: 0–59  (literal 59 at +12813937)
    //   hours:   0–23  (literal 23 at +12814008)
    //   days:    0–31  (literal 31 at +12814061)
    day = computeUTCDay(date)                        // g.getUTCDay +5064368
    date.setUTCDate(...)                             // +5064387
    date.setUTCHours(...)                            // +5064418
    scheduleRange = "1-5"                            // literal +5064535
    return CronScheduleObject
```

Analysis basis: CC v2.1.195 bundle.js:+5063491

---

### Cron Validation Helper (`xjf`)

Validates and normalises raw cron field strings before loop creation.

```
function validateAndNormaliseCron(expression):
    matched = expression.match(cronPattern)          // +12813758
    value = parseInt(matched[1])                     // +12813795
    // clamp to valid field ranges
    minutes = Math.max(0, Math.ceil(value / 60))     // +12813880, +12813891, literal 60 +12813903
    rounded = Math.round(value)                      // +12813964
    weekdays = parseWeekdaySet(expression)           // VN → hop
    return normalisedCronFields
```

Weekday parsing (`hop`) splits the expression, applies `parseInt`, collects results into a `Set` via `o.add`, and finally calls `Array.from` to serialise — supporting ranges and individual day numbers. Limit: maximum 10 entries per weekday field (literal `10` at +5061819).

Analysis basis: CC v2.1.195 bundle.js:+12813758

---

### Loop Creator (`Tct`)

Creates a new loop record and persists it.

```
async function createLoop(schedule, context):
    id = crypto.randomUUID()                         // Qra.randomUUID +5067047
    createdAt = Date.now()                           // +5067109
    loopRecord = buildLoopRecord(id, schedule)       // Dge +5067155
    existing = await readAllLoops(context)           // bct +5067199
    existing.push(loopRecord)                        // +5067212
    ensureDir(".claude")                             // UBt → B1n.mkdir, literal ".claude" +5066888
    await fs.writeFile(loopFilePath, ...)            // UBt → B1n.writeFile +5066964
    timestamp = Date.now()                           // Tct +5067109
    attachStopHook(context, id)                      // Hte +5067293
    return loopRecord
```

After creation the stop-hook record is attached and the `tengu_stop_hook_added` event is emitted.

Analysis basis: CC v2.1.195 bundle.js:+5067047

---

### Loop Filter (`Oue`)

Filters the full loops list against the current session/state.

```
function filterLoopsByState(allLoops, stateSet):
    stateSet = buildStateSet()                       // kz → t.has +59497
    existing = readAllLoops(context)                 // bct +5067427
    filtered = allLoops.filter(loop =>
        not stateSet.has(loop.id)                    // n.has +5067451
    )
    persist(filtered)                                // UBt +5067500
    return filtered
```

Analysis basis: CC v2.1.195 bundle.js:+5067378

---

### Stop-Hook Adder (`uEt`)

Attaches a stop hook to a new loop, updating app state.

```
async function addStopHook(context, loopRecord):
    gateway = resolveGateway()                       // xDo → U3, _ce
    trustGate = checkTrustGate()                     // literal "trust_gate" +10924134
    hooksGate = checkHooksGate()                     // literal "hooks_gate" +10924080
    currentState = context.getAppState()             // +10924269
    timestamp = Date.now()                           // +10924433
    goalStatus = computeGoalStatus()                 // Wy +10924458
    context.setAppState(updatedState)               // +10924471
    context.applyMessageOp({
        type: "append",                              // literal +10924908
        kind: "attachment",                          // literal +10925018
        goalStatus,                                  // literal "goal_status" +10925105
    })                                               // +10924513
    messageId = Dwl()                                // Rwl.randomUUID +10925036
    emit(W, ...)                                     // +10924568
    emit telemetry("tengu_stop_hook_added")          // +10924570
    je(hookRecord)                                   // → OJe +3779
    return Le(context)                               // +10924634
```

Analysis basis: CC v2.1.195 bundle.js:+10924184

---

### Stop-Hook Remover (`dEt`)

Removes a stop hook from an existing loop.

```
async function removeStopHook(context, loopId):
    currentState = context.getAppState()             // +10924687
    hookRecord = findHookForLoop(loopId)
    if not hookRecord:
        display("Stop hook not found")               // literal +12814614
        return
    display("Stop hook cleared")                     // literal +12814636
    context.setAppState(updatedState)                // +10924816
    context.applyMessageOp({
        type: "append",
        kind: "goal",                                // literal +10924976
    })                                               // +10924885
    messageId = Dwl()                                // Rwl.randomUUID +10925036
    emit(W, ...)                                     // +10924940
    emit telemetry("tengu_stop_hook_removed")        // +10924942
```

After removal the user sees a "Stop hook cleared" confirmation and the record is removed from the persisted loop store.

Analysis basis: CC v2.1.195 bundle.js:+10924676

---

### Loop List Builder (`cEt` → `JPe`, `Zll`)

Builds a formatted table of loops for display in the JSX UI.

```
function buildLoopDisplayTable(loops):
    table = new Map()
    for loop in loops:
        padded = loop.name.padEnd(colWidth, " ")     // i.padEnd, literal "  " +17913496
        row = formatLoopRow(loop)                    // Zll → e.map +9400776
        table.set(loop.id, row)                      // JPe → o.set +9401007
    push to display list                             // n.push +10924007
    return table
```

Analysis basis: CC v2.1.195 bundle.js:+10923883

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_loops_command` (emitted on every invocation, +12814172) |
| Telemetry — stop hook add | `tengu_stop_hook_added` (+10924570) |
| Telemetry — stop hook remove | `tengu_stop_hook_removed` (+10924942) |
| Telemetry — daemon (indirect) | `tengu_daemon_yield` (+17906757), `tengu_daemon_control` (+17924594) |
| Telemetry — background workers | `tengu_bg_retire_pinned_low_mem`, `tengu_bg_prewarm_per_sweep`, `tengu_bg_dispatch_sigkill_escalate`, `tengu_bg_dispatch_low_mem`, `tengu_bg_spare_enable`, `tengu_bg_spare_claim`, `tengu_bg_spare_claim_fail` |
| Telemetry — feature flags | `tengu_feature_ok` (+1027363), `tengu_feature_bad` (+1027430), `tengu_feature_sad` (+1027511) |
| File I/O | Reads and writes loop records under the `.claude` directory; creates directory if absent (`B1n.mkdir`); writes files with `B1n.writeFile`; deletes with `iie.unlink` |
| appState changes | `setAppState` and `applyMessageOp` called on both create (hook add) and delete (hook remove) paths |
| Stop hook | Registered (`stophook` literal +12814354) on loop create; cleared on loop delete with confirmation messages |
| Subcommand literal | `"cron"` (+12814268) used internally to identify schedule type |
| UUID generation | `Qra.randomUUID` (loop records) and `Rwl.randomUUID` (message IDs) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |
| JSX rendering | Final output rendered via `Jzl.jsx` (+12814975); `"skip"` literal (+12815071) used for conditional rendering logic |

---

## Version History

| Version | Change |
|---|---|
| v2.1.195 | Initial analysis |

---

## Common Mistakes

1. **Providing an invalid cron range**: Minutes must be 0–59, hours 0–23, day-of-month 0–31. Values outside these ranges are clamped or rejected by `validateAndNormaliseCron`. Analysis basis: CC v2.1.195 bundle.js:+12813937, +12814008, +12814061.
2. **Expecting synchronous file operations**: Both loop creation and deletion are async (`Rjf` is an `AsyncFunction`). Callers must `await` the handler or handle the returned promise.
3. **Deleting a loop whose stop hook was already cleared**: The handler detects the missing hook and emits "Stop hook not found" rather than throwing. The deletion may still proceed but the hook-removal telemetry path is not triggered.
4. **Assuming the `.claude` directory exists**: The creator always calls `mkdir` before writing; do not rely on a pre-existing directory structure when testing.
5. **Confusing `"cron"` with `"stophook"` subcommands**: These are separate internal operation keys. Sending `stophook` directly routes to the `setAppState`/`applyMessageOp` path, not the loop creation path.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Rjf` | Main async handler for `/loops` command |
| `W` | Generic event emitter / notification helper |
| `Nue` | Loops loader — orchestrates `bct` and `TC` |
| `bct` | Loop file reader — reads, parses, validates loop JSON from disk |
| `qt` | Filesystem path resolver used inside loop file reader |
| `oEe` | Config directory path builder (joins `G1n`) |
| `rc` | Base path resolver (calls `u0`) |
| `qo` | Error-code classifier (calls `on`) |
| `on` | Underlying error code lookup |
| `xe` | Error handler / log flusher (uses `Zr`, `ut`, `qi`, `BMu`, `GZe`, `Gee`) |
| `Zr` | Error normaliser (wraps `Error`, `String`) |
| `ut` | String coercion utility |
| `qi` | Essential-traffic queue manager (calls `rSs`) |
| `BMu` | FIFO queue manager (`Tpn.shift`, `Tpn.push`) |
| `T` | Tool/message formatter (uses `AFe`, `RYc`, `Me`, `Lc`, `jXe`, `PYc`) |
| `RYc` | Message record builder (`w1`, `eAr`, `Drs`) |
| `Me` | JSON serialiser wrapper (`JSON.stringify`) |
| `Lc` | Path/string sanitiser (`_is`, `e.replace`, `r.at`, `n.lastIndexOf`, `n.slice`) |
| `jXe` | Auxiliary formatter (calls `ais`) |
| `PYc` | File upload / content chunker (`_Xe`, `Qge`, `Buffer.byteLength`, `iAr`, `DYc.bind`) |
| `VN` | Weekday/schedule string normaliser (calls `hop`) |
| `hop` | Weekday set parser (`e.split`, `s.match`, `parseInt`, `o.add`, `Array.from`) |
| `TC` | Secondary config loader (calls `u0`) |
| `u0` | Base utility / config accessor |
| `cEt` | Loop display table builder (calls `JPe`, `Zll`) |
| `JPe` | Table row setter (`o.set`, `Zll`) |
| `Zll` | Row formatter (`e.map`) |
| `Rt` | Logger / result reporter (calls `u0`) |
| `iO` | Cron schedule input parser (`e.trim`, `o.match`, `parseInt`, `f.toString`, date UTC methods) |
| `o8` | Path normaliser (`U1.normalize`, `Vt`, `t.replaceAll`, windows path handling) |
| `thr` | String prefix/slice helper (`t.startsWith`, `t.slice`, `r.replace`) |
| `k` | Loop execution scheduler (uses `clearInterval`, `setInterval`, `$7o`, `Wtn`, `P.watch`, `I.on`, `h.clear`) |
| `$7o` | Scheduled task runner (writes/unlinks loop files, calls `T`, `Me`, `YR`, `EI`) |
| `Wtn` | Scheduled task remover (`iie.unlink`, `kDc`, `Btn`, `T`) |
| `D` | Output writer (`d.write`, emits `W`) |
| `P` | Background worker sweep manager (`X.shiftGraceClocksForward`, `X.respawnIfIdleStale`, `X.retireIfSettled`, `ne.retireIfSettled`) |
| `I` | Input/keyboard event handler (`Math.max`, `Math.floor`, `M.preventDefault`) |
| `h` | Background worker pool manager (spawn, kill, memory checks, `BK.spawn`, `V.kill`) |
| `p` | Abort/exit handler (`YT`, `process.exit`, `u.abort`) |
| `u` | Daemon lifecycle controller (`Le`, `ke`, `SF`, `yj`) |
| `Le` | Feature-ok signal emitter (calls `W`, `Oe`; `tengu_feature_ok`) |
| `ke` | Feature-bad signal emitter (calls `W`, `Oe`; `tengu_feature_bad`) |
| `SF` | First-party policy settings handler (`p6`, `vY.push`, `y4e`, `GKr`) |
| `yj` | Async race/shutdown coordinator (`Promise.race`, `Promise.all`, `T_e`, `k_e`, `Un`) |
| `LZl` | Daemon status file reader (`Hte`, `Date.now`, `Vs`, `WXt`, `Me`) |
| `Hte` | Timestamp helper (calls `THe`) |
| `Vs` | AsyncLocalStorage store accessor (`Nld.getStore`) |
| `WXt` | Status file path builder (`wZl.join`, `tr`; `"daemon.status.json"` literal) |
| `Oue` | Loop list filter (uses `kz`, `bct`, `r.filter`, `n.has`, `UBt`) |
| `kz` | State-set membership checker (`t.has`) |
| `UBt` | Loop directory/file writer (`rc`, `B1n.mkdir`, `G1n.join`, `B1n.writeFile`, `oEe`, `Me`) |
| `dEt` | Stop-hook remover handler (`Rt`, `cEt`, `getAppState`, `setAppState`, `applyMessageOp`, `Dwl`, `W`, `je`) |
| `Dwl` | Message-ID generator (`Rwl.randomUUID`) |
| `je` | Hook record registrar (calls `OJe`) |
| `OJe` | Core hook registry |
| `xjf` | Cron expression validator and normaliser (`e.match`, `parseInt`, `Math.max`, `Math.ceil`, `Math.round`, `VN`) |
| `Tct` | Loop creator (`Qra.randomUUID`, `Date.now`, `Dge`, `bct`, `Rt`, `Hte`, `UBt`) |
| `Dge` | Loop record struct builder |
| `age` | Response serialiser (`JSON.stringify`) |
| `uEt` | Stop-hook adder handler (`xDo`, `wt`, `Rt`, `cEt`, `getAppState`, `setAppState`, `applyMessageOp`, `Dwl`, `W`, `je`, `Le`) |
| `xDo` | Gateway/trust resolver (`U3`, `_ce`, `wr`, `ad`) |
| `U3` | Policy settings resolver (calls `Hn`) |
| `Hn` | Config reader (`gmn`, `p3`) |
| `_ce` | Secondary policy resolver (calls `Hn`, `Go`) |
| `ad` | Hook schema validator (calls `Ssm`) |
| `Ssm` | Hook definition parser (`ut`, `mXe`, `Xs`, `Mt`, `Rme`, `o8`, `Ot`, `bE.resolve`) |
| `wt` | Feature-sad signal emitter (calls `W`, `Oe`; `tengu_feature_sad`) |
| `Oe` | Base event dispatcher (calls `OJe`) |
| `Wy` | Goal-status computer (`nXe`, `Object.values`) |

---

*Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.*