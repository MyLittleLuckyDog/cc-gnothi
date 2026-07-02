---
type: feature-spec
feature: "privacy-settings"
cc_version: "2.1.198"
updated: "2026-07-02"
tags: ["privacy-settings", "commands", "slash-commands"]
source: "bundle-analysis"
bundle_verified: true
analysis_basis: "CC v2.1.198 bundle.js (AST extraction + Claude interpretation)"
author: "ryujaeuk <ryujaeuk@gmail.com>"
repository: "https://github.com/MyLittleLuckyDog/cc-gnothi"
license: "AGPL-3.0-only"
---

# `/privacy-settings`

> Analysis basis: CC v2.1.198 bundle.js (AST extraction + Claude interpretation)
> Minimum version: v2.1.198

---

## Overview

The `/privacy-settings` command opens an interactive JSX dialog that displays the user's current privacy configuration and allows them to toggle privacy-related policy settings (referred to internally as "Grove" policies). It fetches the current configuration asynchronously, presents a rendered UI component, and persists any changes back to the global config file with lock-protected writes.

---

## Registration

| Field | Value |
|---|---|
| type | `local-jsx` |
| name | `privacy-settings` |
| description | `View and update your privacy settings` |
| module_id | `Unc` |
| load_inline | `true` |
| loc_byte | `13042244` |
| loc_byte_end | `13042427` |
| loc_line | `8877` |
| arbor_handler.name | `mtm` |
| arbor_handler.fqn | `claude-2.1.198::mtm` |
| arbor_handler.kind | `AsyncFunction` |
| arbor_handler.resolution_path | `module_id` |
| arbor_handler.n_hits | `0` |

Analysis basis: CC v2.1.198 bundle.js:+13042244

---

## Input Branching

The handler has 4+ distinct branches: config cache fresh vs. stale vs. missing, dialog dismissed vs. confirmed, fetch error, and policy toggle outcome. A Mermaid flowchart is used.

```mermaid
flowchart TD
    A(["/privacy-settings invoked"]) --> B[Resolve current config via Grove cache]
    B --> C{Cache state}
    C -->|Fresh cache hit| D["Return cached config immediately\n(log: 'Grove: Using fresh cached config')"]
    C -->|Stale cache| E["Return stale data, trigger background refresh\n(log: 'Grove: Cache stale, returning cached data...')"]
    C -->|No cache| F["Skip dialog this session, fetch in background\n(log: 'Grove: No cache, fetching config in background...')"]
    D --> G[Render JSX privacy-settings dialog\n via ojo.jsx]
    E --> G
    F --> G
    G --> H{User action}
    H -->|Escape / Defer / Dismiss| I["Emit message: 'Privacy settings dialog dismissed'\nReturn without writing"]
    H -->|Toggle policy setting| J[Update policy field in config object]
    J --> K[Acquire config file lock]
    K --> L{Lock acquired?}
    L -->|Lock contention / timeout| M["Emit tengu_config_lock_contention\nProceed with fallback write path"]
    L -->|Lock acquired| N[Re-read config from disk]
    N --> O{Re-read valid?}
    O -->|Parse error| P["Auto-repair from cached config\nEmit tengu_config_auto_repaired\nLog GH#3117 warning"]
    O -->|Auth fields missing in re-read| Q["Refuse write to protect ~/.claude.json\nEmit tengu_config_auth_loss_prevented\nLog GH#3117 warning"]
    O -->|Valid| R[Merge toggled policy into re-read config]
    P --> R
    R --> S[Write config atomically with backup rotation\n(up to 5 backups, suffix '.backup.')]
    S --> T{Write outcome}
    T -->|Success| U["Emit tengu_grove_policy_toggled\nReturn updated settings key"]
    T -->|Parse error on final verify| V["Emit tengu_config_parse_error"]
    T -->|Stale write detected| W["Emit tengu_config_stale_write"]
    M --> X["Fallback: write via global-config fallback path\nEmit tengu_config_fallback_write"]
    Q --> Y[Abort write, return error state]
    G --> Z{Fetch error?}
    Z -->|Yes| AA["Display: 'Unable to retrieve updated privacy settings'"]
```

