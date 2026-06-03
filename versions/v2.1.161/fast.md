---
type: feature-spec
feature: "fast"
cc_version: "2.1.161"
updated: "2026-06-03"
tags: ["fast", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.161 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/fast`

> Analysis basis: CC v2.1.161 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.161

---

## Overview

`/fast` is a local-jsx slash command that toggles **Fast mode** (a research-preview feature that routes inference through a lower-latency path) on or off for the current session. When invoked with an explicit `on` or `off` argument the command applies the change immediately; when invoked with no argument an interactive picker UI is rendered instead, letting the user confirm or cycle through the mode. The handler checks multiple preconditions—API backend type, account tier, organization policy, and network availability—before allowing the toggle.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `fast` |
| description | `Toggle fast mode ( ... )` |
| argumentHint | `[on\|off]` |
| immediate | `null` |
| thinClientDispatch | `control-request` |
| isHidden | `null` |
| module_id | `fs1` |
| load_inline | `true` |
| loc_byte | `12304398` |
| loc_byte_end | `12304670` |
| loc_line | `8547` |
| arbor_handler.name | `uTf` |
| arbor_handler.fqn | `claude-2.1.161::uTf` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `3` |

Analysis basis: CC v2.1.161 bundle.js:+12304398

---

## Input Branching

The command has more than three distinct execution paths depending on argument presence, API backend, account tier, and network state; a flowchart is used.

```mermaid
flowchart TD
    A(["/fast [on|off]"]) --> B{Argument provided?}
    B -- "on / off / yes" --> C{API backend is\nAnthropic direct?}
    B -- no argument --> UI[Render interactive\nFast mode picker UI]

    C -- No --> E1[Return: Fast mode only\navailable with Anthropic API directly]
    C -- Yes --> D{Account tier check}

    D -- "free" --> E2[Return: Fast mode requires\na paid subscription]
    D -- "evaluation / free trial" --> E3[Return: Fast mode unavailable\nduring evaluation – purchase credits]
    D -- "org policy: preference disabled" --> E4[Return: Fast mode disabled\nby your organization]
    D -- "extra_usage_disabled" --> E5[Return: Fast mode requires\nusage credits · /usage-credits]
    D -- SDK / Agent SDK context --> E6[Return: Fast mode unavailable\nin the Agent SDK]
    D -- "pending" org status --> E7[Return: Checking fast mode\navailability – org status pending]
    D -- network_error --> E8[Return: Fast mode unavailable\ndue to network connectivity issues]
    D -- generic unavailable --> E9[Return: Fast mode is currently\nunavailable]
    D -- Available --> F{Argument value}

    F -- "on" / "yes" --> G[Set fastMode = true\nEmit tengu_fast_mode_toggled]
    F -- "off" --> H[Set fastMode = false\nEmit tengu_fast_mode_toggled]

    UI --> I{User action in picker}
    I -- confirm ON --> G
    I -- confirm OFF --> H
    I -- escape / cancel --> J[No change]
    I -- toggle tab --> K[Cycle mode option]

    G --> L[Display confirmation:\nFast mode ON]
    H --> M[Display confirmation:\nFast mode OFF]
```

Analysis basis: CC v2.1.161 bundle.js:+12303432 (handler entry `uTf`), +2221385 (API-backend error string), +2220878 (free-tier check), +2221650 (Agent SDK check), +12303547 ("off" literal)

---

## Behavioral Spec

### 1. Handler entry (`fastCommandHandler`)

The async handler `uTf` is the Arbor-resolved entry point (resolution via `module_id` → `fs1`). It receives the parsed command arguments and the current application state context.

```
async function fastCommandHandler(args, appContext):
    argument = normalizeArgument(args)          // trim + toLowerCase
    availabilityResult = await checkFastModeAvailability(appContext)
    if argument is present:
        return applyFastModeToggle(argument, availabilityResult, appContext)
    else:
        return renderFastModePickerUI(availabilityResult, appContext)
```

Analysis basis: CC v2.1.161 bundle.js:+12303432

---

### 2. API-backend gate (`backendCheck`)

Corresponds to the call edge `uTf → SHH` and the literal "Fast mode is only available when using the Anthropic API directly" at +2221385.

```
function backendCheck(appContext):
    backend = resolveBackend(appContext)   // rK → PA → pH
    if backend in {"bedrock","foundry","anthropicAws","mantle","vertex"}:
        return error("Fast mode is only available when using the Anthropic API directly")
    if backend is "Agent SDK":
        return error("Fast mode unavailable: Fast mode is not available in the Agent SDK")
    return ok
```

Known backend string constants (bundle.js:+2049937–2050154): `"bedrock"`, `"foundry"`, `"anthropicAws"`, `"mantle"`, `"vertex"`, `"firstParty"`, `"gateway"`.

Analysis basis: CC v2.1.161 bundle.js:+2221385, +2221453, +2221650, +2221720

---

### 3. Org / account availability check (`orgAvailabilityCheck`)

Corresponds to call edge `uTf → SHH → N` and the cluster of error-string literals in the +2220878–+2221296 range.

```
function orgAvailabilityCheck(orgStatus, tier, policyFlags):
    if tier == "free":
        return error("Fast mode requires a paid subscription")
    if tier == "evaluation":
        return error("Fast mode unavailable during evaluation. Please purchase credits.")
    if policyFlags.preference == "disabled":
        return error("Fast mode has been disabled by your organization")
    if policyFlags.extra_usage == "extra_usage_disabled":
        return error("Fast mode requires usage credits · /usage-credits to turn them on")
    if orgStatus == "pending":
        log("Checking fast mode availability (org status pending)")
        return error("Fast mode unavailable: Checking fast mode availability (org status pending)")
    if networkState == "network_error":
        return error("Fast mode unavailable due to network connectivity issues")
    if genericUnavailable:
        return error("Fast mode is currently unavailable")
    return available
```

Telemetry: emits `tengu_penguins_off` (bundle.js:+2221491) when the org-level gate fires; emits `tengu_org_penguin_mode_fetch_failed` (bundle.js:+2226575) on network failure during prefetch.

Analysis basis: CC v2.1.161 bundle.js:+2220878, +2220904, +2220945, +2221036, +2221091, +2221217, +2221296, +2221491

---

### 4. Fast mode prefetch (`fastModePrefetch`)

Corresponds to call edge `uTf → SgH`. The prefetch is skipped when a fetch occurred recently ("Skipping fast mode prefetch, fetched recently" at +2225403) or when an in-flight promise already exists ("Fast mode prefetch in progress, returning in-flight promise" at +2225156). Results are cached with status strings `"enabled (cached)"` (+2226502) and `"disabled (network_error)"` (+2226521).

```
async function fastModePrefetch(appContext):
    if inflightPromise exists:
        log("Fast mode prefetch in progress, returning in-flight promise")
        return inflightPromise
    if fetchedRecently():
        log("Skipping fast mode prefetch, fetched recently")
        return cachedResult
    if not authAvailable(appContext):
        return error("No auth available")
    inflightPromise = fetchOrgFastModeStatus(appContext)
    result = await inflightPromise
    cache(result)
    return result
```

Analysis basis: CC v2.1.161 bundle.js:+2225156, +2225403, +2225579, +2226502, +2226521

---

### 5. Applying the toggle (`applyFastModeToggle`)

Corresponds to call edge `uTf → dh8` and literals `"on"` (+26954), `"yes"` (+26948), `"off"` (+12303547), `"active"` (+2223055), `"cooldown"` (+2222597).

```
function applyFastModeToggle(argument, availabilityResult, appContext):
    if availabilityResult is not available:
        return displayError(availabilityResult.message)
    desiredState = (argument in {"on", "yes", "1"}) ? true : false
    if desiredState == true and currentFastMode == true:
        log("Kept Fast mode OFF")        // no-op if already in desired state
        return
    setAppState({ fastMode: desiredState })
    emitTelemetry("tengu_fast_mode_toggled", { state: desiredState })
    displayConfirmation(desiredState ? "Fast mode ON" : "Fast mode OFF")
```

Literals: `"on"` (bundle.js:+26954), `"yes"` (bundle.js:+26948), `"off"` (bundle.js:+12303547), `"Fast mode OFF"` (bundle.js:+12300066), `"ON "` (bundle.js:+12302469), `"OFF"` (bundle.js:+12302475).

Analysis basis: CC v2.1.161 bundle.js:+12303566, +26948, +26954, +12303547, +2222597

---

### 6. Fast mode cooldown (`cooldownHandler`)

After fast mode is automatically disabled (e.g., due to rate-limiting), the runtime monitors a cooldown timer. On expiry it logs "Fast mode cooldown expired, re-enabling fast mode" (+2222650) and re-enables fast mode by updating app state.

```
function onCooldownExpiry(appContext):
    log("Fast mode cooldown expired, re-enabling fast mode")
    setAppState({ fastMode: true })
    emitEvent(Kwq, "cooldown_expired")
```

Analysis basis: CC v2.1.161 bundle.js:+2222597, +2222650

---

### 7. Interactive picker UI (`fastModePickerUI`)

Rendered as a JSX component when no argument is supplied; corresponds to call edges `uTf → Pf.createElement` and the `ch8` component subtree. The picker shows the title `" Fast mode (research preview)"` (+12301693) and current status (ON/OFF). Keyboard mappings registered:

| Key | Action constant | Effect |
|---|---|---|
| `escape` | `cancel` | Dismiss without change |
| `tab` | `toggle` | Cycle mode option |
| `enter` | `confirm` | Apply selected option |

Additional status overlays rendered inside the picker:
- `"overloaded"` state: "Fast mode overloaded and is temporarily unavailable" (+12302641)
- Rate-limit hit: "You've hit your fast limit · resets in `<countdown>`" (+12302695, +12302724)
- Documentation link: `https://code.claude.com/docs/en/fast-mode` (+12302915)

Telemetry: emits `tengu_fast_mode_picker_shown` (+12303657) when picker is rendered.

Analysis basis: CC v2.1.161 bundle.js:+12301693, +12302641, +12302695, +12302915, +12303657

---

### 8. Countdown timer formatting (`countdownFormatter`)

Used by the picker to display the rate-limit reset time. Located at `H9` (+12302743).

```
function formatCountdown(millisRemaining):
    if millisRemaining <= 0:
        return "0s"
    days    = floor(millisRemaining / 86400000)
    hours   = floor(millisRemaining / 3600000) % 24
    minutes = floor((millisRemaining % 3600000) / 60000)
    seconds = round((millisRemaining % 60000) / 1000) % 60
    return buildHumanReadableString(days, hours, minutes, seconds)
```

Constants: `86400000` ms/day (+209473), `3600000` ms/hr (+209507), `60` sec/min (+209580), fallback `"0s"` (+209368).

Analysis basis: CC v2.1.161 bundle.js:+12302743, +209421, +209473, +209507, +209548, +209580

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — `tengu_fast_mode_toggled` | Emitted on every explicit toggle (on or off). bundle.js:+12299841 |
| Telemetry — `tengu_fast_mode_picker_shown` | Emitted when the interactive picker is rendered (no-argument invocation). bundle.js:+12303657 |
| Telemetry — `tengu_penguins_off` | Emitted when the org-level fast-mode gate rejects the request. bundle.js:+2221491 |
| Telemetry — `tengu_org_penguin_mode_fetch_failed` | Emitted when the prefetch network call fails. bundle.js:+2226575 |
| Telemetry — `tengu_feature_ok` / `tengu_feature_sad` / `tengu_feature_bad` | General feature-health signals emitted by the lower-level availability-fetch path. bundle.js:+966587, +966732, +966650 |
| Telemetry — `tengu_config_lock_contention` | Emitted if the global config lock is contested during save. bundle.js:+3249297 |
| Telemetry — `tengu_config_stale_write` / `tengu_config_auth_loss_prevented` | Config-save safety guards. bundle.js:+3249433, +3249776 |
| appState — `fastMode` | Boolean field in the global app-state store toggled by this command. Key literal: `"fastMode"` bundle.js:+12299104 |
| appState — cooldown | A cooldown sub-state (`"cooldown"`) is set when fast mode is auto-disabled; cleared on expiry. bundle.js:+2222597 |
| Hook registration | `tYA.register` called by the `Y9` sub-path to register a settings-persistence hook. bundle.js:+59405 |
| Config persistence | On toggle, the updated `fastMode` value is written to the global config via the locked write path (`Pj_` / `W8`). bundle.js:+3246230, +3249069 |
| Event emission | `RL_.emit` is called after a successful toggle to broadcast the state change to other subsystems. bundle.js:+2226206 |
| Event emission — `Kwq` | Emits on cooldown-expiry re-enable. bundle.js:+2222710 |
| Sound | Not observed in the traversal. |

---

## Version History

| Version | Change |
|---|---|
| v2.1.161 | Initial analysis — `local-jsx` registration, interactive picker, multi-tier availability gating, cooldown support. |

---

## Common Mistakes

1. **Using `/fast` outside the Anthropic direct API**: The command hard-rejects any backend that is Bedrock, Vertex, Foundry, Mantle, Anthropic-AWS, or an agent SDK context. This is enforced before any further check.
2. **Expecting `/fast on` on a free-tier account to succeed**: The availability check gates on paid status; free accounts receive a rejection message before any state mutation occurs.
3. **Assuming the toggle is immediate when the org status is `"pending"`**: The command returns an informational message about checking availability and does not commit a state change.
4. **Running `/fast` without arguments expecting immediate action**: Without `on` or `off`, the command renders an interactive JSX picker and waits for user key input; the terminal must support the interactive rendering layer.
5. **Ignoring the rate-limit cooldown state**: After the fast-limit is hit, fast mode enters a `"cooldown"` sub-state and automatically re-enables once the reset window passes — manual `/fast on` during cooldown may not behave as expected.
6. **Confusing `"Fast mode OFF"` display with a permanent disable**: The toggle only mutates the session's `fastMode` app-state field; it does not write an org-level policy.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `uTf` | Main async handler for `/fast` (Arbor-resolved, `module_id: fs1`) |
| `rK` | Backend/provider resolver utility |
| `PA` | Provider-type lookup helper |
| `pH` | String coercion / primitive cast utility |
| `N` | Org-status / fast-mode availability evaluator |
| `VBK` | Inner availability-check branching function |
| `HwA` | Availability sub-check dispatcher |
| `SH` | JSON.stringify wrapper |
| `Z4` | Model-string normalizer / path extractor |
| `CJA` | Model-family map builder |
| `imH` | Write-to-stream helper |
| `GJA` | Stream write dispatcher |
| `IBK` | Settings persistence / log-rotation coordinator |
| `WmH` | Debounced write scheduler (uses setTimeout / setImmediate) |
| `_3H` | Log-path join and rotate helper |
| `BJA` | Config path builder |
| `UJA` | Atomic file rename helper |
| `NBK` | Append-file / mkdir write path |
| `Y9` | Hook registration caller (`tYA.register`) |
| `ne` | Permission / allow-list check |
| `Ij` | Text replacement sanitizer |
| `lq` | Command argument parser (main parse entry) |
| `xHH` | Argument token dispatcher |
| `nQ` | Model-name token normalizer |
| `s9` | Model-alias resolver |
| `x0` | Alias lookup via `kKH` |
| `NKH` | Model-family inclusion checker (`vKH.includes`) |
| `aN` | Model-variant resolver (Anthropic prefix path) |
| `CgH` | Model-variant resolver (Vf path) |
| `KG` | Full model-string builder (UM + Vf + PA) |
| `Xwq` | Model-string wrapper calling `KG` |
| `UM` | Model-ID normalizer (calls PA) |
| `Us6` | Allowed-model-list gate (`wHL.includes`) |
| `bgH` | Model string → `pH` cast |
| `xP` | Argument parse tree processor |
| `b0` | Argument token combiner (wA, BHH, RzH, xgH, KG, sX, UM, PA, Vf, aN) |
| `t6` | Feature-flag availability fetch (`d` + `h1H`) |
| `h1H` | Feature-flag inner fetch (`Xa8`) |
| `SHH` | Fast-mode pre-check / gating function (API type + org tier) |
| `j6` | Org-fast-mode session resolver |
| `Lq8` | In-flight dedup / cache resolver for org status |
| `ow_` | Org-mode fetch dispatcher (gx + sVH + hU + NdH + UUID + SH + qXL + tr.emit) |
| `Hj_` | Session-token fetch helper |
| `y6` | Config read + watcher setup coordinator |
| `nDH` | Config file reader (readFileSync, statSync, mkdirSync, readdirStringSync) |
| `bXL` | Config file watcher (`Pq8.watchFile` / `unwatchFile`) |
| `m8` | Settings-object builder (xd6 + TQ) |
| `xd6` | Settings cache lookup (IYA + Xe8 + kYA) |
| `IYA` | Cache has/get wrapper (`Cx6`) |
| `kYA` | Cache set wrapper (`Cx6.set`) |
| `Xe8` | Settings parser (qbA + jOH + GQ + HbA + oi) |
| `TQ` | Settings schema validator / transformer |
| `HM6` | Platform-specific settings adapter (wsl / t56 / FX) |
| `DmH` | VS Code integration guard (`claude-vscode` constant) |
| `xs6` | Message formatter (calls `pH`) |
| `SgH` | Fast-mode prefetch / toggle application orchestrator |
| `CL_` | Auth-prefetch coordinator (rK + xs6 + y6) |
| `r9` | Auth resolver (qkA → pH) |
| `qkA` | Auth inner resolver |
| `JW` | Agent-execution entry |
| `e3` | Agent runner (eK + yV + gD6 + jj + DmH + pH + e$6 + Sj + Error + y6 + RR + ZdH) |
| `Sj` | Turn executor (Ya6 + eK + TdH + Wr + yV + pH + LU + Bq + SR + cTH + kCq + yCq) |
| `_HL` | Auth-header builder (Rq + s_.get) |
| `Rq` | OAuth URL builder / validator |
| `zU` | OAuth 401 recovery coordinator (TD_ map + zDL) |
| `zDL` | OAuth refresh / retry dispatcher (w6H + JG + ZK6 + hH + N + RH + String + Wr + O4 + Te + xK6 + yH + Boolean + T3) |
| `l_` | Config load + persist pipeline (BO + F6 + Xe8 + TQ + mX + k8 + x9 + N + Error + oi + wt8 + qTH + Y56 + SH + nz + QQ6 + wx + P_ + hH + t6 + RH + np + yH + WBH.emit) |
| `BO` | Settings bootstrap (jOH + TQ) |
| `jOH` | Config file path resolver (UN.join + bd6 + pM4 + wx + mM4) |
| `mX` | Config object merger (`ai`) |
| `ai` | File-read merge helper (F6 + R$ + N + tg6 + readFileSync + eg6 + L.slice + L.replaceAll) |
| `k8` | Safe fs-error wrapper (`v8`) |
| `v8` | EISDIR error guard |
| `wt8` | Settings timestamp updater (`rQ6.set` + `Date.now`) |
| `qTH` | Settings-path resolver (bd6 + TQ) |
| `bd6` | Settings base-dir resolver (UN.resolve + r8 + UN.dirname) |
| `Y56` | Atomic file writer (openSync + writeFileSync + fchmodSync + fsyncSync + renameSync + unlinkSync + randomBytes) |
| `nz` | Cache invalidation (Cx6.clear + IU8.clear) |
| `QQ6` | Gitignore-aware file writer (h6 + as8 + H.replaceAll + gQ6 + K54 + u1H.dirname + e3H.mkdir + e3H.readFile + dSA + N + cSA + e3H.appendFile + v8 + e3H.writeFile) |
| `gQ6` | Git check-ignore runner |
| `K54` | Global gitignore path resolver |
| `dSA` | Git ls-files check helper |
| `wx` | Claude config dir path builder (UN.join + `".claude"`) |
| `np` | Settings reload wrapper (ZT + C9 + We8 + TQ + bx6) |
| `C9` | Memory-usage sampler |
| `We8` | Full settings-load pipeline (Date.now + j8 + xx6 + oi + e56 + qbA + L set + jOH + UN.resolve + GQ + HbA) |
| `W8` | Global config save (Pj_ + S0 + H + McH + icq + $cH + N + nDH + iY6 + d + Jj_) |
| `Pj_` | Locked config-file writer (RY.dirname + F6 + mkdirSync + Date.now + qjq + N + d + S0 + statSync + v8 + nDH + iY6 + A + v0 + SH + basename + Xj_ + readdirStringSync + Number + X.split + Number.isNaN + RY.join + copyFileSync + Z.slice + unlinkSync + Y56 + f) |
| `Jj_` | Fallback config writer (RY.dirname + F6 + v0 + SH + Y56) |
| `qjq` | Config-object merger (Y7_ + Object.assign) |
| `Xj_` | Backup path builder (RY.join + r8) |
| `McH` | Config read before write |
| `icq` | Config entries iterator (Object.entries) |
| `$cH` | Config timestamp recorder (Date.now) |
| `dh8` | Toggle dispatcher / JSX render coordinator (SHH + Qh8 + d + VWH + a3 + OU + lq + _9 + CR + aTH) |
| `Qh8` | Picker state initializer (yzH + l_ + rE + OL + hgH + vWH + _ + a3 + s9 + b0) |
| `vWH` | App-settings accessor (String + Number + Boolean coercions) |
| `yzH` | Initial fast-mode state reader |
| `rE` | Settings read helper → `OL` |
| `OL` | Settings field accessor (`WEH`) |
| `hgH` | Mode-picker option builder (`sX`) |
| `sX` | Option-item constructor (kKH + yKH + PA + wA + a9) |
| `a3` | Argument validator for fast toggle (rK + b0 + s9 + q.includes) |
| `VWH` | UI configuration accessor (cx + h4 + w6.dim + WA) |
| `cx` | Theme resolver (Xw6 + O98 + sDH + Yiq) |
| `O98` | Theme-name inclusion check (`Pt8.includes`) |
| `sDH` | Theme prefix stripper |
| `h4` | Settings + legacy-config reader (JV + m8 + lgH.includes + y6) |
| `JV` | Model-set tracker (mK6 + _.add + hP.filter + _.has) |
| `WA` | Foreground color resolver (H.startsWith + LYH + yd) |
| `LYH` | ANSI color-name → chalk mapper (full color alphabet) |
| `OU` | Output utility (formatting) |
| `_9` | Token-type classifiers (Aa6 + bP + H.includes + kF8 + Ij) |
| `Aa6` | Provider-entry iterator (t_ + Object.entries) |
| `t_` | Settings-loader entry (`np`) |
| `bP` | Token string normalizer (toLowerCase + includes + replace) |
| `CR` | Number formatter (jwq) |
| `jwq` | Integer / decimal formatter (Number.isInteger + H.toFixed) |
| `aTH` | Display row builder (rK + _9) |
| `ch8` | Main JSX component for fast-mode UI (Ks1.c + $6 + qA + useState + Symbol.for + SL_ + lq + _9 + CR + aTH + Qh8 + d + VWH + a3 + OU + A + f + $ + XA + Pf.createElement + H9 + Date.now) |
| `$6` | App-state store selector |
| `n2_` | App-state context consumer (yYH.useContext + ReferenceError) |
| `qA` | Secondary app-state selector |
| `SL_` | Fast-mode cooldown timer / re-enable trigger (Date.now + rK + N + Kwq.emit) |
| `$` | Telemetry flush / event helper (y_K) |
| `y_K` | Telemetry event emitter (Zr + Date.now + $1 + Fh6 + SH) |
| `Zr` | Telemetry event formatter (hKH) |
| `hKH` | Event-name sanitizer (HHH + _.trim) |
| `$1` | Async-context store reader (yRL.getStore) |
| `Fh6` | Telemetry path builder (k_K.join + r8) |
| `XA` | Keyboard handler registrar (pj + dYH.useRef + Object.keys + dYH.useEffect + M.push + K.registerHandler + $) |
| `pj` | Key-binding context reader (QYH.useContext) |
| `M` | Plugin / staging path manager (nC6 + f.has + w0.rm) |
| `nC6` | Path normalizer (H.replace + _.toLowerCase + Error + iC6 + ck.join + ck.relative + ck.isAbsolute + L.startsWith) |
| `iC6` | Plugin path builder (ck.join + r8) |
| `H9` | Countdown timer display formatter (Math.floor + Math.round) |
| `F6` | Generic error constructor |
| `d` | Promise / async utility |
| `f` | File-handle utility (A.close + q.close + L) |
| `L` | Set-with-cleanup utility (q.add + f.finally + q.delete) |
| `V` | Prefix/startsWith guard |
| `X` | Text-input component (p1.fromText + J + j + H.onChange + z.setOffset + D + h.slice + w + lfA + C.execute) |
| `Z` | Slice target (array or string) |
| `K` | Column layout mapper (L.map + f.padEnd) |
| `SH` | JSON.stringify wrapper (shared alias) |
| `Bq` | Render helper |
| `VV` | Array/includes type guard |
| `RR` | Slice-20-char helper (H.slice at +2113671, constant `20` at +2113680) |
| `gD6` | Tool-result handler |
| `jj` | Message-list reducer |
| `e$6` | File-descriptor API-key reader (`CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR`) |
| `yV` | Model-output validator (eK + m8 + VA) |
| `eK` | Turn-result inspector (pH) |
| `gx` | gRPC / streaming transport |
| `Qx` | Streaming request builder (pH + gx) |
| `gY6` | Session-init helper |
| `QY6` | Session-capability checker |
| `ow_` | Org-fetch network call (see above) |
| `Hj_` | Auth-session resolver (lCq + t_ + xcq + ne) |
| `iY6` | Config integrity validator |
| `v0` | Config backup writer |
| `r8` | Path-segment joiner |
| `N6` | Path existence checker |
| `d46` | Error-code mapper (`v8`) |
| `ZT` | Settings reload throttle gate |
| `bx6` | Post-reload side-effect trigger |
| `as8` | Git ignore-file reader (`F4`) |
| `h6` | Git helper bootstrapper (sg6 + P_) |
| `cSA` | Gitignore append-only writer |
| `oi` | Object-key validator |
| `GQ` | Settings schema applicator |
| `HbA` | Flag-settings applicator |
| `qbA` | Policy-settings applicator |
| `P_` | Process spawner (`XN`) |
| `sg6` | Git executable finder |
| `h_` | File path helper |
| `dSA` | Git ls-files already-tracked checker |
| `mM4` | Local-settings path builder |
| `pM4` | Project-settings path builder |
| `wx` | Claude dir path builder |
| `UN` | Node `path` module alias |
| `Ay` | Node `fs/promises` alias |
| `wSK` | Sync-fs alias (unlinkSync) |
| `ATH` | Path utility alias (dirname) |
| `e3H` | Async-fs alias (mkdir, readFile, appendFile, writeFile) |
| `K$` | Sync-fs alias (openSync, closeSync, writeFileSync, fchmodSync, fsyncSync) |
| `RY` | Path module alias (dirname, basename, join) |
| `z5` | Path module alias (isAbsolute, resolve, dirname) |
| `u1H` | Path module alias (join, isAbsolute) used in gitignore resolution |
| `_t8` | OS module alias (homedir) |
| `Pq8` | fs alias (watchFile, unwatchFile) |
| `Qa8` | crypto alias (randomBytes) |
| `nw_` | crypto alias (randomUUID) |
| `TD_` | OAuth token refresh-state map |
| `aw_` | In-flight org-fetch dedup Set |
| `QDH` | Org-session cache Map |
| `BY6` | Processed-session tracking Set |
| `CU` | Org-session result Map |
| `WBH` | App event emitter |
| `RL_` | Toggle-result event emitter |
| `Kwq` | Cooldown-expiry event emitter |
| `tYA` | Hook registry |
| `s_` | Axios / HTTP client |
| `Pf` | React alias (createElement) |
| `Ls1` | React hooks alias (useState) |
| `dYH` | React hooks alias (useRef, useEffect) |
| `yYH` | React context alias (useContext, useSyncExternalStore) |
| `QYH` | Key-binding context |
| `Ks1` | Component library (`.c` = styled component) |
| `w6` | Chalk / color library |
| `p1` | Text-model library (fromText) |
| `oJA` | Memory-usage sample dedup Set |
| `vQ8` | Memory-usage sample array |
| `rQ6` | Settings timestamp Map |
| `IU8` | Secondary settings cache |
| `Cx6` | Primary settings cache Map |
| `WA4` | Allow-list Map |
| `vKH` | Allowed-model-family list |
| `wHL` | Allowed-model-string list |
| `lgH` | Legacy-global-config key list |
| `Pt8` | Allowed-theme list |
| `yRL` | AsyncLocalStorage for telemetry context |
| `k_K` | Telemetry path segments array |
| `IEL` / `NEL` | Color-code regex patterns |
| `tWL` | Theme default constant |
| `Rg6` | Approved OAuth endpoint list |
| `hP` | Model-set filter source |
| `rNA` | OAuth base URL constant |
| `QK4` | OAuth staging URL constant |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.