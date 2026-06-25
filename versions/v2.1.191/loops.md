---
type: feature-spec
feature: "loops"
cc_version: "2.1.191"
updated: "2026-06-25"
tags: ["loops", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.191 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/loops`

> Analysis basis: CC v2.1.191 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.191

---

## Overview

The `/loops` command provides an interactive management interface for Claude Code's background loop (agent) sessions. It enables users to list all active and historical loops, create new loops with a cron schedule and optional stop-hook, and delete existing loops — all from the CLI's JSX-rendered UI layer.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `loops` |
| description | `List, create, and delete loops` |
| loc_byte | `12638997` |
| loc_byte_end | `12639154` |
| loc_line | `8497` |
| immediate | `true` |
| module_id | `bBl` |
| load_inline | `true` |
| arbor_handler.name | `_xf` |
| arbor_handler.fqn | `claude-2.1.191::_xf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.191 bundle.js:+12638997

---

## Input Branching

The handler implements five distinct branches driven by user sub-command input and loop state:

```mermaid
flowchart TD
    A["/loops invoked"] --> B{Parse sub-command token}
    B --> C["list (default / no args)"]
    B --> D["create / new loop"]
    B --> E["delete / remove loop"]
    B --> F["set-stophook on loop"]
    B --> G["clear-stophook on loop"]

    C --> C1[Read all loop roster entries via loopRosterReader]
    C1 --> C2[Format table with padEnd spacing]
    C2 --> C3[Render JSX list view]

    D --> D1[Parse cron expression via cronParser]
    D1 --> D2{Valid cron?}
    D2 -- yes --> D3[Generate UUID + timestamp via loopCreator]
    D3 --> D4[Write loop config to .claude/ directory]
    D4 --> D5[Emit tengu_loops_command telemetry]
    D2 -- no --> D6[Return validation error]

    E --> E1[Locate loop by ID/name]
    E1 --> E2{Loop found?}
    E2 -- yes --> E3[Kill background session via SIGKILL escalation]
    E3 --> E4[Remove loop state files]
    E4 --> E5[Update roster]
    E2 -- no --> E6[Return not-found error]

    F --> F1[Parse stophook argument]
    F1 --> F2[Validate hook exists in config]
    F2 --> F3{Hook found?}
    F3 -- yes --> F4[Attach stophook to loop; emit tengu_stop_hook_added]
    F3 -- no --> F5[Return "Stop hook not found"]

    G --> G1[Locate stophook on loop]
    G1 --> G2{Hook attached?}
    G2 -- yes --> G3[Detach hook; emit tengu_stop_hook_removed]
    G2 -- no --> G4[Return "Stop hook cleared" / no-op]
```

---

## Behavioral Spec

### Top-level handler: loopsCommandHandler (`_xf`)

Analysis basis: CC v2.1.191 bundle.js:+12637962

```
async function loopsCommandHandler(context):
    emit telemetry("tengu_loops_command")               // +12637964

    loopList  = readLoopRoster(context)                 // calls Tle → Gst
    formatted = buildLoopTable(loopList)                // calls aht, padEnd with width 40
    appState  = context.getAppState()                   // +12638014

    subCommand = parseSubCommand(context.input)         // trimmed token dispatch

    if subCommand == "create" or "new":
        result = createLoop(context, subCommand)        // calls jst
    else if subCommand == "delete" or "remove":
        result = deleteLoop(context, subCommand)        // calls aP → f
    else if subCommand contains "stophook":
        result = manageStopHook(context, subCommand)    // calls cht or lht
    else:
        result = renderLoopList(formatted)              // default list view

    render TBl.jsx with result
```

---

### Loop roster reader (`Tle` → `Gst`)

Analysis basis: CC v2.1.191 bundle.js:+5029614

```
function readLoopRoster(context):
    configDir = resolveConfigDir()                      // $He → qRn.join + dc
    rawBytes  = fs.readFile(configDir, "utf-8")        // +5027626, encoding "utf-8"

    if read error:
        classify error code among:
            ENOENT, EACCES, EPERM, ENOTDIR,
            ELOOP, ENAMETOOLONG, EROFS               // +184039–184128
        log via GQ.logError                           // +1056586

    parsed = parseRosterEntries(rawBytes)              // Le → Yi, Rmu, sXe.push
    return Array.isArray(parsed) ? parsed : []
```

---

### Cron expression parser (`Hxf`)

Analysis basis: CC v2.1.191 bundle.js:+12637550

```
function parseCronExpression(input):
    match = input.match(cronPattern)
    if no match: return validation error

    minutes = parseInt(match.minutes)
    // Clamp: max field value 59 for minutes (+12637729),
    //        60 used as modulus basis (+12637695)
    //        max hour field 23 (+12637800)
    //        max day field 31 (+12637853)
    value   = Math.max(0, Math.ceil(rawValue))
    rounded = Math.round(value)

    // Special cron labels resolved:
    //   "Every minute"  → "* * * * *"   (+5025518)
    //   "Every hour"    → "0 * * * *"   (+5025735)
    //   "1-5"           → weekday range  (+5026442)

    scheduleTokens = K1(input)                        // tokenizer: trim + split + match + parseInt
    return { cron: scheduleTokens, type: "cron" }    // literal "cron" +12638060
```

---

### Loop creator (`jst`)

Analysis basis: CC v2.1.191 bundle.js:+5028954

```
async function createLoop(context, parsedInput):
    id        = Uqi.randomUUID()                      // +5028954
    timestamp = Date.now()                            // +5029016
    config    = buildLoopConfig(id, timestamp, parsedInput)  // dfe
    roster    = readLoopRoster(context)               // Gst again

    targetDir = path.join(".claude", loopSubdir)      // literal ".claude" +5028795
    fs.mkdir(targetDir, { recursive: true })          // VRn.mkdir
    fs.writeFile(targetDir + "/" + id, config)        // VRn.writeFile

    // UUID uses 8-char prefix bucket +5028979 (value 8)
    push loop entry to roster                         // a.push +5029119
    emit confirmation message via wt (statusWriter)
    return rendered loop entry
```

---

### Loop deleter / background session killer (`aP` → `f`)

Analysis basis: CC v2.1.191 bundle.js:+5025398

```
async function deleteLoop(context, input):
    target = input.trim()
    match  = target.match(idPattern)
    loopId = parseInt(match) if match else target

    session = loopSessionMap.get(loopId)              // n.get +17370423
    if session is "closed":                           // literal "closed" +17370403
        // already gone, skip kill
    else:
        session.kill("SIGKILL")                       // +17370589, escalation path
        emit("tengu_bg_dispatch_sigkill_escalate")    // +17370541
        // wait up to 30 s (+17370496) or 15 s (+17370507) for exit

    // Compute UTC week-boundary for schedule cleanup:
    g.getUTCDay(), g.setUTCDate(), g.getUTCDate()
    g.setUTCHours(), g.getDay()                       // +5026275–5026354

    removeLoopStateFiles(loopId)                      // Fjo → Jm.rm, Jm.unlink
    updateRoster()
    return status string                              // toString of result +5025772
```

---

### Loop state file manager (`Fjo`)

Analysis basis: CC v2.1.191 bundle.js:+17376639

```
async function manageLoopStateFiles(loopId):
    // Loop lifecycle states tracked:
    //   "done", "killed", "failed", "crashed",
    //   "blocked", "working", "bg", "idle",
    //   "resuming", "active", "stopped"
    //   (+17376775, +17376793, +17376812, +17376959,
    //    +17377013, +17377327, +17377491, +17377931,
    //    +17378909, +4290822, +17408094)

    stateFile = path.join(loopDir, "state.json")      // +17377163
    Jm.access(stateFile)
    Jm.rm(stateFile, { recursive: true })

    if platform != "windows":                         // +17378176
        oSe(loopId)   // cleanup socket / pipe
        zR(loopId)    // release claim file (cvl)
        zN(loopId)    // write AHt tombstone + eh.join

    aqt(loopId)       // cleanup temp dir: eh.join + iqt
    lqt(loopId)       // cleanup lock file: eh.join + iqt

    // Stale-entry GC: 5-minute TTL for orphan state
    setTimeout(gcOrphan, 300000)                      // +17378695

    d.get(loopId), d.delete(loopId), e.delete(loopId)
```

---

### Stop-hook attacher (`lht`)

Analysis basis: CC v2.1.191 bundle.js:+10758984

```
async function attachStopHook(context, hookSpec):
    // Gates checked in order:
    //   "hooks_gate"   (+10758880)
    //   "trust_gate"   (+10758934)
    //   "goal_set"     (+10759012)
    //   "policySettings" (+3408698)

    policyOk = LCo(context)            // TB → In (vln, z2) + iae (In, jo) + xr + Md
    if not policyOk: return error

    timestamp = Date.now()             // +10759233
    loopState = context.getAppState()  // +10759069

    iy(loopState)                      // outputTokens check (+48285, Object.values)
    context.setAppState(newState)      // +10759271
    context.applyMessageOp({           // +10759313
        type: "append",                // +10759708
        role: "system",                // literal "system" +12638295
        content: {
            type: "attachment",        // +10759818
            goal: hookSpec,            // literal "goal" +10759776
            goal_status: "pending"     // literal "goal_status" +10759905
        }
    })
    messageId = lgl()                  // crypto.randomUUID() +10759836
    emit("tengu_stop_hook_added")      // +10759370
    render via Ve (eze)
    return "Stop hook set"             // +12638724
```

---

### Stop-hook remover (`cht`)

Analysis basis: CC v2.1.191 bundle.js:+10759476

```
async function removeStopHook(context, hookId):
    loopState = context.getAppState()              // +10759487
    hookEntry = findHookInState(loopState, hookId)

    if hookEntry not found:
        return "Stop hook not found"               // +12638406
    else:
        context.setAppState(stateWithoutHook)      // +10759616
        context.applyMessageOp({                   // +10759685
            type: "append",
            content: { removed: hookId }
        })
        emit("tengu_stop_hook_removed")            // +10759742
        return "Stop hook cleared"                 // +12638428
```

---

### Loop table formatter (`aht` → `cMe`)

Analysis basis: CC v2.1.191 bundle.js:+10758683

```
function formatLoopTable(loopEntries):
    columns = loopEntries.map(entry => buildRow(entry))  // o.map +17397128
    padded  = columns.map(col => col.padEnd(40))         // +17397141, value 40 +17399136
    // Two-space separator between columns                // "  " +17397162
    merged  = cMe.set(padded) + YYa.map(padded)
    return merged
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_loops_command` | Fired once per `/loops` invocation (bundle.js:+12637964) |
| Telemetry: `tengu_stop_hook_added` | Fired when a stop-hook is successfully attached to a loop (+10759370) |
| Telemetry: `tengu_stop_hook_removed` | Fired when a stop-hook is detached (+10759742) |
| Telemetry: `tengu_bg_dispatch_sigkill_escalate` | Fired when a background session is force-killed during loop deletion (+17370541) |
| Telemetry: `tengu_bg_state_read_transient` | Fired when loop state file read is in a transient/unknown condition (+4282879) |
| Telemetry: `tengu_daemon_idle_exit` | Fired when the daemon managing the loop exits idle (+17392101) |
| Telemetry: `tengu_daemon_config_reload` | Fired on daemon config reload during loop lifecycle (+17386661) |
| Telemetry: `tengu_bg_spare_enable` | Fired when a spare background session slot is enabled (+17371839) |
| Telemetry: `tengu_bg_spare_claim` | Fired when a spare session is claimed for a new loop (+17371967) |
| Telemetry: `tengu_bg_spare_claim_fail` | Fired when spare session claim fails (+17372233) |
| Telemetry: `tengu_bg_sendclaim_failed` | Fired when the send-claim IPC times out (5000 ms timeout) (+17346821) |
| Telemetry: `tengu_bg_low_mem_mb` | Fired on low memory detection during dispatch (+13163474) |
| Telemetry: `tengu_bg_dispatch_low_mem` | Fired when dispatch is suppressed due to low memory (+17371142) |
| Telemetry: `tengu_daemon_control` | Fired on daemon start/stop control events (+17408260) |
| Telemetry: `tengu_daemon_yield` | Fired when the daemon yields to a foreground session (+17391071) |
| Telemetry: `tengu_feature_ok` | Fired on successful feature flag check (+1025725) |
| Telemetry: `tengu_feature_bad` | Fired on failed feature flag check (+1025792) |
| Telemetry: `tengu_feature_sad` | Fired on feature flag error path (+1025873) |
| Telemetry: `tengu_mcp_skills` | Fired during MCP skills registration within loop context (+6756547) |
| appState changes | `getAppState` / `setAppState` / `applyMessageOp` called during stop-hook attach and detach |
| File system writes | Loop configs written to `.claude/` directory; state tracked in `state.json` per loop |
| Hook registration | Stop-hooks attached as `"stophook"` type entries with `goal` / `goal_status` fields |
| Session kill signal | `SIGKILL` sent to background session process on loop deletion (+17370589) |
| Stale state GC | 300,000 ms (5 min) `setTimeout` to garbage-collect orphaned loop state (+17378695) |
| IPC | `glr.connect` / socket claim frame via `VR` (Buffer framing with `writeUInt32BE` / `writeUInt8`) |
| Daemon config | Loop daemon writes config with `tq.writeFile` / `JSON.stringify`; max payload sizes 448 (+13915361) and 384 (+13915412) bytes |
| Send-claim timeout | 5000 ms (+17347255); retry delay 500 ms (+17347459) |

---

## Version History

| Version | Change |
|---|---|
| v2.1.191 | Initial analysis |

---

## Common Mistakes

1. **Omitting the sub-command**: invoking `/loops` alone defaults to the list view; users expecting creation must pass a `create`/`new` sub-command explicitly with a valid cron expression.
2. **Invalid cron syntax**: the cron parser (`Hxf`) applies field-level numeric bounds (minutes ≤ 59, hours ≤ 23, days ≤ 31); out-of-range values are clamped or rejected.
3. **Deleting a loop that is already `"closed"`**: the handler detects the `"closed"` state and skips the SIGKILL path, but the roster entry is still cleaned up; callers should not expect a kill-confirmation message in this case.
4. **Stop-hook referencing a non-existent hook**: the attach path validates the hook name against the config store; a missing name returns `"Stop hook not found"` and no state is modified.
5. **Platform assumptions**: certain cleanup steps (socket/pipe teardown, claim-file release) are skipped on Windows (`"windows"` literal at +17378176); loop teardown may be less complete on that platform.
6. **Confusing `"skip"` control flow**: the literal `"skip"` (+12638863) is used internally as a sentinel to bypass rendering steps; passing it as user input has no special effect but may produce unexpected no-op behavior.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `_xf` | Top-level loops command handler (AsyncFunction, Arbor-resolved) |
| `W` | General utility / writer helper |
| `Tle` | Loop roster loader (calls `Gst`) |
| `Gst` | Raw loop config file reader |
| `Gt` | Config path resolver |
| `$He` | Config directory path builder (joins `qRn`) |
| `dc` | Directory context resolver |
| `zo` | Error classification wrapper (calls `dn`) |
| `dn` | Low-level error logger |
| `Le` | Log error emitter (calls `fo`, `rt`, `Yi`, `Rmu`, `sXe.push`, `GQ.logError`) |
| `fo` | Error object formatter |
| `rt` | String coercion helper |
| `Yi` | Essential-traffic filter |
| `Rmu` | Queue shift/push buffer manager |
| `T` | Text / token formatter (calls `cNe`, `wNc`, `ke`, `Dc`, etc.) |
| `wNc` | Token normaliser (calls `kO`, `Qfr`, `kqo`) |
| `ke` | JSON serialiser wrapper |
| `Dc` | String redactor / slicer |
| `a7e` | Auxiliary string formatter |
| `kNc` | File-content reader with byte-length check |
| `K1` | Cron token splitter / trimmer |
| `k4d` | Cron field parser (split, match, parseInt, Set operations) |
| `bI` | Status bar writer (calls `ux`) |
| `ux` | Terminal output primitive |
| `aht` | Loop table builder (calls `cMe`) |
| `cMe` | Column map setter |
| `YYa` | Row mapper |
| `wt` | Status writer (calls `ux`) |
| `aP` | Delete-loop input parser |
| `f` | Background session object / loop runner |
| `D` | Session spawner/lifecycle manager |
| `y0c` | Realpath + stat resolver |
| `up` | Process resource helper |
| `tfm` | File-change monitor helper |
| `d` | Session write/supervisor wrapper |
| `jn` | Timeout-with-abort helper |
| `c` | Abort signal controller |
| `Re` | Feature-ok reporter |
| `Pe` | Feature-path encoder |
| `we` | Feature-ok emitter |
| `Yer` | Memory check dispatcher |
| `nt` | Notification / telemetry emitter |
| `I3e` | pins.json reader and directory lister |
| `l1t` | Path joiner for pins |
| `$t` | JSON safe-parser |
| `vn` | Generic error normaliser |
| `VPd` | Recursive directory lister |
| `F` | Idle-exit timeout manager |
| `N` | Timer reference holder |
| `M` | Timer write wrapper |
| `Mjo` | IPC claim sender (glr.connect) |
| `K2o` | Config directory writer (tq.mkdir, tq.writeFile) |
| `Ipm` | Claim timeout / retry handler |
| `Tpm` | Claim frame builder |
| `Gd` | Error string formatter |
| `Ae` | String coercion wrapper |
| `VR` | Binary frame encoder (Buffer, writeUInt32BE, writeUInt8) |
| `Fjo` | Loop state file deleter |
| `ic` | Path join + resolve helper |
| `Bi` | Loop state file reader / cache manager |
| `bh` | Active-state checker |
| `eLe` | File-set filter with prefix matching |
| `Od` | Path key builder |
| `bHt` | Timing wrapper (Date.now, catch) |
| `lqt` | Lock file path builder |
| `oSe` | Socket/pipe cleanup helper |
| `zR` | Claim file release |
| `zN` | AHt tombstone writer |
| `PM` | Late-claim file writer |
| `aqt` | Temp directory cleanup helper |
| `p` | Forced-shutdown initiator (process.exit, u.abort) |
| `oT` | Shutdown reason formatter |
| `u` | Abort controller wrapper |
| `m` | Session kill iterator |
| `k` | Session write-kill helper |
| `l` | Log file rotation helper |
| `rGl` | Daemon status file reader |
| `HZ` | Platform ring helper |
| `qs` | AsyncLocalStorage store getter |
| `ozt` | Daemon status path builder |
| `g` | UTC date arithmetic helper |
| `ble` | Loop filter and roster writer |
| `Xq` | Roster existence checker |
| `rUt` | Roster file writer (.claude dir) |
| `cht` | Stop-hook remover |
| `lgl` | UUID generator (crypto.randomUUID) |
| `Ve` | Render helper (eze) |
| `eze` | JSX render primitive |
| `Hxf` | Cron expression parser (Math.max, Math.ceil, Math.round) |
| `jst` | Loop creator (UUID, Date.now, config write) |
| `dfe` | Loop config builder |
| `a` | MCP server / session accumulator |
| `s5e` | MCP connection initialiser |
| `S3` | Session state reconciler |
| `mL` | MCP plugin loader |
| `Gn` | Generic node helper |
| `U2t` | Update throttle helper |
| `vEa` | Connection validator |
| `xAn` | Auth token builder |
| `wAn` | Watcher helper |
| `ln` | MCP debug logger |
| `ZPn` | Operation dispatcher |
| `$2t` | Request sender with store |
| `Xno` | Auth+log wrapper |
| `hL` | MCP skills telemetry emitter |
| `Dno` | Inclusion filter |
| `v` | Blur/focus timer |
| `Xc` | MCP error logger |
| `kEa` | Gateway checker |
| `xlt` | Integer parser variant A |
| `l1n` | Integer parser variant B |
| `Gar` | Connection result applier |
| `o5e` | Connection state mapper |
| `tI` | Cleanup coordinator |
| `w_a` | Fro wrapper |
| `hGo` | Client object builder |
| `UPn` | Policy set checker |
| `wlt` | State writer |
| `lht` | Stop-hook attacher |
| `LCo` | Policy gate checker (TB, iae, xr, Md) |
| `TB` | Trust-gate resolver |
| `In` | Policy node initialiser |
| `iae` | Policy action evaluator |
| `xr` | Policy context reader |
| `Md` | Policy model dispatcher |
| `G9f` | Model config resolver |
| `Lt` | Feature-sad reporter |
| `iy` | Output-token state inspector |