Analysis basis: CC v2.1.198 bundle.js:+13041255, +8008669, +8008864, +13041419, +13041444

---

## Behavioral Spec

### 1. Handler Entry — `asyncPrivacySettingsHandler` (`mtm`)

The handler is an `AsyncFunction` resolved via `module_id` → `Unc`.

```
async function asyncPrivacySettingsHandler(context):
    // Kick off parallel resolution of current config and billing state
    [configResult, billingResult] = await Promise.all([
        resolveGroveConfig(),      // Zoe
        fetchBillingPolicyState()  // BPe
    ])

    // Render JSX dialog and await user interaction
    dialogResult = await renderPrivacyDialog(configResult, billingResult)

    if dialogResult.action in ["escape", "defer"]:
        emit message "Privacy settings dialog dismissed"
        return

    // User confirmed a toggle — persist
    await persistPrivacyPolicyChange(dialogResult.updatedConfig)

    emit telemetry "tengu_grove_policy_toggled"
    return renderSettingsKey("settings")
```

Analysis basis: CC v2.1.198 bundle.js:+13041255, +13041295, +13041308, +13041419, +13041433, +13041444, +13041800, +13041864

---

### 2. Grove Config Resolution — `resolveGroveConfig` (`bgt`)

This function implements a tiered cache strategy for reading the global config.

```
function resolveGroveConfig():
    freshThreshold = (some internal TTL)
    cachedEntry = readGroveCache()

    if cachedEntry is absent:
        log "Grove: No cache, fetching config in background (dialog skipped this session)"
        scheduleBackgroundConfigFetch()
        return defaultConfigSkeleton()

    age = Date.now() - cachedEntry.timestamp

    if age <= freshThreshold:
        log "Grove: Using fresh cached config"
        return cachedEntry.data

    // Stale but usable
    log "Grove: Cache stale, returning cached data and refreshing in background"
    scheduleBackgroundConfigFetch()
    return cachedEntry.data
```

Analysis basis: CC v2.1.198 bundle.js:+8008669, +8008729, +8008758, +8008784, +8008864, +8008904, +8009010

---

### 3. Config Read with Settings Model — `readGlobalConfigWithModel` (`Hye` / `Di` / `Eo`)

Reads and validates the global configuration, applying model-tier constraints.

```
function readGlobalConfigWithModel(configPath):
    rawConfig = readConfigFile(configPath)   // cE

    // Validate known model tiers
    allowedTiers = ["max", "pro"]           // literals at +3138847, +3138858
    tier = rawConfig.modelTier

    if not isValidTier(tier, allowedTiers):
        tier = deriveDefaultTier()          // MRi

    // Resolve API key
    apiKey = resolveApiKey(rawConfig)       // checks ANTHROPIC_API_KEY env var
    if not apiKey:
        apiKeySource = rawConfig["apiKeyHelper"]

    return buildConfigObject(rawConfig, tier, apiKey)
```

Analysis basis: CC v2.1.198 bundle.js:+3138847, +3138858, +3138885, +3138897, +3138913, +3113274, +3113299

---

### 4. Config File Read (`cE`)

Reads the raw config, handling the `ANTHROPIC_API_KEY` environment variable and the `apiKeyHelper` fallback.

```
function readRawConfig(configPath):
    content = fs.readFileSync(configPath, "utf-8")   // encoding literal at +14257838
    parsed = JSON.parse(content)

    apiKey = env["ANTHROPIC_API_KEY"]                // literal at +3113274
    if not apiKey:
        apiKey = parsed["apiKeyHelper"]              // literal at +3113299

    return merge(parsed, { resolvedApiKey: apiKey })
```

Analysis basis: CC v2.1.198 bundle.js:+3112994, +3113092, +3113113, +3113121, +3113146, +3113199, +3113274, +3113299, +3113375, +3113391

