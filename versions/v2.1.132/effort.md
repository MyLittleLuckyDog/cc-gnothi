---
type: feature-spec
feature: "effort"
cc_version: "2.1.132"
updated: "2026-05-31"
tags: ["effort", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.132 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/effort`

> Analysis basis: CC v2.1.132 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.132

---

## Overview

The `/effort` slash command allows users to set the reasoning/effort level that Claude Code applies when processing tasks. It accepts a named level (`low`, `medium`, `high`, `xhigh`, `max`, or `auto`) or the special token `unset`, validates the input, persists the selection to configuration, and returns a JSX status view reflecting the current setting. When operating over a remote transport that cannot propagate effort to the server, the command applies the setting locally only and annotates the response accordingly.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `effort` |
| description | `Set effort level for model usage` |
| argumentHint | `[low\|medium\|high\|xhigh\|max\|auto]` |
| immediate | `null` |
| thinClientDispatch | `control-request` |
| module_id | `fzq` |
| load_inline | `true` |
| handler (Arbor) | `Lw7` (AsyncFunction, resolved via `module_id`) |
| `loc_byte_end` | `11374458` |
| `arbor_handler.name` | `Lw7` |
| `arbor_handler.kind` | `AsyncFunction` |
| `arbor_handler.resolution_path` | `module_id` |
| `arbor_handler.fqn` | `claude-2.1.132::Lw7` |
| `arbor_handler.n_hits` | `1` |

Analysis basis: CC v2.1.132 bundle.js:+11374195 – +11374458

---

## Input Branching

The handler (`Lw7`) first checks whether the raw argument token is present in the supported-levels list, then decides on the action path.

```mermaid
flowchart TD
    A(["/effort [arg]"]) --> B{arg supplied?}
    B -- No --> STATUS[Render current effort status view]
    B -- Yes --> C{arg in allowed-levels list?}
    C -- No / invalid --> ERR[Return error: unrecognised level]
    C -- Yes --> D{remote transport active?}
    D -- Yes --> LOCAL["Apply locally only\n+ append remote-caveat suffix"]
    D -- No --> FULL[Apply to session + persist to config]
    LOCAL --> PERSIST[Write config / session state]
    FULL --> PERSIST
    PERSIST --> M1A_PATH[Save global config with lock\n(saveConfigWithLock path)]
    M1A_PATH --> TELEMETRY[Emit tengu_effort_command]
    TELEMETRY --> RENDER[Render JSX status view via Lw7]
    STATUS --> RENDER
```

Analysis basis: CC v2.1.132 bundle.js:+11372586 (allowed-levels membership check), +11363853 (remote-caveat suffix), +11364806 (session-only annotation), +11365186 (`tengu_effort_command` emit)

---

## Behavioral Spec

### 1. Argument Validation

```
function validateEffortArgument(rawArg):
    allowedLevels = ["low", "medium", "high", "xhigh", "max", "auto", "unset"]
    // Membership tested via uKH.includes (allowedLevels array)
    if rawArg not in allowedLevels:
        return Error("unrecognised effort level")
    return rawArg
```

The allowed-levels array (`uKH`) is checked via `.includes` at handler entry.
Analysis basis: CC v2.1.132 bundle.js:+11372586

Named levels and their human-readable descriptions (from the UI renderer `$WH`):

| Level | Description |
|---|---|
| `low` | Quick, straightforward implementation with minimal overhead |
| `medium` | Balanced approach with standard implementation and testing |
| `high` | Comprehensive implementation with extensive testing and documentation |
| `xhigh` | Deeper reasoning than high, just below maximum (Opus 4.7 only) |
| `max` | Maximum capability with deepest reasoning |
| `auto` | Let the model choose effort automatically |
| `unset` | Remove any previously set effort override |

Analysis basis: CC v2.1.132 bundle.js:+4000669, +4000747, +4000840, +4000930, +4001011 (level description strings); +3999463, +3999491 (`unset` / `auto` literals)

---

### 2. Effort Level Resolution (Model Compatibility Gate)

The internal effort-resolver (`LG`) maps symbolic level names to API-level effort tokens and applies model-compatibility filtering.

```
function resolveEffortForModel(levelName, currentModel):
    // Check if currentModel starts with "claude-3-" → legacy, effort unsupported
    if currentModel.startsWith("claude-3-"):
        return Error("effort control not supported for Claude 3 family")

    supportedModels = [
        "claude-opus-4-0", "claude-opus-4-1",
        "claude-sonnet-4-0", "claude-sonnet-4-5",
        "claude-haiku-4-5",
        "claude-opus-4-7", "claude-opus-4-6",
        "claude-sonnet-4-6"
    ]

    // xhigh is gated to opus-4-7 only
    if levelName == "xhigh":
        if NOT currentModel.includes("opus-4-7"):
            return Error("xhigh effort requires claude-opus-4-7 (or equivalent)")
        return "xhigh_effort"

    if levelName == "max":
        return "max_effort"

    // For other levels delegate to standard effort-token mapper
    return standardEffortToken(levelName)
```

Analysis basis: CC v2.1.132 bundle.js:+3997980 (`Gq` model-check entry), +3998000 (`"claude-3-"` prefix guard), +3998018–+3998195 (supported model list), +3999547 (`"opus-4-7"` xhigh gate), +3998269 (`"max_effort"` token), +3998624 (`"xhigh_effort"` token), +4001350, +4001364 (`"xhigh"`, `"high"` string literals in `Ii6` path)

---

### 3. Remote Transport Caveat

```
function applyWithTransportCheck(resolvedLevel, sessionContext):
    isRemote = sessionContext.transport == "ccr"   // "ccr" literal
    if isRemote:
        annotation = resolvedLevel + " (applied locally — this remote transport can't change server effort)"
        applyToLocalSessionOnly(resolvedLevel)
    else:
        applyToSessionAndConfig(resolvedLevel)
    return annotation ?? resolvedLevel
```

Analysis basis: CC v2.1.132 bundle.js:+3997439 (`"ccr"` transport identifier), +11363853 (remote-caveat suffix string), +11364806 (`" (this session only)"` annotation)

---

### 4. Configuration Persistence (`saveConfigWithLock` path)

When the transport is local, the resolved effort value is written to persistent configuration through the locked config-save path (`M1A` → `z8H` → `F9`).

```
function persistEffortToConfig(resolvedLevel):
    acquireConfigLock()           // lock guarded; emits tengu_config_lock_contention on contention
    currentConfig = readConfigFromDisk()
    if currentConfig missing auth that cache has:
        emit tengu_config_stale_write
        // refuse write to prevent auth wipe (see GH #3117)
        return Error("stale write prevented")
    currentConfig.effort = resolvedLevel
    writeConfigAtomically(currentConfig)   // temp-file + rename pattern
    releaseConfigLock()
```

Lock contention threshold: 100 ms (bundle.js:+3105303). Lock timeout: 60 000 ms (bundle.js:+60000 at +3106079). Backup file prefix: `".backup."` (bundle.js:+3106195). Config file paths involved: `~/.claude/settings.json` and `~/.claude/settings.local.json` (bundle.js:+1158288, +1158298, +1158360).

Analysis basis: CC v2.1.132 bundle.js:+4001102 (`M1A` → `obK` + `z8H`), +3105398 (`tengu_config_lock_contention`), +3105534 (`tengu_config_stale_write`), +3105877 (`tengu_config_auth_loss_prevented`)

---

### 5. Settings Layer Stack

The configuration system (`CA`) loads settings in a layered priority order:

```
effectiveSettings = merge(
    policySettings,    // highest priority
    flagSettings,
    userSettings,
    projectSettings,
    localSettings      // lowest priority
)
```

The `effort` key written by this command lands in `userSettings` (global config) unless a session-only flag is active.
Analysis basis: CC v2.1.132 bundle.js:+1159426, +1159448, +1158044, +1158092, +1158114

---

### 6. JSX Status View Renderer

When called with no argument, or after a successful set, the handler (`Lw7`) renders a JSX component displaying the current and status fields.

```
function renderEffortStatusView(currentLevel):
    props = {
        current: currentLevel ?? "unset",
        status: descriptionFor(currentLevel)
    }
    return r1.createElement(EffortStatusComponent, props)
```

The string keys `"current"` and `"status"` appear as property names in the JSX element creation call.
Analysis basis: CC v2.1.132 bundle.js:+11372624 (`"current"`), +11372639 (`"status"`), +11372655 (`r1.createElement`)

---

### 7. Telemetry Emission (`tengu_effort_command`)

After a successful set operation, a telemetry event is fired:

```
function emitEffortTelemetry(levelName):
    emit("tengu_effort_command", { level: levelName })
```

This call site is within `gY7` (the post-apply renderer wrapper).
Analysis basis: CC v2.1.132 bundle.js:+11365186

---

### 8. Numeric Effort Value Parsing (`fa` / `parseInt` path)

The argument parser (`fa`) also handles numeric effort values passed as integers (via `parseInt` with radix 10):

```
function parseEffortArg(raw):
    asString = String(raw)
    if isKnownLevelName(asString):     // aK6 / wB.includes check
        return { kind: "named", value: asString }
    parsed = parseInt(asString, 10)    // radix 10
    if isNaN(parsed):
        return Error("invalid effort value")
    if Number.isInteger(parsed):
        return { kind: "numeric", value: parsed }
    return Error("non-integer effort value")
```

Analysis basis: CC v2.1.132 bundle.js:+3999118 (`aK6` / `wB.includes`), +3999140 (`parseInt`), +3999151 (radix `10`), +3999159 (`isNaN`), +4000544 (`Number.isInteger`)

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry — primary | `tengu_effort_command` emitted on every successful level change (bundle.js:+11365186) |
| Telemetry — config lock | `tengu_config_lock_contention` emitted when lock acquisition is slow (bundle.js:+3105398) |
| Telemetry — stale write | `tengu_config_stale_write` emitted on stale-cache write attempt (bundle.js:+3105534) |
| Telemetry — auth guard | `tengu_config_auth_loss_prevented` emitted when write is blocked to protect auth (bundle.js:+3105877) |
| Telemetry — config parse error | `tengu_config_parse_error` emitted on corrupt config read (bundle.js:+3107927) |
| Telemetry — slate finch | `tengu_slate_finch` emitted inside the `j6` session-creation path (bundle.js:+4001134) |
| appState changes | `effort` field written to global config (`~/.claude/settings.json`) or session-only state |
| Config atomicity | Write uses temp-file + `rename` pattern; `fchmod`, `fsync` applied before rename |
| Config backup | Up to 5 backup files with `.backup.` prefix retained (bundle.js:+3106195, +3106328) |
| Remote transport | When transport is `"ccr"`, effect is session-local only; server effort unchanged |
| Hook registration | `apply_flag_settings` hook invoked during config application (bundle.js:+11363976) |
| Sound | None observed in depth-2 traversal |
| Randomness | `Math.random` / `setTimeout` appear in the `H` utility path; not directly tied to effort logic |

---

## Version History

| Version | Change |
|---|---|
| v2.1.132 | Initial analysis. Supported levels: `low`, `medium`, `high`, `xhigh`, `max`, `auto`, `unset`. `xhigh` gated to claude-opus-4-7. Remote-transport caveat annotation added. |

---

## Common Mistakes

1. **Passing `xhigh` with a non-Opus-4.7 model** — The command will reject the level at the model-compatibility gate (`LG`); switch to a supported model or use `high` instead.
2. **Expecting effort to propagate over a remote (`ccr`) transport** — When using a remote transport, the command applies the setting locally only and appends a caveat; the server-side model receives no effort override.
3. **Passing a float or non-integer numeric value** — The `Number.isInteger` check will reject non-integer numerics; only whole-number values (or named string levels) are accepted.
4. **Omitting the argument to change the level** — Invoking `/effort` with no argument renders the current status view rather than modifying anything; this is by design but can surprise users expecting a toggle.
5. **Assuming `auto` and `unset` are equivalent** — `auto` instructs the model to self-select an effort level, while `unset` removes any override entirely; the downstream API treatment differs.
6. **Running `/effort` while another Claude instance holds the config lock** — Contention beyond the 100 ms threshold will emit `tengu_config_lock_contention` telemetry and may delay or fail the write; ensure no concurrent Claude process is active.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `Lw7` | Main async handler for `/effort` (Arbor-resolved entry point, `module_id` path) |
| `Uz8` | Top-level effort command orchestrator (calls validator, resolver, renderer, config writer) |
| `A3` | Session/transport context accessor |
| `ywH` | Transport type reader (returns `"ccr"` or local) |
| `ifH` | Effort state accessor / current-value reader |
| `fa` | Argument parser (named level + numeric fallback via `parseInt`) |
| `wS1` | Integer validation helper (`Number.isInteger` wrapper) |
| `aK6` | Named-level membership checker (`wB.includes`) |
| `px` | Level-description table builder (populates the `$WH` descriptions map) |
| `nfH` | Effort resolver + model-compatibility gate dispatcher |
| `LG` | Model-compatibility check and effort-token mapper |
| `yH` | String utility / model name formatter |
| `Gq` | Model type classifier (first-party / AWS / foundry / mantle / application-inference-profile) |
| `_` | Locale-lowercase utility (`.toLowerCase`) |
| `_S` | Session effort state setter (firstParty path) |
| `nw` | Session effort state setter (cross-provider path; calls `xb6`, `JaL`, `g_`, `Lx_`) |
| `Zi6` | `xhigh` / `high` level handler branch |
| `R6` | Effort-change event emitter (calls `Date.now`, `DPK`) |
| `Ii6` | Secondary level-handler branch (calls `Gq`) |
| `rK6` | `max_effort` handler (reads `o8H`, checks `_.includes`, calls `_S` + `nw`) |
| `oK6` | `xhigh_effort` handler (same structure as `rK6`) |
| `$WH` | Level-to-description mapping table renderer |
| `M1A` | Config persistence orchestrator (calls `obK`, `z8H`, `j6`) |
| `obK` | Pre-save config validator |
| `z8H` | Config write dispatcher (calls `F9`) |
| `F9` | Atomic config file writer (calls `wx_`, `Yx_`, `nY`, `E_`) |
| `nY` | Low-level file write with auth-loss guard |
| `j6` | Session record creator / updater (calls `hq6`, `Rq6`, `Oo`, `uQ6`, `R6`) |
| `hq6` | Session pre-creation hook |
| `Rq6` | Session ID generator |
| `Oo` | Session object builder (calls `yH`, `Mo`) |
| `Mo` | Model metadata resolver (calls `Yx`) |
| `uQ6` | Session cache write (uses `Kt8`, `V5H` sets/maps, calls `Lt8`, `Dt8`) |
| `Lt8` | Session store writer (calls `Mo`, `rPH`, `hU`, `$bH`, `_t8.randomUUID`, `RH`, `BXK`, `fo.emit`) |
| `Dt8` | Session persistence helper (calls `U41`, `uA`, `EJ1`, `jyH`) |
| `Bz8` | Remote-transport caveat annotator (calls `H.toLowerCase`, `gY7`, `aK6`, `FY7`) |
| `H` | General-purpose utility namespace (includes `Math.random`, `setTimeout`, `.includes`, `.toLowerCase`) |
| `gY7` | Post-apply renderer and telemetry emitter (calls `Kzq`, `tK6`, `d`, `A3`, `ifH`) |
| `Kzq` | Pre-render session-state snapshot builder (calls `A3`, `Jv`) |
| `Jv` | Session value extractor (calls `A3`) |
| `tK6` | JSX component tree builder for status view (calls `MWH`, `CA`, `A8`) |
| `MWH` | Status view wrapper component |
| `CA` | Settings loader / project-context builder |
| `EO` | Settings file enumerator |
| `F6` | File existence checker |
| `G7_` | Project-settings directory walker |
| `wE` | Base-path resolver (calls `bp`) |
| `D8` | ENOENT-safe file reader |
| `k` | Debug-level logger |
| `Wh8` | Settings cache writer (`xN6.set` + `Date.now`) |
| `E6H` | Settings file path builder |
| `QyH` | Atomic file writer (temp + rename with `fchmod`, `fsync`) |
| `RH` | JSON serialiser (`JSON.stringify` wrapper) |
| `C2` | Cache-clear utility (`s06.clear`, `j28.clear`) |
| `NN6` | Settings append/write helper (mkdir, readFile, appendFile, writeFile) |
| `xb` | `.claude` directory path joiner |
| `_A` | Settings merge helper |
| `fH` | Error logger (`EQ.logError`, `kyH.push`) |
| `ub` | Settings-load finaliser (calls `Kp`, `_2L`, `$q`, `ZdA`; emits `loadSettingsFromDisk_end`) |
| `A8` | Conversation/checkpoint manager (calls `Nt8`, `B2`, `H`, `FbH`, `CJ1`, `gbH`, `k`, `k5H`, `uq6`, `d`, `vt8`) |
| `Nt8` | Checkpoint writer with backup rotation |
| `FbH` | Conversation serialiser |
| `CJ1` | Entry-iterator (`Object.entries` wrapper) |
| `gbH` | Timestamp stamper (`Date.now`) |
| `k5H` | Config reader with access-guard |
| `uq6` | Conversation cache accessor |
| `d` | React/JSX rendering dispatcher |
| `vt8` | Checkpoint temp-file writer |
| `FY7` | Full effort-apply flow for non-remote path (calls `MWH`, `Jv`, `Kzq`, `tK6`, `d`, `A3`, `ifH`, `M1A`) |