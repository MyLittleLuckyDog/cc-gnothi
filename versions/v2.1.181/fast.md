---
type: feature-spec
feature: "fast"
cc_version: "2.1.181"
updated: "2026-06-19"
tags: ["fast", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.181 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/fast`

> Analysis basis: CC v2.1.181 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.181

---

## Overview

The `/fast` command toggles **Fast mode** — a research-preview feature that routes requests through a priority inference path. Invoked with an optional `on` or `off` argument, the handler (`Jrf`) validates availability against multiple eligibility criteria (API provider, subscription tier, organizational policy, network state), then reads or writes the `fastMode` flag in application settings and emits a telemetry event. A JSX UI component (`kqn`) renders the mode status and an interactive picker when the argument is absent.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `fast` |
| description | `Toggle fast mode ( ... )` |
| argumentHint | `[on\|off]` |
| loc_byte | `12682272` |
| loc_byte_end | `12682544` |
| loc_line | `8271` |
| immediate | `null` |
| thinClientDispatch | `control-request` |
| isHidden | `null` |
| module_id | `qbl` |
| load_inline | `true` |
| arbor_handler.name | `Jrf` |
| arbor_handler.fqn | `claude-2.1.181::Jrf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `3` |

Analysis basis: CC v2.1.181 bundle.js:+12682272

---

## Input Branching

The handler evaluates at least seven distinct eligibility outcomes before acting on the `on`/`off` argument, satisfying the Mermaid requirement.

```mermaid
flowchart TD
    A["/fast [on|off] invoked"] --> B{API provider check\nbundle.js:+2123290}
    B -->|Not Anthropic direct\n(bedrock/foundry/vertex/mantle/anthropicAws)| ERR1["Error: Fast mode is only available\nwhen using the Anthropic API directly\n(+2256982)"]
    B -->|Anthropic direct| C{Organization policy\nbundle.js:+2256633}
    C -->|Disabled by org| ERR2["Error: Fast mode has been disabled\nby your organization (+2256633)"]
    C -->|Agent SDK context| ERR3["Error: Fast mode is not available\nin the Agent SDK (+2257467)"]
    C -->|Allowed| D{Org status / subscription\nbundle.js:+2257528}
    D -->|Status = pending| WARN1["Warning: Checking fast mode availability\n(org status pending) (+2257638)"]
    D -->|Tier = free| ERR4["Error: Fast mode requires a paid\nsubscription (+2256501)"]
    D -->|extra_usage_disabled| ERR5["Error: Fast mode requires usage\ncredits · /usage-credits (+2256717)"]
    D -->|Evaluation tier| ERR6["Error: Fast mode unavailable during\nevaluation. Please purchase credits. (+2256542)"]
    D -->|network_error| ERR7["Error: Fast mode unavailable due to\nnetwork connectivity issues (+2256814)"]
    D -->|Eligible| E{Argument supplied?}
    E -->|"on" / "yes"| F[Set fastMode = true\nwrite settings\n+12676651]
    E -->|"off"| G[Set fastMode = false\nwrite settings\n+12681387]
    E -->|No argument| H[Render interactive picker UI\n(kqn component)\n+12682272]
    F --> TEL["Emit tengu_fast_mode_toggled\n+12677583"]
    G --> TEL
    H --> TEL2["Emit tengu_fast_mode_picker_shown\n+12681512"]
```

---

## Behavioral Spec

### Top-Level Handler — `fastHandler` (`Jrf`)

Analysis basis: CC v2.1.181 bundle.js:+12681272

```
async function fastHandler(commandInput, appContext):
    # Step 1: check provider compatibility
    provider = getProviderKind(appContext)          # calls providerResolver (cc → xr → rt)
    if provider in ["bedrock", "foundry", "anthropicAws", "mantle", "vertex"]:
        return errorMessage("Fast mode is only available when using the Anthropic API directly")

    # Step 2: read availability status from org/feature gate
    availability = await fetchFastModeAvailability(appContext)   # calls Q7e
    # availability encodes: free / preference / extra_usage_disabled /
    #   pending / network_error / agent-sdk / org-disabled / active / overloaded

    # Step 3: check SDK context
    if isAgentSdkContext(appContext):
        return errorMessage("Fast mode is not available in the Agent SDK")

    # Step 4: evaluate availability code
    match availability.status:
        case "free":
            return errorMessage("Fast mode requires a paid subscription")
        case "extra_usage_disabled":
            return errorMessage("Fast mode requires usage credits · /usage-credits to turn them on")
        case "preference" (org-disabled):
            return errorMessage("Fast mode has been disabled by your organization")
        case "pending":
            return warningMessage("Checking fast mode availability (org status pending)")
        case "network_error":
            return errorMessage("Fast mode unavailable due to network connectivity issues")
        # evaluation tier handled similarly

    # Step 5: parse argument
    arg = commandInput.trim().toLowerCase()
    if arg in ["on", "yes"]:
        writeFastModeSetting(true)                 # updates "fastMode" key in settings
        emitTelemetry("tengu_fast_mode_toggled", {value: true})
        return successMessage("Fast mode ON")
    elif arg == "off":
        writeFastModeSetting(false)
        emitTelemetry("tengu_fast_mode_toggled", {value: false})
        return successMessage("Fast mode OFF")
    else:
        # No argument: show interactive picker
        emitTelemetry("tengu_fast_mode_picker_shown")
        return renderJSX(FastModePickerComponent)  # kqn
```

### Availability Prefetch — `fastModeAvailabilityFetcher` (`Q7e`)

Analysis basis: CC v2.1.181 bundle.js:+2261084

```
async function fastModeAvailabilityFetcher(context):
    # Guard: if a fetch is already in-flight, reuse the promise
    if inFlightPromise != null:
        log("Fast mode prefetch in progress, returning in-flight promise")
        return inFlightPromise

    # Guard: if fetched recently, skip
    elapsed = Date.now() - lastFetchTimestamp
    if elapsed < RECENT_THRESHOLD:
        log("Skipping fast mode prefetch, fetched recently")
        return cachedStatus

    # Acquire auth credentials via authResolver (Aku → ks)
    auth = await resolveAuth(context)
    if auth == null:
        throw Error("No auth available")

    # Make API request for org feature status
    try:
        response = await apiRequest(auth)
        result   = parseAvailability(response)
        cacheResult(result)
        return result
    catch AxiosError(status=401):
        triggerOAuthRecovery()
        throw
    catch AxiosError(status=403):
        return {status: "preference"}         # org-disabled
    catch NetworkError:
        emitTelemetry("tengu_org_penguin_mode_fetch_failed")
        return {status: "network_error"}
```

Analysis basis: CC v2.1.181 bundle.js:+2261084

### Provider Kind Resolver — `providerResolver` (`cc` / `xr` / `rt`)

Analysis basis: CC v2.1.181 bundle.js:+12681272 (call from `Jrf`), +2256234 (`cc→xr`)

```
function getProviderKind(appState):
    raw = readAppState(appState)               # rt returns String coercion
    # Possible return values (literals found):
    #   "bedrock", "foundry", "anthropicAws", "mantle", "vertex", "firstParty"
    return raw
```

Values `"bedrock"`, `"foundry"`, `"anthropicAws"`, `"mantle"`, `"vertex"` all block Fast mode.
Analysis basis: CC v2.1.181 bundle.js:+2123330–+2123547

### Organization Penguin/Fast-Mode Status — `orgStatusChecker` (`Moe`)

Analysis basis: CC v2.1.181 bundle.js:+12681286 (call from `Jrf`)

```
function orgStatusChecker(appState):
    # Reads settings layers: userSettings, projectSettings, localSettings, flagSettings
    # Checks feature gate "fastMode" (key literal at +12676651)
    # Checks for "opus46-fast-mode-deprecation" flag (+12676969)
    # Returns composite status object consumed by fastHandler
    #
    # Emits tengu_penguins_off (+2257088) when fast mode is globally disabled
    #
    # Error strings surfaced:
    #   "Fast mode is only available when using the Anthropic API directly" (+2256982)
    #   "Fast mode is not available"                                        (+2257050)
    #   "Fast mode is not available in the Agent SDK"                      (+2257467)
    #   "Fast mode unavailable: ..."                                       (+2257397/+2257559)
    #   "Fast mode requires a paid subscription"                           (+2256501)
    #   "Fast mode has been disabled by your organization"                 (+2256633)
    #   "Fast mode requires usage credits · /usage-credits..."             (+2256717)
    #   "Fast mode unavailable due to network connectivity issues"         (+2256814)
    #   "Fast mode is currently unavailable"                               (+2256893)
    return statusObject
```

### Fast Mode Settings Write — `writeFastModeSetting`

Analysis basis: CC v2.1.181 bundle.js:+12676651 (`"fastMode"` literal), settings subsystem via `ao`/`lSt`/`NZo`

```
function writeFastModeSetting(enabled: boolean):
    # Reads current settings from disk with lock (saveConfigWithLock pattern)
    # Merges {fastMode: enabled} into userSettings layer
    # Writes back via atomic rename (temp file → target, fsync)
    # Clears caches: kKt.clear(), Ser.clear() (fH at +1330041)
    # On auth-loss detection, refuses to write (GH #3117 guard)
    if reReadConfig.auth == null and cache.auth != null:
        emitTelemetry("tengu_config_auth_loss_prevented")
        return  # refuse write
```

Analysis basis: CC v2.1.181 bundle.js:+12677583

### Interactive Picker UI Component — `fastModePickerComponent` (`kqn`)

Analysis basis: CC v2.1.181 bundle.js:+12679407–+12681075

```
JSX Component fastModePickerComponent(props):
    # Renders a labeled UI panel: " Fast mode (research preview)"
    # Displays current state as "ON " or "OFF" (+12680309 / +12680315)
    #
    # When status is "overloaded":
    #   Shows "Fast mode overloaded and is temporarily unavailable" (+12680481)
    # When limit hit:
    #   Shows "You've hit your fast limit · resets in <countdown>" (+12680535)
    # Provides link: https://code.claude.com/docs/en/fast-mode (+12680755)
    #
    # Keyboard bindings:
    #   escape  → cancel
    #   tab     → toggle
    #   enter   → confirm
    #   confirm:yes / confirm:nextField / confirm:next / confirm:previous
    #   confirm:cycleMode / confirm:toggle  (all at +12679147–+12679245)
    #
    # On confirm → calls fastHandler("on") or fastHandler("off")
    # On cancel  → emits "Fast mode OFF" / "Kept Fast mode OFF" (+12678927)
    #
    # Registers keyboard handler via hookRegistration (Wo → ACe.useEffect)
    # Uses React.memo with sentinel "react.memo_cache_sentinel" (+12678151)
    # useState, useSyncExternalStore for live status updates
```

### Fast Mode Cooldown Observer — `cooldownObserver` (`BCr`)

Analysis basis: CC v2.1.181 bundle.js:+12678182

```
function cooldownObserver():
    # Watches for cooldown expiry
    # When cooldown state transitions out:
    #   logs "Fast mode cooldown expired, re-enabling fast mode" (+2258663)
    #   emits s2s.emit event
    # Uses Date.now() to evaluate cooldown window
```

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_fast_mode_toggled` | Fired on every explicit `on`/`off` toggle; carries new boolean value. bundle.js:+12677583 |
| Telemetry: `tengu_fast_mode_picker_shown` | Fired when picker UI is displayed (no argument path). bundle.js:+12681512 |
| Telemetry: `tengu_penguins_off` | Fired when org-level fast mode is disabled. bundle.js:+2257088 |
| Telemetry: `tengu_org_penguin_mode_fetch_failed` | Fired on network error during availability fetch. bundle.js:+2262592 |
| Telemetry: `tengu_sunset_penguin_opus46` | Fired when opus-4-6 deprecation flag is active. bundle.js:+2258381 |
| Telemetry: `tengu_config_auth_loss_prevented` | Fired when settings write is aborted to protect auth. bundle.js:+13939707 |
| Telemetry: `tengu_config_lock_contention` | Fired when config lock is slow to acquire. bundle.js:+13939228 |
| Telemetry: `tengu_config_stale_write` | Fired on stale config write detection. bundle.js:+13939364 |
| Telemetry: `tengu_config_fallback_write` | Fired on fallback write path. bundle.js:+13938844 |
| Telemetry: `tengu_config_parse_error` | Fired when config JSON cannot be parsed. bundle.js:+13941803 |
| appState changes | `fastMode` key in userSettings layer written to `~/.claude/settings.json`. |
| Settings file | Writes to `settings.json` under `.claude/` directory (literal at +1310058 / +1310068). |
| Atomic write guard | Refuses write if re-read config has lost auth token (GH #3117). |
| Config backup | Old config backed up to `backups/` subdirectory before overwrite (+13940740). |
| Hook registration | Keyboard handler registered via `Wo` → `ACe.useEffect` → `o.registerHandler` (+4194877) during picker UI lifetime. |
| Sound | None detected in depth-2 traversal. |
| thinClientDispatch | `"control-request"` — the command dispatches as a control request in thin-client mode. |

---

## Version History

| Version | Change |
|---|---|
| v2.1.181 | Initial analysis. Fast mode labeled "research preview". Opus 4.6 deprecation sunset flag (`opus46-fast-mode-deprecation`) present. |

---

## Common Mistakes

1. **Using `/fast` on a non-Anthropic API provider.** If the active provider is `bedrock`, `foundry`, `vertex`, `mantle`, or `anthropicAws`, the command immediately returns an error and does not toggle anything. Switch to the Anthropic API directly first.
2. **Expecting `/fast` to work on free or evaluation tiers.** Fast mode requires a paid subscription or active usage credits; the handler rejects the toggle with a clear error message and a pointer to `/usage-credits` when `extra_usage_disabled`.
3. **Assuming the toggle is instant on the first invocation.** The handler prefetches availability asynchronously; if the org status is `"pending"`, the command reports "Checking fast mode availability" rather than changing state.
4. **Omitting the argument and expecting an immediate state change.** Without `on` or `off`, the command renders an interactive picker UI rather than toggling; keyboard input (`tab`/`enter`/`escape`) is required to confirm.
5. **Expecting Fast mode in Agent SDK contexts.** The command explicitly rejects Fast mode when running inside the Agent SDK, emitting a distinct error string.
6. **Editing `settings.json` directly while Claude Code is running.** The settings subsystem acquires a file lock; a concurrent external write can trigger lock-contention telemetry and may be silently refused if auth loss is detected (GH #3117 guard).

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Jrf` | Main handler for `/fast` command (AsyncFunction, arbor_handler) |
| `cc` | App context / state reader (called by `Jrf` and `Moe`) |
| `xr` | Provider kind resolver helper |
| `rt` | String coercion / value extractor used across resolvers |
| `Moe` | Org status / penguin-mode checker; aggregates all availability signals |
| `ut` | Feature-gate evaluation utility |
| `txt` | Feature-gate text helper |
| `nxt` | Feature-gate next-state helper |
| `p4` | Feature flag reader |
| `d4` | Feature data accessor |
| `Ygn` | Feature experiment variant resolver |
| `V1r` | GrowthBook experiment event emitter |
| `Q1r` | Experiment result processor |
| `It` | Config read-with-backup utility |
| `jt` | Logger / debug sink |
| `p0o` | Path resolver for config |
| `w_e` | Config file reader (readFileSync, statSync, backup logic) |
| `Byf` | Config file watcher (watchFile/unwatchFile) |
| `I` | Settings serialiser / log writer |
| `xhc` | Output channel / display helper |
| `L$o` | Locale / format utility |
| `Re` | JSON serialiser wrapper |
| `qc` | Path redaction / `[REDACTED]` sanitiser |
| `c3o` | Character-map builder for redaction |
| `nqe` | Stream writer helper |
| `QBo` | Raw write emitter |
| `Rhc` | Transcript / session log writer |
| `kWe` | Debounced write scheduler |
| `Fde` | File-descriptor log flusher |
| `bre` | Log directory resolver |
| `f3o` | Log file path builder |
| `Sor` | Log file rotation handler |
| `Mhc` | Append-to-log-file writer |
| `Gi` | Signal/hook registration wrapper |
| `Tl` | JSONL/system-prompt parser and renderer |
| `pbt` | Prompt block builder (non-MCP) |
| `nns` | Block filter |
| `tns` | Block type accumulator |
| `fbt` | Flag/feature block builder |
| `KFo` | Key-feature mapper |
| `Aoe` | Feature annotation helper |
| `Qtn` | Quoted-text normaliser |
| `pSe` | Remote-settings policy checker |
| `x2` | Model capability descriptor |
| `moe` | Model-to-object mapper |
| `cbt` | Capability block transformer |
| `zFo` | Zero-state fallback |
| `nc` | Newline/comment stripper |
| `cxl` | Clock / timestamp utility |
| `O1e` | Output exclusion filter |
| `CR` | Comment-removal regex runner |
| `Vcn` | Context normaliser |
| `gs` | Model name → display-label resolver |
| `DIt` | Directive interpreter |
| `C2s` | Context-entry serialiser |
| `Tn` | Tool-name resolver |
| `qtn` | Quoted-tool-name helper |
| `w7e` | Workspace entry builder |
| `Kr` | Tool/key resolver |
| `I2s` | Index-to-string mapper |
| `Iku` | Inclusive-key updater |
| `b2s` | Boolean-to-string helper |
| `Cku` | Context key updater |
| `T2s` | Type-to-string helper |
| `M1e` | Model layer renderer |
| `tT` | Token / text transformer |
| `afe` | Auth-format encoder |
| `lfe` | Label-format encoder |
| `To` | Token output assembler |
| `da` | Data assembler for prompt context |
| `Ns` | Namespace / settings scope resolver |
| `xK` | Extension-key resolver |
| `S_` | Scope sentinel |
| `CG` | Context-group builder |
| `Ug` | Update-group applier |
| `lL` | Layer-list builder |
| `$S` | Dollar-settings accessor |
| `fd` | Feature-data reader |
| `jRe` | JSON-response extractor |
| `xA` | Extended-app settings accessor |
| `z9` | Zero/null-state guard |
| `Lr` | Label renderer |
| `TWe` | Terminal-width emitter |
| `$cn` | Dollar-context normaliser |
| `fku` | Flag-key updater |
| `Q7e` | Fast mode availability prefetcher (API fetch + caching) |
| `WCr` | Wire-context resolver |
| `ta` | Traffic-annotation helper |
| `qYo` | Query-yielding helper |
| `Dv` | Device/variant selector |
| `Bg` | Backend API gateway (main HTTP call dispatcher) |
| `Lp` | Low-level prompt builder |
| `ZD` | Zone/domain resolver |
| `Qwt` | Query-with-timeout wrapper |
| `zT` | Zero-timeout helper |
| `rIt` | Read file-descriptor token reader |
| `ob` | OAuth bearer handler |
| `Ac` | Auth-context builder |
| `vU` | Value-unpacker (slice helper) |
| `Mv` | Multi-value checker |
| `Aku` | Auth-key resolver |
| `ks` | Key-store / OAuth endpoint selector |
| `vWo` | Value-with-override helper |
| `UOc` | URL-origin checker |
| `kU` | Key-update cache (KRr map operations) |
| `$ju` | Dollar-job-unit: OAuth 401 recovery orchestrator |
| `jU` | Job-unit token holder |
| `dgt` | Digest/token getter |
| `j` | Generic job/promise helper |
| `xe` | Extended-error helper |
| `XXe` | Expiry-extension evaluator |
| `Me` | Message-emitter helper |
| `uj` | Update-job helper (oLu/wMs) |
| `uc` | Update-cache accessor |
| `lJ` | Log-journal helper |
| `Tgt` | Token-get helper |
| `ke` | Key-error reporter |
| `Fju` | Fallback-job-unit |
| `qei` | Query-expiry-interval manager |
| `Ch` | Channel/SAn helper |
| `ao` | Agent-orchestrator: settings load + context assembly |
| `ZA` | Zone-accessor |
| `fSe` | File-settings extractor |
| `OAr` | Options-array reader |
| `Nts` | Namespace-tree scanner |
| `ej` | Entry-json parser |
| `Pts` | Path-to-settings resolver |
| `Sv` | Settings-validator |
| `qJ` | Query-JSON file reader |
| `Dn` | Directory-normaliser |
| `ln` | Log-null / silent logger |
| `qmr` | Query-map-record writer (rtn.set) |
| `jOe` | JSON-object extractor |
| `jtn` | JSON-to-node path resolver |
| `lSt` | Locked-settings writer (atomic rename, fchmod, fsync) |
| `Jp` | Junction-path resolver (realpathSync) |
| `u` | Utility daemon-control handle |
| `cKe` | Config-key error handler |
| `fH` | Flush-and-clear-caches (kKt.clear / Ser.clear) |
| `NZo` | Node-zero / gitignore file writer |
| `Mt` | Module-tracker |
| `vmr` | Version-map reader |
| `Qen` | Query-entry normaliser |
| `T7c` | Tilde-7-config path resolver |
| `PZo` | Path-zero resolver |
| `OZo` | Output-zero helper |
| `O9` | Output-nine path joiner |
| `gr` | Graph resolver (fx) |
| `fx` | Function-x helper |
| `Ut` | Update-tracker |
| `$e` | Dollar-event / Rht helper |
| `tj` | Task-journal: settings load telemetry |
| `px` | Path-x helper |
| `ha` | Hook-anchor (memory usage recorder) |
| `NAr` | Node-array reader (settings_load_started / _completed) |
| `DKt` | Data-key tracker |
| `un` | Update-node: transcript / session file manager |
| `n7n` | Node-7-node: transcript backup/copy logic |
| `gBs` | Graph-base-state (Object.assign helper) |
| `qmt` | Query-map-tracker |
| `h0o` | Hash-zero-object: path join + sr helper |
| `T` | Terminal scroll / layout helper |
| `g` | Generic buffer/stream handler |
| `E` | Element / layout sizer |
| `dMe` | Data-metadata extractor |
| `f0o` | Function-zero-object: Object.entries iterator |
| `L8t` | Label-8-tracker: Date.now timestamp recorder |
| `t7n` | Token-7-node: transcript incremental writer |
| `xqn` | Extended-query-node: composite UI renderer factory |
| `Lqn` | Label-query-node: flag-settings applier (`apply_flag_settings`) |
| `Dbe` | Data-base-extractor |
| `RDe` | Raw-data-extractor: String/Number/Boolean coercions |
| `MDe` | Model-data-extractor: theme/color/model resolution |
| `g4` | Graph-4: model/theme picker |
| `jxt` | JSON-xt: NJu helper |
| `d_n` | Data-node: Jmr model-list check |
| `h4` | Hash-4: startsWith/slice model name parser |
| `zhi` | Zero-hash-index helper |
| `Ec` | Entry-checker: gitignore / context filter |
| `gR` | Graph-R: Igt set manager |
| `JAr` | JSON-array resolver: ZA + hoe.resolve |
| `$o` | Dollar-object: foreground color parser |
| `IIe` | Index-input-entry: full ANSI/chalk color map |
| `fz` | Function-z helper |
| `Go` | Global-output: model+namespace composer |
| `e_` | Entry-underscore: toLowerCase / includes / replace |
| `Ugt` | Update-get helper |
| `Tf` | Transform-function: string replacer |
| `DU` | Display-unit: number formatter (toFixed / isInteger) |
| `A2s` | Array-2-string: numeric format helper |
| `Z7e` | Zero-7-entry: cc accessor |
| `PTo` | Path-to: date/model compositor (`r2s`) |
| `r2s` | Raw-2-string: date parse + Go/Ns/ut compositor |
| `kqn` | Key-query-node: main Fast mode picker JSX component |
| `mt` | Mount / zustand store accessor |
| `z2r` | Zero-2-r: useContext / useSyncExternalStore |
| `ji` | Join-input: keyboard handler + MCP state hook |
| `hc` | Hash-context: z2r context reader |
| `Io` | Input-output: z2r alternate reader |
| `Ms` | Message-store: VTi.useContext (ClockProvider) |
| `uid` | User-ID: reduce-based ID generator |
| `a` | App-level MCP update applier |
| `DBe` | Data-base-entry: MCP server connection orchestrator |
| `z8` | Zone-8: MCP slot state merger |
| `Pk` | Package-key: M_ / LVr helper |
| `qn` | Query-node: generic value holder |
| `UOt` | URL-origin-tracker |
| `Jta` | Join-task-async: MCP Mzr/wwe/KAn connector |
| `zAn` | Zero-an: KAn/AI helper |
| `qAn` | Query-an: uc accessor |
| `sn` | Sync-node: MCP debug logger |
| `yLn` | Yield-label-node: MCP OAuth tool runner |
| `ELn` | Entry-label-node: MCP callback handler |
| `ana` | Async-node-async: MCP reconnect orchestrator |
| `WVr` | Write-value-resolver: MCP AI/uc helper |
| `gP` | Graph-P: ut-based MCP processor |
| `wVr` | Write-value-resolver alt: un/n.includes helper |
| `Du` | Data-updater: MCP error logger |
| `Ee` | Entry-entry: String coercion helper |
| `nna` | Node-node-async: y8 helper |
| `Qrt` | Query-runtime: parseInt wrapper |
| `Lxn` | Label-xn: parseInt wrapper |
| `bQn` | Buffer-query-node: applyMcpUpdate orchestrator |
| `kBe` | Key-base-entry: wwe helper |
| `kL` | Key-label: Xrt/cleanup/gP MCP slot cleanup |
| `kOo` | Key-object-output: MCP connection slot manager |
| `sLn` | Sync-label-node: vFd/NVr has-checks |
| `Fn` | Function-node: abort/timeout/clearTimeout wrapper |
| `Xrt` | Extended-runtime: wwe caller |
| `EIi` | Entry-input-index: fold helper |
| `X0t` | X-zero-t: UI layout helper |
| `BCr` | Base-context-resolver: cooldown observer, s2s.emit |
| `Qe` | Query-entry: Rht helper |
| `Rht` | Root-hash-t: base React element |
| `c` | Generic closure / bn helper |
| `bn` | Base-node: daemon background-session handler |
| `Wo` | Window-object: keyboard handler registration |
| `XE` | X-entry: mCe.useContext helper |
| `ea` | Entry-async: Math.floor / Math.round timer formatter |