---

### 5. Lock-Protected Config Write (`lockAndSaveConfig` — `Dt` / `SCt`)

Saves the mutated config with file locking, backup rotation, and safety guards.

```
async function lockAndSaveConfig(configPath, updatedConfig, cachedConfig):
    // Guard: config must not be accessed before initialization
    if not configAccessAllowed():
        throw Error("Config accessed before allowed.")   // literal at +14257755

    lockPath = deriveLockPath(configPath)
    lockAcquired = acquireLock(lockPath, timeout=60000)  // 60 s limit at +14256485

    if not lockAcquired:
        emit telemetry "tengu_config_lock_contention"
        // Fall through to fallback write

    // Re-read from disk under lock
    try:
        diskConfig = fs.readFileSync(configPath, "utf-8")
        parsed = JSON.parse(diskConfig)
    catch ParseError:
        emit telemetry "tengu_config_auto_repaired"
        log "saveConfigWithLock: re-read hit a parse error; auto-repairing..."  // literal at +14255821
        parsed = cachedConfig

    // Auth-loss guard
    if cachedConfig.hasAuth and not parsed.hasAuth:
        emit telemetry "tengu_config_auth_loss_prevented"
        log "saveConfigWithLock: re-read config is missing auth..."             // literal at +14256127
        return  // refuse write

    mergedConfig = deepMerge(parsed, updatedConfig)

    // Backup rotation — keep up to 5 backups (limit at +14256740)
    backupDir = path.dirname(configPath)
    existingBackups = listBackupFiles(backupDir, prefix=".backup.")             // literal at +14256601
    if existingBackups.length >= 5:
        removeOldestBackup(existingBackups)

    backupPath = path.join(backupDir, ".backup." + Date.now())
    fs.copyFileSync(configPath, backupPath)

    // Write merged config
    fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2))

    releaseLock(lockPath)
```

Analysis basis: CC v2.1.198 bundle.js:+14253999, +14254013, +14254032, +14254036, +14254089, +14254142, +14255347, +14255821, +14256127, +14256462, +14256485, +14256601, +14256740, +14257749, +14257755, +14257811, +14257838, +14258021

---

### 6. Global Config Fallback Write (`saveGlobalConfigFallback` — `_n` / `Kfr`)

Used when the primary lock-based write cannot proceed.

```
function saveGlobalConfigFallback(updatedConfig, cachedConfig):
    // Same auth-loss guard as primary path
    if cachedConfig.hasAuth and not reReadConfig().hasAuth:
        log "saveGlobalConfig fallback: re-read config is missing auth..."  // literal at +14252150
        return

    emit telemetry "tengu_config_fallback_write"   // event label "save_global" at +14252396

    writeConfigDirectly(updatedConfig)
```

Analysis basis: CC v2.1.198 bundle.js:+14251949, +14251953, +14251974, +14252006, +14252025, +14252050, +14252066, +14252131, +14252140, +14252150, +14252276, +14252390, +14252396

---

### 7. Billing / Spend-Block Resolution (`fetchBillingPolicyState` — `BPe` / `a`)

Resolved in parallel with config fetch. Handles rate-limit and billing-error states.

```
async function fetchBillingPolicyState():
    try:
        response = await billingEndpointFetch()

        if response.status == "spend.blocked":          // literal at +18191733
            return { blocked: true, reason: "spend limit reached" }  // literal at +18191834

        if response.status == "store_error":            // literal at +18191794
            return { blocked: true, reason: "spend limit unavailable" }  // literal at +18191808

        if response.httpStatus == 429:                  // literal at +18191992
            header = response.headers["x-should-retry"]  // literal at +18192005
            return { rateLimited: true, retry: header }

        if response.status == "billing_error":          // literal at +18191903
            return { billingError: true }

        return Response.json(response)

    catch err:
        return { fetchError: true }
```

