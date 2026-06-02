---
type: feature-spec
feature: "loops"
cc_version: "2.1.152"
updated: "2026-06-01"
tags: ["loops", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.152 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/loops`

> Analysis basis: CC v2.1.152 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.152

---

## Overview

`/loops` is the management interface for Claude Code's recurring automation system. It lets the user list currently active loops (cron-scheduled tasks), create new loops with a natural-language schedule and prompt, delete existing loops by index, and inspect or clear stop-hooks that fire at the end of each agent turn. The command is handled by the async function `m95` (resolved via module `Ag1`) and renders an interactive JSX panel directly in the terminal.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `loops` |
| description | `List, create, and delete recurring loops and stop-hooks` |
| loc_byte | `12172437` |
| loc_byte_end | `12172619` |
| loc_line | `10148` |
| immediate | `true` |
| module_id | `Ag1` |
| load_inline | `true` |
| arbor_handler.name | `m95` |
| arbor_handler.fqn | `claude-2.1.152::m95` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.152 bundle.js:+12172437

---

## Input Branching

The command inspects the user's argument string and branches across five distinct paths (list, create-cron, create-stophook, delete, and set-stophook-goal), making a Mermaid flowchart the appropriate representation.

```mermaid
flowchart TD
    A(["/loops called"]) --> B{argument present?}
    B -- No --> LIST[List all loops + stop-hooks\nrender JSX panel]
    B -- Yes --> C{parse sub-command}
    C -- '"cron" keyword detected' --> CRON[Parse schedule string\nvia scheduleParser]
    CRON --> CRON2{schedule valid?}
    CRON2 -- Yes --> CREATE[Create cron loop\nOlH: assign UUID + timestamp\nwrite to .claude dir]
    CRON2 -- No --> ERR1[Return parse error]
    C -- '"stophook" keyword detected' --> SH{stop-hook sub-op}
    SH -- 'set prompt' --> SETHOOK[Register stop-hook via EH6\napplyMessageOp append\nemit tengu_stop_hook_added]
    SH -- 'clear / delete' --> CLEARHOOK[Remove stop-hook\nemit tengu_stop_hook_removed\nreturn "Stop hook cleared"]
    SH -- 'not found' --> ERR2[Return "Stop hook not found"]
    C -- 'numeric index' --> DELETE[Delete loop by index\na4A: unlink file, update roster]
    C -- 'unrecognised' --> SKIP[Return skip / no-op]
```

Analysis basis: CC v2.1.152 bundle.js:+12171440 (sub-command dispatch), +12171490 (`"cron"` literal), +12171576 (`"stophook"` literal), +12172303 (`"skip"` literal)

---

## Behavioral Spec

### 1. Entry Point — `loopsCommandHandler` (`m95`)

The handler is an `AsyncFunction` registered inline in module `Ag1`.

```
async function loopsCommandHandler(context):
    emit telemetry("tengu_loops_command")              // +12171394
    appState = context.getAppState()
    existingLoops = appState.loops ?? []

    // Build display columns
    columnMap = buildColumnMap(existingLoops)           // ZH6 +12171440

    // Parse user argument
    argText = context.args?.trim()

    if argText is empty:
        return renderLoopListPanel(existingLoops, ...)  // JSX local-jsx render

    loopType = detectLoopType(argText)                 // checks "cron" / "stophook"

    if loopType == "cron":
        schedule = parseCronSchedule(argText)           // TV +12171523
        if schedule is invalid:
            return error(schedule.reason)
        newLoop = createCronLoop(schedule, argText)     // OlH +12172042
        updatedLoops = saveLoop(newLoop, existingLoops) // z6H +12171679
        context.setAppState({ loops: updatedLoops })
        return renderConfirmation(newLoop)

    if loopType == "stophook":
        result = manageStopHook(context, argText)       // EH6 +12172130
        return renderStopHookResult(result)

    if argText matches numeric index:
        deleteLoop(existingLoops[index], context)       // a4A via TV
        return renderDeletion()

    return "skip"
```

Analysis basis: CC v2.1.152 bundle.js:+12171392

---

### 2. Schedule Parsing — `parseCronSchedule` (`TV`)

Converts a human-readable schedule string into a structured cron descriptor.

```
function parseCronSchedule(text):
    trimmed = text.trim()

    // Check for minute-interval pattern (e.g. "every 5 minutes")
    minuteMatch = trimmed.match(/minute pattern/)
    if minuteMatch:
        minutes = parseInt(minuteMatch[1])
        return { kind: "minute", interval: minutes, label: "Every minute" }  // +4772324

    // Check for hour-interval pattern (e.g. "every 2 hours")
    hourMatch = trimmed.match(/hour pattern/)
    if hourMatch:
        hours = parseInt(hourMatch[1])
        return { kind: "hour", interval: hours, label: "Every hour" }        // +4772541

    // Check for "1-5" weekday range notation
    rangeMatch = trimmed.match(/range pattern/)                               // "1-5" +4773248
    if rangeMatch:
        startDay = parseInt(rangeMatch[1])
        endDay   = parseInt(rangeMatch[2])
        // Compute next UTC fire time using getUTCDay / setUTCDate / setUTCHours
        nextFire = computeWeekdaySchedule(startDay, endDay)                  // J.getUTCDay +4773081
        return { kind: "weekday", range: [startDay, endDay], next: nextFire }

    // Daily schedule with specific time
    timeMatch = trimmed.match(/time pattern/)
    if timeMatch:
        hour   = parseInt(timeMatch[1])
        minute = parseInt(timeMatch[2])
        return { kind: "daily", hour, minute }

    return { error: "unrecognised schedule format" }
```

Constants observed:
- Minute-field maximum: `59` (bundle.js:+12171159)
- Hour-field maximum: `23` (bundle.js:+12171230)
- Day-of-month maximum: `31` (bundle.js:+12171283)
- Minimum interval base: `60` seconds (bundle.js:+12171125)
- Schedule range notation example: `"1-5"` (bundle.js:+4773248)
- Labels: `"Every minute"` (bundle.js:+4772324), `"Every hour"` (bundle.js:+4772541)

Analysis basis: CC v2.1.152 bundle.js:+4772204

---

### 3. Loop Creation — `createCronLoop` (`OlH`)

```
function createCronLoop(schedule, promptText):
    id        = crypto.randomUUID()                    // B19.randomUUID +4775760
    createdAt = Date.now()                             // +4775822
    loopRecord = buildLoopRecord(id, createdAt, schedule, promptText)  // VWH +4775868

    // Load existing loop file
    existing = loadLoopsFile()                         // IvH +4775912
    existing.push(loopRecord)                          // f.push +4775925

    // Persist to .claude directory
    ensureDir(claudeDir(".claude"))                    // $lH +4776019
    writeLoopsFile(existing)

    // Update display state
    updateLoopDisplay()                                // y6 +4775957

    return loopRecord
```

Analysis basis: CC v2.1.152 bundle.js:+12172042

---

### 4. Loop Persistence — `loadLoopsFile` (`IvH`) and `saveLoopFile` (`$lH`)

```
function loadLoopsFile():
    filePath = joinPath(configRoot, "loops config")   // y4H +4774443
    try:
        raw = fs.readFile(filePath, "utf-8")          // +4774432 / +4774460
        parsed = JSON.parse(raw)                      // Q6 +4774413
        if not Array.isArray(parsed):
            return []
        return parsed
    catch (ENOENT):
        return []
    catch (other):
        logError(error)                               // Cn.logError +970013
        return []

function saveLoopsFile(loopsArray):
    dir = joinPath(configRoot, ".claude")             // ".claude" +4775601
    fs.mkdir(dir, { recursive: true })
    content = JSON.stringify(loopsArray)              // CH +4775698
    fs.writeFile(path, content)
```

File encoding: `"utf-8"` (bundle.js:+4774460)
Error codes handled: `ENOENT`, `EACCES`, `EPERM`, `ENOTDIR`, `ELOOP`, `EROFS` (bundle.js:+174101–174170)

Analysis basis: CC v2.1.152 bundle.js:+4776139

---

### 5. Stop-Hook Management — `manageStopHook` (`EH6`)

Stop-hooks are single-shot prompts that run at the end of every agent turn. Only one stop-hook is active per session at a time.

```
async function manageStopHook(context, argText):
    // Check gate flags
    checkHooksGate(context)                     // jl_ / "hooks_gate" +10528183
    checkTrustGate(context)                     // "trust_gate" +10528237

    existing = context.getAppState()
    currentHook = existing.stopHook

    subOp = parseStopHookOp(argText)

    if subOp == "set":
        goalText = extractGoalText(argText)     // H8 +10528312
        newHook = {
            type:    "prompt",
            goal:    goalText,                  // "goal" +10529072
            goalStatus: null                    // "goal_status" +10529200
        }
        // Append as system attachment
        context.applyMessageOp({
            op:   "append",                     // "append" +10529007
            role: "system",
            content: { type: "attachment",      // "attachment" +10529113
                       hook: newHook }
        })
        uuid = randomUUID()                     // rW1 +10529026
        context.setAppState({ stopHook: newHook })
        emit telemetry("tengu_stop_hook_added") // +10528673
        return { status: "Stop hook set" }      // "Stop hook set" +12172154

    if subOp == "clear":
        if not currentHook:
            return { status: "Stop hook not found" }  // +12171836
        context.setAppState({ stopHook: null })
        emit telemetry("tengu_stop_hook_removed")      // +10529041
        return { status: "Stop hook cleared" }         // +12171858

    return { status: "Stop hook not found" }
```

Analysis basis: CC v2.1.152 bundle.js:+12172130

---

### 6. Loop Deletion — `deleteLoop` (`a4A`)

```
async function deleteLoop(loopRecord, context):
    // Mark loop state as transitioning
    setState(loopRecord, "done")     // "done" +15387528
    // or "killed" +15387546 / "stopped" +15387555 / "failed" +15387565

    // Remove loop file
    filePath = resolveLoopPath(loopRecord)      // uK +4073121
    fs.rm(filePath)                             // uY.rm +15387618

    // Clean up roster entry
    context.rosterEntry.delete(loopRecord.id)  // _.rosterEntry +15388837

    // Remove from active map
    activeMap.delete(loopRecord.id)            // Y.delete +15389082

    // Schedule timeout for final cleanup (5 minutes)
    setTimeout(cleanup, 300000)                // +15389095

    return { deleted: loopRecord.id }
```

Loop states observed: `"active"`, `"done"`, `"killed"`, `"stopped"`, `"failed"`, `"crashed"`, `"blocked"`, `"working"`, `"bg"`, `"idle"`, `"daemon"`, `"resuming"` (bundle.js:+15387528–+15389309)

Analysis basis: CC v2.1.152 bundle.js:+15387699

---

### 7. Column Display Builder — `buildColumnMap` (`ZH6` / `IJH`)

```
function buildColumnMap(loops):
    colMap = new Map()
    for each loop in loops:
        row = formatRow(loop)                  // IJH +10527987
        label = padEnd(row.label, width, "  ") // K.set +8725867 / "  " +15406393
        colMap.set(loop.id, label)
    return colMap
```

Column width padding: double-space `"  "` (bundle.js:+15406393); `"Stop"` column header (bundle.js:+10527995); `"prompt"` column header (bundle.js:+10528102).

Analysis basis: CC v2.1.152 bundle.js:+12171440

---

### 8. Argument Normalisation — `normaliseArgs` (`aN`)

```
function normaliseArgs(rawArg):
    trimmed = rawArg.trim()               // H.trim +4771033
    parts   = splitScheduleParts(trimmed) // hT7 +4771119
    result  = []
    for each part in parts:
        parsed = parseInt(part) or part
        result.push(parsed)
    return result                         // A.push +4771154
```

Internal parser (`hT7`) constants:
- Maximum field value range capped at `10` (bundle.js:+4770532)
- Weekday set uses values `3`, `6`, `7` (bundle.js:+4770694, +4770730, +4770736)
- Maximum token count per segment: `5` (bundle.js:+4771069)
- Tokens per group: `4` (bundle.js:+4771232)

Analysis basis: CC v2.1.152 bundle.js:+4771033

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_loops_command` | Fired once on every invocation of `/loops` (bundle.js:+12171394) |
| Telemetry: `tengu_stop_hook_added` | Fired when a stop-hook is successfully registered (bundle.js:+10528673) |
| Telemetry: `tengu_stop_hook_removed` | Fired when a stop-hook is cleared (bundle.js:+10529041) |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Fired on SIGKILL escalation during loop daemon management (bundle.js:+15382331) |
| Telemetry: `tengu_daemon_control` | Fired on daemon start/stop transitions (bundle.js:+15418464) |
| Telemetry: `tengu_feature_bad` / `tengu_feature_ok` / `tengu_feature_sad` | General feature-gate outcome signals (bundle.js:+964577, +964519, +964654) |
| Telemetry: `tengu_bg_low_mem_mb` | Emitted when background worker memory is low (bundle.js:+12685538) |
| Telemetry: `tengu_bg_dispatch_low_mem` | Emitted when dispatcher detects low memory (bundle.js:+15382910) |
| Telemetry: `tengu_bg_spare_enable` | Emitted when spare-pool is activated (bundle.js:+15383605) |
| Telemetry: `tengu_bg_spare_claim` | Emitted when a spare slot is claimed (bundle.js:+15383726) |
| Telemetry: `tengu_bg_spare_spawn` | Emitted when a spare process is spawned (bundle.js:+15382024) |
| Telemetry: `tengu_bg_spare_claim_fail` | Emitted on spare claim failure (bundle.js:+15383989) |
| Telemetry: `tengu_bg_sendclaim_failed` | Emitted when send-claim IPC times out or fails (bundle.js:+15363060) |
| Telemetry: `tengu_daemon_yield` | Emitted when daemon yields to a foreground process (bundle.js:+15401311) |
| Telemetry: `tengu_daemon_config_reload` | Emitted on live daemon config reload (bundle.js:+15397117) |
| Telemetry: `tengu_bg_bg_session_create` | Emitted on background session creation (bundle.js:+15382641) |
| appState changes | `loops` array updated on create/delete; `stopHook` field set or cleared |
| File I/O | Reads/writes loop definitions under `.claude/` directory (bundle.js:+4775601) |
| IPC | Send-claim uses a socket with 5 000 ms timeout; retries on `ECONNREFUSED` with 500 ms back-off (bundle.js:+15363481, +15363685) |
| Daemon signals | Loop deletion may send `SIGTERM` then escalate to `SIGKILL` (bundle.js:+15363298, +15382379) |
| Cleanup timer | Deleted loops are fully pruned after 300 000 ms (5 min) timeout (bundle.js:+15389095) |
| Hook registration | Stop-hook appended to conversation as a `system`/`attachment` message op (bundle.js:+10529007, +10529113) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.152 | Initial analysis |

---

## Common Mistakes

1. **Confusing loop type keyword placement** — The `cron` or `stophook` keyword must appear in the argument string for the correct branch to be taken. An argument that starts with a plain number is interpreted as a deletion index, not a schedule.
2. **Expecting multiple stop-hooks** — Only one stop-hook is supported per session. Setting a new one overwrites the previous registration silently.
3. **Assuming immediate execution** — A newly created cron loop fires on its next scheduled tick, not immediately at creation time. Use `/loops` with no arguments to confirm the calculated next-fire time.
4. **Deleting by name instead of index** — The deletion sub-command requires the numeric list index shown in the `/loops` panel, not the loop's name or UUID.
5. **Ignoring gate flags** — Stop-hook operations check `hooks_gate` and `trust_gate` policy settings (bundle.js:+10528183, +10528237). In restricted policy environments the set/clear operations may silently fail.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `m95` | Main handler — `loopsCommandHandler` (AsyncFunction, module `Ag1`) |
| `c` | Core utility / logger helper |
| `Y6H` | Top-level loops context initialiser |
| `IvH` | Loop file loader (reads config from disk) |
| `Q6` | JSON parse wrapper for loop file |
| `y4H` | Loop file path resolver |
| `rK` | Config root path getter |
| `eq` | Error code classifier |
| `L8` | Structured error factory |
| `hH` | Queue/rate-limiter for loop execution |
| `n_` | Error-string formatter |
| `uH` | String coercion helper |
| `V1` | Essential-traffic gate checker |
| `UtK` | Queue shift-and-push manager |
| `N` | Normalised loop descriptor builder |
| `OyK` | Loop metadata enricher |
| `H` | Random-delay / timer utility |
| `CH` | JSON.stringify wrapper |
| `j4` | Text redaction / replacement helper |
| `VxH` | Environment accessor |
| `DyK` | Loop file writer with byte-length guard |
| `aN` | Argument normaliser |
| `hT7` | Schedule token splitter / parser |
| `A` | Lowercase conversion helper |
| `L` | Active-loop set manager |
| `q` | File-unlink set tracker |
| `M` | Loop process handle |
| `$G` | Context config reader |
| `pv` | Path utility (join/resolve) |
| `ZH6` | Column-map / display builder |
| `IJH` | Row label formatter with padEnd |
| `K` | Column map store |
| `J_1` | Row map transformer |
| `y6` | Display state updater |
| `TV` | Schedule string parser (cron/weekday/hourly/daily) |
| `w` | Background worker / loop runner |
| `R` | Loop process supervisor |
| `WGK` | Realpath + stat checker |
| `Tz` | Timeout tracker |
| `Wx5` | PTY host helper |
| `z` | Daemon write/stop interface |
| `mH` | Background session creator |
| `SH` | Feature-ok session handler |
| `jI8` | Memory probe (macOS freemem) |
| `E6` | MCP client connection tracker |
| `mY6` | Pins file reader |
| `pj_` | Pins path resolver |
| `B6` | JSON parse (pins) |
| `j8` | Filesystem error classifier |
| `QD7` | Directory loop-file scanner |
| `B` | Settled-loop retirement checker |
| `F6` | MCP filter helper |
| `gH` | Orphaned-permission set |
| `d4A` | Spare-slot claim dispatcher |
| `h_A` | Loop workspace initialiser |
| `lb5` | Send-claim timeout controller |
| `cb5` | Claim-frame builder |
| `GH` | String coercion (GH → String) |
| `IB` | IPC message framer (Buffer pack) |
| `a4A` | Loop deletion / lifecycle manager |
| `uK` | Loop file path builder |
| `n9` | Loop stat + roster reader |
| `tw` | Active-state transition helper |
| `d5` | Loop descriptor formatter |
| `A66` | Post-deletion async cleanup |
| `N5H` | Socket path builder |
| `Gh` | Config directory path helper |
| `bB` | Socket + host resolver |
| `Jv6` | Config write helper |
| `Y` | Loop config reload / restart manager |
| `D` | Spare-slot spawn orchestrator |
| `$` | Disposable resource manager |
| `Q4A` | Spare process spawner (Bun.spawn) |
| `S` | Disposable wrapper |
| `j` | Loop kill aggregator |
| `y` | Loop process killer |
| `J` | UTC date computation helper |
| `z6H` | Loop save + persist orchestrator |
| `is` | Config has-key checker |
| `$lH` | Loop file writer (.claude dir) |
| `VH6` | Stop-hook state applier |
| `rW1` | UUID generator wrapper |
| `u95` | Schedule field validator / normaliser |
| `OlH` | Cron loop record creator |
| `VWH` | Loop record struct builder |
| `f` | MCP server connection orchestrator |
| `lhH` | MCP server lifecycle manager |
| `r6H` | MCP transport factory |
| `pV` | MCP protocol version negotiator |
| `e8` | MCP event emitter |
| `iE6` | MCP capability checker |
| `RbL` | MCP tool registrar |
| `zM8` | MCP output token tracker |
| `$M8` | MCP model capability gate |
| `O8` | MCP debug logger |
| `EQ_` | OAuth flow initiator |
| `VQ_` | OAuth callback handler |
| `xJ1` | MCP tool result processor |
| `TQ_` | MCP token / model guard |
| `qv_` | MCP include-filter checker |
| `XL` | MCP error logger |
| `SJ1` | MCP server name resolver |
| `rE6` | MCP timeout parser (primary) |
| `Vd_` | MCP timeout parser (fallback) |
| `dPK` | MCP update applier |
| `bG8` | MCP JSON stringify helper |
| `xI` | MCP cleanup coordinator |
| `yR5` | MCP server reconciler / retry manager |
| `DM8` | MCP server type classifier |
| `n8` | Retry timer with abort support |
| `HH6` | MCP JSON error formatter |
| `Ki` | Conversation history trimmer |
| `z1H` | Message trim executor |
| `Tt` | Message slice helper |
| `EH6` | Stop-hook set/clear handler |
| `jl_` | Gate-check orchestrator (hooks + trust) |
| `xp` | Policy settings reader |
| `x8` | Policy object accessor |
| `HD` | Gate flag evaluator |
| `h_` | Gate fallback handler |
| `ZL` | Permission resolver |
| `y_7` | Permission chain walker |
| `H8` | Stop-hook goal extractor |
| `xw` | App-state output-token reader |