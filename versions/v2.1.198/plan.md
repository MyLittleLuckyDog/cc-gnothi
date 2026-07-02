---
type: feature-spec
feature: "plan"
cc_version: "2.1.198"
updated: "2026-07-02"
tags: ["plan", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.198 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/plan`

> Analysis basis: CC v2.1.198 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.198

---

## Overview

The `/plan` command enables **plan mode** for the current Claude Code session, or views and shares the current session plan. When invoked with no argument or with a description, it activates plan mode and optionally sets an initial plan text. The `open` and `share` sub-commands allow the user to open the plan in an editor or publish it, respectively. The command handles both local and remote (cloud/daemon-backed) sessions transparently.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `plan` |
| description | Enable plan mode or view the current session plan |
| argumentHint | `[open\|share\|<description>]` |
| module_id | `Hnc` |
| load_inline | `true` |
| loc_byte | `13019676` |
| loc_byte_end | `13019881` |
| loc_line | `8867` |
| arbor_handler.name | `Zem` |
| arbor_handler.fqn | `claude-2.1.198::Zem` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.198 bundle.js:+13019676

---

## Input Branching

There are 6+ distinct branches based on argument value and session type; a Mermaid flowchart is used.

```mermaid
flowchart TD
    A["/plan invoked"] --> B{Parse trimmed argument}

    B -->|no argument / empty| C{Already in plan mode?}
    C -->|No| D[Enable plan mode\nprint 'Enabled plan mode']
    C -->|Yes| E{Session is remote?}
    E -->|No| F[Print 'Already in plan mode.\nNo plan written yet.' if no plan\nor display current plan text]
    E -->|Yes| G[Send 'get_plan' control request\nwait for response]
    G -->|Success| H[Display plan content via\nplan_remote_view telemetry]
    G -->|Timeout| I[Print 'get_plan timed out']
    G -->|Unsupported subtype| J[Print 'Viewing plans in cloud sessions\nneeds a newer session runtime.']
    G -->|request_failed| K[Print "Couldn't fetch the plan..."]

    B -->|"open"| L{Session is remote?}
    L -->|No| M[Open plan in editor\ntelemetry: plan_remote_open]
    L -->|Yes| N[Fetch plan via control request\nthen open editor]

    B -->|"share"| O{Plan artifact enabled?\nxen.isPlanArtifactEnabled}
    O -->|No| P[Print 'Publishing plans is not available\nin this session.']
    O -->|Yes| Q[Call xen.publishPlanArtifact]
    Q -->|Success| R[Show published plan URL]
    Q -->|Failure| S[Print "Couldn't publish plan — try\n/plan share again..."]
    O -->|Remote session| T[Print cloud workspace share\ncaveat message]

    B -->|"<description text>"| U{Already in plan mode?}
    U -->|No| V[Enable plan mode\nset description as initial plan]
    U -->|Yes| W[Print 'Already in plan mode.']

    B -->|mode push needed| X{Remote mode push}
    X -->|Timeout| Y[telemetry: mode_push_timeout]
    X -->|Rejected| Z[telemetry: mode_push_rejected]
```

---

## Behavioral Spec

### Main Handler — `planCommandHandler` (bundle identifier: `Zem`)

The handler is an `AsyncFunction` resolved via `module_id → Hnc` at the Arbor symbol level.

Analysis basis: CC v2.1.198 bundle.js:+13016097

```
async function planCommandHandler(context):
    argument = context.argument.trim()          // loc_byte: 13016375
    sessionType = getSessionType(context)       // "session" key, loc_byte: 13016268

    // Step 1: Determine if we are already in plan mode
    alreadyInPlanMode = checkPlanModeActive(context)

    // Step 2: Branch on argument value
    if argument == "" or argument == undefined:
        if not alreadyInPlanMode:
            enablePlanMode(context)
            print("Enabled plan mode")         // loc_byte: 13016312
        else:
            handleViewPlan(context, sessionType)

    else if argument == "open":                 // loc_byte: 13016397
        handleOpenPlan(context, sessionType)

    else if argument == "share":                // loc_byte: 13016409
        handleSharePlan(context)

    else:
        // Treat argument as a plan description
        if not alreadyInPlanMode:
            enablePlanMode(context)
            setInitialPlanDescription(context, argument)
        else:
            print("Already in plan mode.")     // loc_byte: 13016332
```

---

### Plan Mode Activation — `enablePlanMode` (calls `setMode` via `$H`)

Analysis basis: CC v2.1.198 bundle.js:+13016196

```
function enablePlanMode(context):
    // Calls the setMode control function ($H)
    // Attempts to push mode="plan" to the session
    result = setMode("plan", context)           // "setMode" literal, loc_byte: 6922392

    if result == TIMEOUT:
        emitTelemetry("mode_push_timeout")      // loc_byte: 13016508
    else if result == REJECTED:
        emitTelemetry("mode_push_rejected")     // loc_byte: 13016528

    // If bypassPermissions mode is not available, the mode push is silently
    // rejected with the warning:
    // "Ignoring permission update: setMode 'bypassPermissions' rejected..."
    // loc_byte: 6922480
```

---

### View Plan — `handleViewPlan` (local vs. remote branch)

Analysis basis: CC v2.1.198 bundle.js:+13016483

```
function handleViewPlan(context, sessionType):
    if sessionType == "remote":                 // "remote" literal, loc_byte: 64238
        // Send control request "get_plan" to remote daemon
        emitTelemetry("plan_remote_query")      // loc_byte: 13016486
        response = sendControlRequest("get_plan", context)
        // timeout wraps Promise.race, loc_byte: 877568

        if response == TIMEOUT:
            print("get_plan timed out")         // loc_byte: 13017749
        else if response.subtype == "unsupported_subtype":
            print("Viewing plans in cloud sessions needs a newer session runtime.")
            // loc_byte: 13018347
        else if response.subtype == "request_failed":
            print("Couldn't fetch the plan from the cloud session — try again.")
            // loc_byte: 13018412
        else:
            emitTelemetry("plan_remote_view")   // loc_byte: 13017823
            displayPlanContent(response.plan)
    else:
        // Local session: read plan from in-process state
        plan = getCurrentPlan(context)
        if plan == null or plan == "":
            print("Already in plan mode. No plan written yet.")  // loc_byte: 13017867
        else:
            displayPlanContent(plan)
```

---

### Open Plan — `handleOpenPlan`

Analysis basis: CC v2.1.198 bundle.js:+13017195

```
function handleOpenPlan(context, sessionType):
    emitTelemetry("plan_remote_open")           // loc_byte: 13017195

    if sessionType == "remote":
        // Fetch plan content first via control request, then open editor
        plan = fetchRemotePlan(context)
    else:
        plan = getCurrentPlan(context)

    // Open plan in external editor via VTe (editor-launch sub-system)
    // VTe suspends stdin, launches spawnSync editor, then restores stdin
    // loc_byte: 13018803
    openInEditor(plan, context)
```

---

### Editor Launch — `editorLauncher` (bundle identifier: `VTe`)

Analysis basis: CC v2.1.198 bundle.js:+13018803

```
function editorLauncher(planContent, context):
    // Resolve editor binary via Ax (editor-resolution helper)
    editorBin = resolveEditor()                 // Ax, loc_byte: 13019343

    // Pause Ink rendering and suspend stdin
    context.tty.enterAlternateScreen()          // loc_byte: 12113822
    context.tty.pause()
    context.tty.suspendStdin()                  // loc_byte: 12113862

    // Write plan to a temp file, spawn editor synchronously
    tmpLines = planContent.split("\n")          // loc_byte: 12113901
    spawnSyncResult = QGl.spawnSync(editorBin, [tmpFile], {stdio: "inherit"})
    // loc_byte: 12113944, "inherit" loc_byte: 12113976

    // Read back modified content
    updatedContent = fs.readFileSync(tmpFile)   // loc_byte: 12114246

    // Restore terminal state
    context.tty.exitAlternateScreen()           // loc_byte: 12114324
    context.tty.resumeStdin()                   // loc_byte: 12114353
    context.tty.resume()                        // loc_byte: 12114369

    return updatedContent
```

---

### Share Plan — `handleSharePlan`

Analysis basis: CC v2.1.198 bundle.js:+13018905

```
function handleSharePlan(context):
    emitTelemetry("plan_remote_share")          // loc_byte: 13017497

    // Check if current session is a remote/cloud session
    if sessionType == "remote":
        print("The plan lives in the cloud workspace, so /plan share can't" +
              " publish it from this machine yet...")
        // loc_byte: 13017520
        return

    // Check plan artifact feature flag
    if not xen.isPlanArtifactEnabled(context):  // loc_byte: 13018905
        print("Publishing plans is not available in this session.")
        // loc_byte: 13018942
        return

    // Attempt to publish
    result = xen.publishPlanArtifact(context)   // loc_byte: 13019110
    if result.error:
        print("Couldn't publish plan — try /plan share again, or run with --debug for details.")
        // loc_byte: 13019007
    else:
        displayPublishedPlanURL(result.url)
```

---

### Remote Control Request Dispatch — `sendControlRequest` (bundle identifier: `ul`)

Analysis basis: CC v2.1.198 bundle.js:+13017699

```
async function sendControlRequest(subtype, context):
    // Uses Promise.race with a timeout
    timeoutPromise = new Promise(resolve =>
        setTimeout(resolve, TIMEOUT_MS))        // loc_byte: 877537

    requestPromise = h.sendControlRequest(subtype, context)
    // loc_byte: 13017702

    result = await Promise.race([requestPromise, timeoutPromise])
    // loc_byte: 877568

    clearTimeout(timeoutHandle)                 // loc_byte: 877615
    return result
```

---

### Plan Write / Persistence — `planFileWriter` (calls `fI` → `Bae.writeFileSync`)

Analysis basis: CC v2.1.198 bundle.js:+203266

```
function writePlanFile(planContent, dir):
    filePath = kCr.join(dir, "plan")            // loc_byte: 203284
    Bae.writeFileSync(filePath, planContent)    // loc_byte: 203266
```

---

### Message Injection — `setMessages` and `sendMessage`

Analysis basis: CC v2.1.198 bundle.js:+13016956

```
function injectPlanMessage(context, planText):
    // Inserts a human-role message carrying the plan context
    // "human" role, loc_byte: 13016942
    context.t.setMessages([
        { role: "human", content: planText }
    ])                                          // loc_byte: 13016956
    context.h.sendMessage(...)                  // loc_byte: 13016992
```

---

### Plan Artifact Feature Check — `xen.isPlanArtifactEnabled` / `xen.publishPlanArtifact`

Analysis basis: CC v2.1.198 bundle.js:+13018905 / +13019110

```
function checkPlanArtifact(context):
    enabled = xen.isPlanArtifactEnabled(context)
    if not enabled:
        return { available: false,
                 message: "Publishing plans is not available in this session." }
    return { available: true }

async function publishPlan(context):
    result = await xen.publishPlanArtifact(context)
    return result
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry | `tengu_feature_ok` (loc_byte: 1039573), `tengu_feature_bad` (loc_byte: 1039640), `tengu_bg_dispatch_sigkill_escalate` (loc_byte: 18374756), `tengu_bg_dispatch_low_mem` (loc_byte: 18375462), `tengu_bg_spare_enable` (loc_byte: 18376152), `tengu_bg_sendclaim_failed` (loc_byte: 18367663), `tengu_bg_handoff_settle` (loc_byte: 18382136), `tengu_bg_spare_claim` (loc_byte: 18376280), `tengu_bg_spare_claim_fail` (loc_byte: 18376546) |
| In-process string markers | `"plan_remote_query"` (loc_byte: 13016486), `"mode_push_timeout"` (loc_byte: 13016508), `"mode_push_rejected"` (loc_byte: 13016528), `"plan_remote_open"` (loc_byte: 13017195), `"plan_remote_share"` (loc_byte: 13017497), `"plan_remote_view"` (loc_byte: 13017823), `"send_failed"` (loc_byte: 13017053), `"unsupported_subtype"` (loc_byte: 13018238), `"timeout"` (loc_byte: 13018293), `"request_failed"` (loc_byte: 13018303), `"daemon_bg_session_create"` (loc_byte: 18374571) |
| Mode state change | Sets session mode to `"plan"` via `setMode` control call (`$H`); push may be rejected if `bypassPermissions` mode is unavailable (loc_byte: 6922480) |
| File I/O | `fI → Bae.writeFileSync` persists plan content to disk (loc_byte: 203266); editor launch reads back via `fs.readFileSync` (loc_byte: 12114246); temp-file cleanup via `Fd.unlink` (loc_byte: 18374926) |
| Hook registration | `Si → sus.register` (loc_byte: 69675); `process.on("exit", ...)` (loc_byte: 217658, literal: `"exit"` loc_byte: 217669) |
| Message injection | Injects a `"human"`-role message into the session conversation (loc_byte: 13016942) |
| Terminal state | Editor launch suspends/resumes Ink rendering and stdin (enterAlternateScreen loc_byte: 12113822, exitAlternateScreen loc_byte: 12114324) |
| Control request | `h.sendControlRequest("get_plan", ...)` for remote sessions (loc_byte: 13017702); wrapped in `Promise.race` timeout (loc_byte: 877568) |
| Plan artifact publish | `xen.publishPlanArtifact` gated by `xen.isPlanArtifactEnabled` feature flag (loc_bytes: 13018905, 13019110) |
| appState changes | Session mode field updated to `"plan"`; messages array updated via `t.setMessages` (loc_byte: 13016956) |
| Sound | <!-- TODO: not found in depth-2 traversal; needs --depth 4 --> |

---

## Version History

| Version | Change |
|---|---|
| v2.1.198 | Initial analysis |

---

## Common Mistakes

1. **Calling `/plan share` in a remote/cloud session**: The command explicitly prints a caveat message ("The plan lives in the cloud workspace, so /plan share can't publish it from this machine yet…") and returns early without publishing (loc_byte: 13017520). Use `/plan` to view the plan and share its contents from the cloud session directly.

2. **Expecting `/plan <description>` to update an existing plan**: If plan mode is already active, providing a description argument only prints "Already in plan mode." (loc_byte: 13016332). It does **not** replace the current plan. Use the editor (`/plan open`) to modify an existing plan.

3. **Assuming `/plan open` works without an active plan**: In a local session, if no plan has been written yet, the plan content will be empty. The editor will still open with an empty buffer, which may surprise users expecting to see prior content.

4. **Ignoring `mode_push_timeout` / `mode_push_rejected` outcomes**: When enabling plan mode in a remote session, the mode push is asynchronous and can time out or be rejected (e.g., if `bypassPermissions` restrictions apply). Check for failure messages before assuming plan mode is active (loc_bytes: 13016508, 13016528, 6922480).

5. **Treating `/plan` as idempotent in remote sessions**: Calling `/plan` repeatedly in a remote session sends a new `get_plan` control request each time, which may time out or fail depending on session runtime version support (loc_byte: 13018347).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Zem` | Main `/plan` command handler (AsyncFunction; arbor_handler) |
| `r` | CLI error writer / stream dispatcher |
| `As` | CLI error reporter (writes `"cli_error"`, calls `process.exit`) |
| `uXe` | Error output formatter (calls `console.error`, `Et.red`) |
| `fI` | Plan file writer (calls `Bae.writeFileSync`, `kCr.join`) |
| `Rge` | Session / context resolver |
| `o` | Stream map / padding helper |
| `s` | Async task tracker (add/delete/finally) |
| `i` | Connection / reader (close, toLowerCase) |
| `n` | String normalizer (toLowerCase) |
| `$H` | Mode setter (handles `setMode`, permission rules, directory management) |
| `T` | Config/output writer (includes, toUpperCase, trim, write, flush) |
| `Hiu` | Config initializer (calls `NF`, `$Cr`, `cus`) |
| `cus` | Config sub-initializer (calls `bru`, `Tru`) |
| `e` | String transformer (replace, trim) |
| `t` | Source string / file stat object |
| `Me` | JSON serializer helper (calls `JSON.stringify`) |
| `Oc` | Path/string obfuscator (calls `Kps`, replace, at, lastIndexOf, slice) |
| `Kps` | Mapping table builder (calls `miu.map`) |
| `YZe` | Output writer wrapper (calls `Ops`) |
| `Ops` | Raw stream writer (calls `e.write`) |
| `biu` | Logging / run-loop setup (manages QZe, ZZe, NF, process.on exit) |
| `AZe` | Buffered logger (clearTimeout, setTimeout, setImmediate, join, push) |
| `jae` | Log file path builder (calls `eet`, `Wae.join`, `er`, `kt`) |
| `Siu` | Log file appender (mkdir, appendFile, Uae, Jps, Buffer.byteLength) |
| `Si` | Hook registrar (calls `sus.register`) |
| `zt` | Config path resolver |
| `Uae` | Directory path helper (calls `en`) |
| `Jps` | Log path joiner (calls `Wae.join`, `kt`) |
| `Gp` | String sanitizer (calls `kGu` → `e.replaceAll`) |
| `kGu` | ANSI/escape character replacer (calls `e.replaceAll`) |
| `iEt` | Tool/context initializer (calls `Afr`, `c3`, `OIe`, `Hnn`, `T`) |
| `Afr` | Agent context builder (calls `h6`, `dC`, `D1r`) |
| `h6` | Context sub-field accessor |
| `dC` | Context decorator (calls `xzo`, `fye`, `vs`) |
| `xzo` | Feature flag resolver (calls `Qo`) |
| `fye` | Model capability checker (so, mr, Kit, t.includes; checks claude model strings) |
| `vs` | View-state helper (calls `w6`, `Fo`, `IH`) |
| `D1r` | Settings hierarchy resolver (calls `Hn`) |
| `Hn` | Settings reader (calls `UHn`, `x3`) |
| `c3` | Context sub-initializer |
| `OIe` | Object-entries mapper (calls `Object.entries`, `$H`, `o.map`) |
| `Hnn` | Tool initializer (calls `Afr`, `Kj`) |
| `Kj` | Tool descriptor builder (Object.entries, Ph, Czo, T, Gp, Vgc) |
| `Ph` | Permission rule formatter (MGu, jM, DGu, e.substring, RGu) |
| `Czo` | Rule aggregator ($ze, n.push, Izo, r.match) |
| `Vgc` | Rule dedup/map helper ($hm, r.get/set, a.push, $H) |
| `ba` | UI render helper (calls `Qi`, `Ul`) |
| `Qi` | Render sub-component |
| `Ul` | Render output helper (calls `ute`) |
| `ute` | Terminal output primitive |
| `c_` | Alternative render path (calls `Ul`) |
| `mnc` | Async waiter with timeout (Promise.withResolvers, setTimeout, lIt.push) |
| `Le` | Feature gate checker (calls `V`, `Pe`) |
| `V` | Feature flag value reader |
| `Pe` | Feature flag evaluator (calls `OQe`) |
| `OQe` | Feature flag registry lookup |
| `xn` | Request/session dispatcher (C1.randomUUID, `_`, HC) |
| `y` | HTTP response handler (calls `a`) |
| `a` | Response processor (tge, Response.json) |
| `tge` | Response body serializer (JSON.stringify) |
| `_` | Session worker (g.join, N$, h.push, vgm, xn, HC) |
| `g` | Daemon/background session manager (large; handles spawn, kill, file I/O, Le, dis, gis, nt) |
| `bhe` | Background session helper (calls `st`) |
| `tZt` | Host-managed path builder (ah.join, pie) |
| `Ome` | Alternate path builder (ah.join, tZt) |
| `Re` | Session record creator (sr, st, qi, jvu, Itt.push, Dte.logError) |
| `G` | Process handle wrapper (calls `i`, `P`) |
| `Mn` | Process cleanup (Error, setTimeout, clearTimeout, s.unref) |
| `xe` | Feature gate checker variant (calls `V`, `Pe`) |
| `oXe` | Memory/OS info collector (prm, jt, Esc.freemem, hrm) |
| `EGe` | File-based artifact manager (_T.lstat/rm/readFile, Gt, mn, msp) |
| `Q` | Promise retirement helper (VZ, $6l) |
| `nt` | Notification tracker (n2t, r2t, tG, k0e.has, aMn, e2t.add, BV, Dt) |
| `dis` | Daemon IPC connector (Dz.claim, W7o, bhe, iqm, sqm, sSr.connect) |
| `gis` | Session lifecycle manager (large; handles roster, file ops, state transitions) |
| `l` | Flc wrapper |
| `h` | Inner function wrapper (calls `f`) |
| `en` | Environment/path helper |
| `z` | Filter/disposal helper (Nn.filter, qr.has) |
| `vgm` | UUID-based session ID generator (C1.randomUUID) |
| `HC` | Session context carrier |
| `ul` | Timeout race wrapper (setTimeout, Promise.race, clearTimeout) |
| `Oxo` | Control output renderer (calls `v_t`, `Oi`) |
| `v_t` | Output stream listener (o.on, i.toString, iq, C_t.jsx) |
| `iq` | JSX element factory helper (Fno, Jno, wre) |
| `Jno` | DOM element creator (D7i.createElement) |
| `wre` | Render component wrapper (rD, Lke, $no) |
| `Oi` | ANSI strip utility (Bun.stripANSI) |
| `eXe` | Plan-write initializer (Dge, kt) |
| `Dge` | Plan data accessor |
| `kt` | File-system path joiner (calls `sw`) |
| `sw` | Path segment combiner |
| `WR` | Plan read/write orchestrator (GR, zt, mn, xo, T, Re) |
| `GR` | Plan file reader (mTe, kt, kz.join, Dy) |
| `mTe` | Plan cache manager (kt, Dge, r.get/set, Dy, N1t, ast, rCn, kz.join, zt) |
| `N1t` | String replacer utility (e.replace) |
| `ast` | String normalizer (O1t) |
| `rCn` | String cleaner (O1t) |
| `mn` | Environment reader (calls `en`) |
| `xo` | Environment writer (calls `en`) |
| `VTe` | Editor launcher (zt, mu.get, vj, t.statSync, CWf, tty controls, QGl.spawnSync, Ax) |
| `vj` | Editor config resolver (HH, TWf) |
| `HH` | Editor config reader |
| `CWf` | Editor validation helper (calls `i4o`) |
| `i4o` | Editor binary checker (YGl, EWf.find, t.includes) |
| `YGl` | Editor name normalizer (e.trim, n.startsWith, lar.basename, yWf.has, r.toLowerCase) |
| `Ax` | Editor binary resolver (e.toLowerCase, ii, YO.basename, pjt) |
| `ii` | String index extractor (e.indexOf, e.slice) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.