Analysis basis: CC v2.1.198 bundle.js:+13041295, +13041308, +13041314, +18191729, +18191733, +18191794, +18191808, +18191834, +18191863, +18191903, +18191992, +18192005

---

### 8. Dialog Rendering (`renderPrivacySettingsDialog` — `ojo.jsx`)

The JSX component is rendered via `ojo.jsx`. User interaction produces one of:

- `"escape"` — user pressed Escape key (literal at +13041419)
- `"defer"` — user chose to defer (literal at +13041433)
- A settings-update payload — user toggled a policy

The dismissal message `"Privacy settings dialog dismissed"` is emitted as a `"system"` message type (literal at +13041489) when escape or defer is chosen.

```
function renderPrivacySettingsDialog(config, billingState):
    component = ojo.jsx(PrivacySettingsComponent, {
        currentConfig: config,
        billingState:  billingState,
        onEscape:      () => return { action: "escape" },
        onDefer:       () => return { action: "defer" },
        onToggle:      (field, value) => return { action: "toggle", field, value }
    })
    return await renderAndAwaitInteraction(component)
```

Analysis basis: CC v2.1.198 bundle.js:+13041419, +13041433, +13041444, +13041489, +13041511, +13041911

---

### 9. API Key Masking in Output (`maskApiKey` — `Oc`)

When the config or any output is rendered, API key values are redacted.

```
function maskApiKey(value):
    if value is absent or short:
        return value

    // Keep first 2 characters, replace remainder with "[REDACTED]"
    prefix = value.slice(0, 2)                          // limit: 2 chars, at +209056
    return prefix + "[REDACTED]"                        // literal at +209027
```

Analysis basis: CC v2.1.198 bundle.js:+208948, +208975, +209027, +209056, +209085, +209111, +209137

---

### 10. Config Staleness Write Guard (`tengu_config_stale_write`)

If a write is detected to be operating on data older than expected (detected by comparing timestamps), the event is emitted but the write may still proceed depending on the severity.

```
function checkStaleWrite(configTimestamp, cachedTimestamp):
    if configTimestamp < cachedTimestamp:
        emit telemetry "tengu_config_stale_write"
        // Log warning; continue with caution
```

Analysis basis: CC v2.1.198 bundle.js:+14255572

---

## State & Side Effects

| Item | Detail |
|---|---|
| Telemetry: `tengu_grove_policy_toggled` | Emitted after a successful privacy policy toggle and config write (bundle.js:+13041800) |
| Telemetry: `tengu_config_lock_contention` | Emitted when the config file lock could not be acquired within the 60 000 ms timeout (bundle.js:+14255436) |
| Telemetry: `tengu_config_stale_write` | Emitted when a write is detected to be based on stale config data (bundle.js:+14255572) |
| Telemetry: `tengu_config_auto_repaired` | Emitted when a re-read config fails JSON parsing and the cached copy is used to auto-repair (bundle.js:+14255949) |
| Telemetry: `tengu_config_auth_loss_prevented` | Emitted when a write is refused because the re-read config is missing auth fields present in cache (bundle.js:+14256279) |
| Telemetry: `tengu_config_fallback_write` | Emitted when the primary lock path fails and the fallback global-config write is used (bundle.js:+14255052) |
| Telemetry: `tengu_config_parse_error` | Emitted when the final written config cannot be parsed (bundle.js:+14259169) |
| Config file write | Mutates `~/.claude.json` (global config) with lock-protected, backup-rotated atomic write |
| Config backups | Rotated `.backup.<timestamp>` files in the config directory; maximum 5 retained (bundle.js:+14256740) |
| Background config refresh | Triggered when cache is absent or stale; does not block dialog render |
| System message | `"Privacy settings dialog dismissed"` emitted as a `system`-type message on escape/defer (bundle.js:+13041444, +13041489) |
| File lock | Exclusive lock on config file path for duration of write; released after write or on error |
| Process exit handler | Registered via `process.on("exit", ...)` to flush buffered log entries (bundle.js:+217658, +217669) |
| Billing state fetch | Parallel async fetch of spend/billing state displayed in dialog |

---

## Version History

| Version | Change |
|---|---|
| v2.1.198 | Initial analysis |

---

## Common Mistakes

1. **Invoking the command expecting immediate config writes**: The command first checks the Grove cache and may defer a full config fetch to the background. If no cache is present, the dialog renders with default/skeleton data; changes made in this session are still written correctly but the displayed "current" state may be stale.

2. **Pressing Escape expecting changes to persist**: The `"escape"` and `"defer"` actions both emit `"Privacy settings dialog dismissed"` and return without writing. No privacy setting is changed when the dialog is dismissed.

3. **Assuming API key values are visible**: All API key values shown in any config output are masked to a 2-character prefix followed by `[REDACTED]`. This is not a display bug.

4. **Running multiple Claude instances simultaneously**: Concurrent instances compete for the config file lock. Lock contention (> 60 s) triggers `tengu_config_lock_contention` and falls back to the unguarded write path. Users should avoid running `/privacy-settings` from two sessions at once.

5. **Manually editing `~/.claude.json` during a session**: The auth-loss prevention guard checks whether the re-read file still contains auth credentials. A manual edit that removes auth fields will cause the write to be refused silently to protect credentials, and `tengu_config_auth_loss_prevented` will be emitted.

---

## Appendix — Identifier Mapping

> For bundle debugging only. Identifiers change across versions.

| Identifier | Role |
|---|---|
| `mtm` | Main async handler for `/privacy-settings` (asyncPrivacySettingsHandler) |
| `bgt` | Grove config resolution with tiered cache strategy |
| `Hye` | Config read with model-tier validation |
| `Di` | Config object builder / field extractor |
| `e4r` | Config field reader sub-utility A |
| `Z9r` | Config field reader sub-utility B |
| `cE` | Raw config file reader (reads file, resolves API key) |
| `Eo` | Config validation / tier check helper |
| `U3` | Array membership / inclusion check utility |
| `MRi` | Default model tier derivation |
| `Fc` | Config fetch coordinator |
| `Dt` | Lock-protected config save (primary path) |
| `zt` | Config path resolver |
| `A7o` | Config schema / structure utility |
| `SCt` | Atomic config write with backup rotation |
| `qHm` | Config lock manager / watcher cleanup |
| `T` | Logging / output formatter |
| `Hiu` | Log output routing |
| `cus` | Log level / transport selector |
| `Me` | JSON stringify wrapper |
| `Oc` | API key masking / redaction formatter |
| `Kps` | Redaction pattern map builder |
| `YZe` | Output write coordinator |
| `Ops` | Stream write wrapper |
| `biu` | Buffered log writer with async flush |
| `AZe` | Log batch accumulator with debounce |
| `jae` | Log entry formatter |
| `Siu` | Async log file appender (mkdir + appendFile) |
| `Si` | Exit signal handler registration |
| `Uae` | EISDIR-safe file write helper |
| `Jps` | Log file path builder |
| `ZVa` | Background config refresh scheduler |
| `_n` | Global config fallback write path |
| `Onn` | Config file write with backup rotation (alternate path) |
| `TFe` | Config timestamp tracker |
| `b7o` | Config entries iterator (Object.entries wrapper) |
| `Dnn` | Config staleness timestamp checker |
| `Mnn` | Config repair-from-cache helper |
| `ACt` | Auth field presence checker |
| `V` | Telemetry event emitter |
| `Kfr` | Fallback global config save coordinator |
| `a` | Billing/spend state response handler |
| `tge` | Billing response serializer |
| `Ke` | Settings key renderer |
| `OQe` | Settings key component |
| `BPe` | Billing policy state fetcher |
| `Zoe` | Config fetch initiator (parallel with billing) |

---

Note: index built via Arbor fallback; some signals (telemetry, literals) may be missing — see arbor-fallback.js.